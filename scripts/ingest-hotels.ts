/**
 * Daily ingest worker — the ONLY caller of chain-hotels-lite-v2.
 * Pulls full hotel metadata, projects to slim docs, builds a fresh Typesense
 * collection, then atomically swaps the `hotels` alias (zero-downtime).
 *
 * Run: TYPESENSE_API_KEY=... npx tsx scripts/ingest-hotels.ts
 * Source chains via CHAIN_IDS env (default "1,2,3"; set to "99999" once the
 * backend aggregate chain is live).
 */
import {
  HotelDoc,
  createCollection,
  importHotels,
  swapAlias,
  cleanupOldCollections,
  isConfigured,
} from "../lib/hotel-index";

interface RawHotel {
  id: number;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  rating?: number;
  hotelHighlight?: string;
  HotelImages?: { cdnImageUrl: string }[];
}

const CHAIN_IDS = (process.env.CHAIN_IDS || "1,2,3").split(",").map((s) => s.trim()).filter(Boolean);

const firstImage = (h: RawHotel) =>
  h.HotelImages?.find((i) => i.cdnImageUrl && !i.cdnImageUrl.includes("chatbot-converted-images"))?.cdnImageUrl || "";

const project = (h: RawHotel, chainId: number): HotelDoc => ({
  id: String(h.id),
  hotel_id: h.id,
  name: h.name || "",
  city: h.city || "",
  state: h.state || "",
  country: h.country || "",
  address: h.address || "",
  rating: Number(h.rating) || 0,
  amenities_text: h.hotelHighlight || "",
  image_url: firstImage(h),
  chain_id: chainId,
});

async function fetchChain(chainId: string): Promise<RawHotel[]> {
  const res = await fetch(`https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chainId}`);
  if (!res.ok) throw new Error(`chain ${chainId} fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data?.data?.hotels) throw new Error(`chain ${chainId}: no hotels (${data?.message ?? "unknown"})`);
  return data.data.hotels as RawHotel[];
}

async function main() {
  if (!isConfigured()) throw new Error("TYPESENSE_API_KEY not set");
  const t0 = Date.now();

  // dedupe by hotel_id across chains
  const byId = new Map<number, HotelDoc>();
  for (const chainId of CHAIN_IDS) {
    const hotels = await fetchChain(chainId);
    for (const h of hotels) if (h?.id) byId.set(h.id, project(h, Number(chainId)));
    console.log(`chain ${chainId}: ${hotels.length} hotels`);
  }
  const docs = Array.from(byId.values());
  if (docs.length === 0) throw new Error("refusing to swap to an empty index");

  const collection = `hotels_${t0}`;
  await createCollection(collection);
  const { imported, failed } = await importHotels(collection, docs);
  if (failed.length) {
    console.error("sample import failures:", failed);
    throw new Error(`${docs.length - imported} docs failed to import — not swapping`);
  }

  await swapAlias(collection);
  await cleanupOldCollections(collection);

  console.log(`indexed ${imported} hotels into ${collection}, alias swapped, ${Date.now() - t0}ms`);
}

main().catch((e) => {
  console.error("ingest failed:", e.message);
  process.exit(1);
});
