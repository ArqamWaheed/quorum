import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export type Hour = { t: string; rain: number; temp: number; wind: number };

export async function forecast(lat: number, lon: number, date: string): Promise<Hour[]> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({
    latitude: `${lat}`, longitude: `${lon}`, start_date: date, end_date: date,
    hourly: 'precipitation_probability,temperature_2m,wind_speed_10m', timezone: 'auto',
  }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const h = ((await r.json()) as any).hourly;
  return h.time
    .map((t: string, i: number) => ({ t: t.slice(11, 16), rain: h.precipitation_probability[i] ?? 0,
      temp: h.temperature_2m[i], wind: h.wind_speed_10m[i] }))
    .filter((x: Hour) => x.t >= '06:00' && x.t <= '18:00');
}

export const weatherTool = createTool({
  id: 'weather',
  description: 'Hourly rain %, °C and wind km/h for a lat/lon on YYYY-MM-DD (06–18 local)',
  inputSchema: z.object({ lat: z.number(), lon: z.number(), date: z.string() }),
  execute: async ({ lat, lon, date }) => ({ hours: await forecast(lat, lon, date) }),
});
