import { createHash } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '../../shared/db';

// SerpApi free tier = 250 searches/month. Cached 12 h (TTL index on serp_cache.fetchedAt).
// Exposed to the real group only, never to /try.
export const liveCheckTool = createTool({
  id: 'liveCheck',
  description: 'Search the web for closures/events at a named place this week (cached 12 h)',
  inputSchema: z.object({ query: z.string().max(120) }),
  execute: async ({ query }) => {
    const col = (await db()).collection<{ _id: string; results: unknown[] }>('serp_cache');
    const _id = createHash('sha1').update(query.toLowerCase()).digest('hex');
    const hit = await col.findOne({ _id });
    if (hit) return { cached: true, results: hit.results };
    const u = new URL('https://serpapi.com/search.json');
    u.search = new URLSearchParams({ engine: 'google', q: query, num: '5', api_key: process.env.SERPAPI_KEY! }).toString();
    const r = await fetch(u, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`serpapi ${r.status}`);
    const j: any = await r.json();
    const results = (j.organic_results ?? []).slice(0, 5).map((o: any) => ({ title: o.title, snippet: o.snippet, date: o.date }));
    await col.updateOne({ _id }, { $set: { query, results, fetchedAt: new Date() } }, { upsert: true });
    return { cached: false, results };
  },
});
