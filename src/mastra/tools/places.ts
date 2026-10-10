import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export type Spot = { name: string; kind: string; lat?: number; lon?: number; toilets?: string; wheelchair?: string };

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const cache = new Map<string, { at: number; spots: Spot[] }>(); // Overpass is shared; don't hammer it

// Real named spots near home from OpenStreetMap (Overpass).
export async function places(lat: number, lon: number, radiusM = 25_000): Promise<Spot[]> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusM}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3_600_000) return hit.spots;
  const a = `(around:${radiusM},${lat},${lon})`;
  const q = `[out:json][timeout:25];(nwr${a}[leisure~"^(park|nature_reserve)$"][name];` +
            `nwr${a}[route=hiking][name];nwr${a}[tourism=viewpoint][name];);out center tags 40;`;
  const r = await fetch(OVERPASS, {
    method: 'POST', body: new URLSearchParams({ data: q }),
    headers: { 'user-agent': 'quorum-bot (github.com/ArqamWaheed/quorum)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const seen = new Set<string>();
  const spots: Spot[] = ((await r.json()) as any).elements
    .map((e: any) => ({ name: e.tags.name, kind: e.tags.leisure ?? e.tags.route ?? e.tags.tourism,
      lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, toilets: e.tags.toilets, wheelchair: e.tags.wheelchair }))
    .filter((s: Spot) => s.name && !seen.has(s.name) && seen.add(s.name));
  cache.set(key, { at: Date.now(), spots });
  return spots;
}

export const placesTool = createTool({
  id: 'places',
  description: 'Named parks, hiking routes and viewpoints within radiusM of a lat/lon',
  inputSchema: z.object({ lat: z.number(), lon: z.number(), radiusM: z.number().max(40_000).default(25_000) }),
  execute: async ({ lat, lon, radiusM }) => ({ spots: (await places(lat, lon, radiusM)).slice(0, 25) }),
});
