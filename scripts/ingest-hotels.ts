/**
 * Daily ingest worker — the ONLY caller of chain-hotels-lite-v2.
 * Discovers all hotel chains, pulls their metadata, projects to slim docs,
 * builds a fresh Typesense collection, then atomically swaps the `hotels`
 * alias (zero-downtime).
 *
 * Run: TYPESENSE_API_KEY=... npx tsx scripts/ingest-hotels.ts
 * By default it discovers chains 1..CHAIN_MAX (env, default 200), skipping gaps.
 * Set CHAIN_IDS="99999" to pull only the backend aggregate chain once it exists.
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

const CHAIN_MAX = Number(process.env.CHAIN_MAX || 200);
const explicitChains = (process.env.CHAIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

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

// Tolerant: a missing/invalid chain returns [] rather than throwing, so one gap
// can't abort the whole run. Projects to slim docs immediately and discards the
// heavy raw response (~46 KB/hotel) to keep memory low.
async function fetchChainSlim(chainId: string): Promise<HotelDoc[]> {
  try {
    const res = await fetch(`https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chainId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const hotels = data?.data?.hotels;
    if (!Array.isArray(hotels)) return [];
    return hotels.filter((h: RawHotel) => h?.id).map((h: RawHotel) => project(h, Number(chainId)));
  } catch {
    return [];
  }
}

// Bounded-concurrency map. Big chains are ~50 MB raw; keep concurrency low so peak
// memory stays modest on the shared box. ponytail: fixed pool of 4; raise if the
// daily run gets too slow.
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function main() {
  if (!isConfigured()) throw new Error("TYPESENSE_API_KEY not set");
  const t0 = Date.now();

  const chains = explicitChains.length
    ? explicitChains
    : Array.from({ length: CHAIN_MAX }, (_, i) => String(i + 1));

  const perChain = await mapPool(chains, 4, fetchChainSlim);

  // dedupe by hotel_id across chains
  const byId = new Map<number, HotelDoc>();
  let validChains = 0;
  perChain.forEach((docs) => {
    if (docs.length) validChains++;
    for (const d of docs) byId.set(d.hotel_id, d);
  });
  const docs = Array.from(byId.values());
  if (docs.length === 0) throw new Error("refusing to swap to an empty index");
  console.log(`discovered ${validChains} chains, ${docs.length} unique hotels`);

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
