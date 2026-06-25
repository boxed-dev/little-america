import { Client } from "typesense";

// Single source of truth for hotel metadata search + enrichment.
// Read path (searchHotels/getHotel) is used by the MCP request handlers.
// Write path (createCollection/importHotels/swapAlias) is used only by the daily ingest worker.
// Engine is isolated here so it can be swapped (Meilisearch/SQLite) without touching route.ts.

export const HOTELS_ALIAS = "hotels";

export interface HotelDoc {
  id: string; // typesense doc id == hotel_id as string
  hotel_id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  rating: number;
  amenities_text: string;
  image_url: string;
  chain_id: number;
}

// ponytail: keyword search only (typo-tolerant, weighted, faceted) — genuinely sub-ms in-RAM.
// A semantic embedding field would add per-query model/API latency (not sub-ms); add it
// deliberately later if "vibe" queries are needed.
export const hotelCollectionSchema = (name: string) => ({
  name,
  enable_nested_fields: false,
  default_sorting_field: "rating",
  fields: [
    { name: "hotel_id", type: "int32" as const },
    { name: "name", type: "string" as const },
    { name: "city", type: "string" as const, facet: true },
    { name: "state", type: "string" as const, facet: true },
    { name: "country", type: "string" as const, facet: true },
    { name: "address", type: "string" as const },
    { name: "rating", type: "float" as const, facet: true },
    { name: "amenities_text", type: "string" as const },
    { name: "image_url", type: "string" as const, index: false, optional: true },
    { name: "chain_id", type: "int32" as const, facet: true },
  ],
});

const config = () => ({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "127.0.0.1",
      port: Number(process.env.TYPESENSE_PORT || 8108),
      protocol: process.env.TYPESENSE_PROTOCOL || "http",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "",
  connectionTimeoutSeconds: 2,
  numRetries: 1,
});

let _client: Client | null = null;
export const client = () => (_client ??= new Client(config()));

export const isConfigured = () => Boolean(process.env.TYPESENSE_API_KEY);

export interface SearchedHotel {
  hotel_id: number;
  hotel_name: string;
  rating?: number;
  location: { address?: string; city?: string; state?: string };
  amenities_text?: string;
  imageUrl?: string;
}

const toSearched = (d: HotelDoc): SearchedHotel => ({
  hotel_id: d.hotel_id,
  hotel_name: d.name,
  rating: d.rating || undefined,
  location: { address: d.address || undefined, city: d.city || undefined, state: d.state || undefined },
  amenities_text: d.amenities_text || undefined,
  imageUrl: d.image_url || undefined,
});

// Filler words in natural queries ("hotels in bangalore") match nearly every doc
// via "hotel"/"in", which makes Typesense drop the meaningful location token and
// return noise. Strip them so the query keeps only the discriminating terms.
const FILLER = new Set([
  "hotel", "hotels", "resort", "resorts", "stay", "stays", "room", "rooms",
  "property", "properties", "accommodation", "accommodations", "place", "places",
  "in", "at", "near", "the", "a", "an", "of", "to", "for", "and", "me", "my",
  "find", "show", "search", "book", "booking", "around", "with",
]);
const cleanQuery = (q: string) =>
  q.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w && !FILLER.has(w)).join(" ").trim();

// Sub-ms keyword search over the live alias. Throws if Typesense is unreachable;
// callers decide how to degrade.
export async function searchHotels(query: string, k = 5): Promise<SearchedHotel[]> {
  const cleaned = cleanQuery(query);
  // All-filler query (e.g. "show me hotels") -> match all, ranked by rating.
  const q = cleaned || "*";
  const res = await client()
    .collections(HOTELS_ALIAS)
    .documents()
    .search({
      q,
      // address is intentionally excluded: a hotel whose address merely mentions a
      // city ("90 km from Bangalore") must not surface for that city's search.
      query_by: "name,city,state,amenities_text",
      query_by_weights: "5,4,3,1",
      sort_by: "_text_match:desc,rating:desc",
      prefix: true,
      per_page: Math.min(Math.max(k, 1), 20),
      num_typos: 1,
    });
  return (res.hits ?? []).map((h: { document: unknown }) => toSearched(h.document as HotelDoc));
}

// Sub-ms point lookup for name/image enrichment in availability/booking.
export async function getHotel(hotelId: string | number): Promise<SearchedHotel | null> {
  try {
    const doc = (await client().collections(HOTELS_ALIAS).documents(String(hotelId)).retrieve()) as HotelDoc;
    return toSearched(doc);
  } catch {
    return null;
  }
}

// ---- write path (ingest worker only) ----

export async function createCollection(name: string) {
  await client().collections().create(hotelCollectionSchema(name) as never);
}

// Indian cities with two common spellings — searching one must find the other.
// Multi-way synonyms apply at query time, so register them on each fresh collection.
const CITY_SYNONYMS: string[][] = [
  ["bangalore", "bengaluru"],
  ["bombay", "mumbai"],
  ["calcutta", "kolkata"],
  ["madras", "chennai"],
  ["gurgaon", "gurugram"],
  ["pondicherry", "puducherry"],
  ["mysore", "mysuru"],
  ["trivandrum", "thiruvananthapuram"],
  ["cochin", "kochi"],
  ["baroda", "vadodara"],
  ["vizag", "visakhapatnam"],
  ["mangalore", "mangaluru"],
  ["belgaum", "belagavi"],
  ["hubli", "hubballi"],
  ["guwahati", "gauhati"],
  ["simla", "shimla"],
  ["poona", "pune"],
];

export async function registerSynonyms(name: string) {
  for (let i = 0; i < CITY_SYNONYMS.length; i++) {
    await client().collections(name).synonyms().upsert(`city-${i}`, { synonyms: CITY_SYNONYMS[i] });
  }
}

export async function importHotels(name: string, docs: HotelDoc[]) {
  // import is the bulk, fastest path; action upsert is idempotent
  const out = (await client()
    .collections(name)
    .documents()
    .import(docs, { action: "upsert", batch_size: 1000 })) as { success: boolean }[];
  const failures = out.filter((r) => !r.success);
  return { imported: out.length - failures.length, failed: failures.slice(0, 5) };
}

export async function swapAlias(toCollection: string) {
  await client().aliases().upsert(HOTELS_ALIAS, { collection_name: toCollection });
}

// Delete every hotels_* collection except the one the alias currently points at.
export async function cleanupOldCollections(keep: string) {
  const cols = await client().collections().retrieve();
  for (const c of cols) {
    if (c.name.startsWith("hotels_") && c.name !== keep) {
      await client().collections(c.name).delete();
    }
  }
}
