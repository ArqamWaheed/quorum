import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '../../shared/db';

export type Spot = { name: string; kind: string; lat?: number; lon?: number; toilets?: string; wheelchair?: string };

// Public Overpass instances are shared and often overloaded: try each in turn, and cache results.
const MIRRORS = [process.env.OVERPASS_URL, 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  .filter((u, i, xs): u is string => !!u && xs.indexOf(u) === i);
const FRESH_MS = 7 * 864e5; // older cache entries are used only if every mirror fails (TTL index drops them at 30 days)
const mem = new Map<string, Spot[]>();

async function overpass(q: string): Promise<Spot[]> {
  let last: unknown;
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: 'POST', body: new URLSearchParams({ data: q }),
        headers: { 'user-agent': 'quorum-bot (github.com/ArqamWaheed/quorum)' },
        signal: AbortSignal.timeout(40_000),
      });
      if (!r.ok) throw new Error(`overpass ${r.status} at ${new URL(url).host}`);
      const seen = new Set<string>();
      return ((await r.json()) as any).elements
        .map((e: any) => ({ name: e.tags.name, kind: e.tags.leisure ?? e.tags.route ?? e.tags.tourism,
          lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, toilets: e.tags.toilets, wheelchair: e.tags.wheelchair }))
        .filter((s: Spot) => s.name && !GENERIC.test(s.name.trim()) && !seen.has(s.name) && seen.add(s.name));
    } catch (e) { last = e; console.error('overpass:', (e as Error).message); }
  }
  throw last ?? new Error('overpass: no mirrors');
}

const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return Math.hypot(x, y) * 6371;
};
const GENERIC = /^(park|garden|playground|viewpoint|view point|nature reserve|green belt|green area|ground)$/i;

// Fallback when every Overpass mirror is down: Photon (komoot), a geocoder over the same OSM data.
async function photon(lat: number, lon: number, radiusM: number): Promise<Spot[]> {
  const tags = [['park', 'leisure:park'], ['nature reserve', 'leisure:nature_reserve'], ['viewpoint', 'tourism:viewpoint'], ['trail', 'route:hiking']];
  const seen = new Set<string>();
  const out: Spot[] = [];
  for (const [q, tag] of tags) {
    const u = new URL('https://photon.komoot.io/api/');
    u.search = new URLSearchParams({ q, lat: `${lat}`, lon: `${lon}`, limit: '50', osm_tag: tag }).toString();
    const r = await fetch(u, { headers: { 'user-agent': 'quorum-bot (github.com/ArqamWaheed/quorum)' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) continue;
    for (const f of ((await r.json()) as any).features ?? []) {
      const name = f.properties?.name, [flon, flat] = f.geometry?.coordinates ?? [];
      if (!name || GENERIC.test(name.trim()) || seen.has(name) || km(lat, lon, flat, flon) * 1000 > radiusM) continue;
      seen.add(name);
      out.push({ name, kind: f.properties.osm_value, lat: flat, lon: flon });
    }
  }
  if (!out.length) throw new Error('photon: no named spots');
  return out;
}

// Real named spots near home from OpenStreetMap.
export async function places(lat: number, lon: number, radiusM = 25_000): Promise<Spot[]> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusM}`;
  if (mem.has(key)) return mem.get(key)!;
  const col = process.env.MONGODB_URI ? (await db()).collection<any>('places_cache') : undefined;
  const cached = await col?.findOne({ _id: key }).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt.getTime() < FRESH_MS) { mem.set(key, cached.spots); return cached.spots; }
  const a = `(around:${radiusM},${lat},${lon})`;
  const q = `[out:json][timeout:35];(nwr${a}[leisure~"^(park|nature_reserve)$"][name];` +
            `nwr${a}[route=hiking][name];nwr${a}[tourism=viewpoint][name];);out center tags 60;`;
  try {
    const spots = await overpass(q).catch((e) => { console.error(e.message, '→ trying photon'); return photon(lat, lon, radiusM); });
    mem.set(key, spots);
    await col?.updateOne({ _id: key }, { $set: { spots, fetchedAt: new Date() } }, { upsert: true }).catch(() => undefined);
    return spots;
  } catch (e) {
    if (cached) return cached.spots; // stale beats nothing
    throw e;
  }
}

export const placesTool = createTool({
  id: 'places',
  description: 'Named parks, hiking routes and viewpoints within radiusM of a lat/lon',
  inputSchema: z.object({ lat: z.number(), lon: z.number(), radiusM: z.number().max(40_000).default(25_000) }),
  execute: async ({ lat, lon, radiusM }) => ({ spots: (await places(lat, lon, radiusM)).slice(0, 25) }),
});
