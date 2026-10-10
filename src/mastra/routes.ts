import { createHash } from 'node:crypto';
import { registerApiRoute } from '@mastra/core/server';
import { PlanOption, type RosterLine, type Home, type Option } from '../shared/schema';
import { db } from '../shared/db';
import { fmtLocal } from '../shared/time';
import { forecast } from './tools/weather';
import { draftOptions, rainAt, toolMode } from './draft';
import { landingPage, notFoundPage, planPage, tryPage } from './pages';

const ok = (c: any) => !!process.env.QUORUM_SHARED_SECRET && c.req.header('x-quorum-secret') === process.env.QUORUM_SHARED_SECRET;
const agent = (c: any, id: string) => c.get('mastra').getAgentById(id);
const isRateLimit = (e: unknown) => /429|quota|rate.?limit|resource.?exhausted/i.test(String((e as Error)?.message ?? e));

// Gemma's 429s become 503 so the Temporal activity retries; real bugs stay 500.
function fail(c: any, e: unknown) {
  console.error(e);
  return c.json({ error: String((e as Error)?.message ?? e) }, isRateLimit(e) ? 503 : 500);
}

async function geocode(place: string): Promise<(Home & { name: string }) | null> {
  const m = place.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) return { lat: Number(m[1]), lon: Number(m[2]), name: `${m[1]}, ${m[2]}` };
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.search = new URLSearchParams({ name: place, count: '1', format: 'json' }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  const g = r.ok ? ((await r.json()) as any).results?.[0] : undefined;
  return g ? { lat: g.latitude, lon: g.longitude, name: [g.name, g.country].filter(Boolean).join(', ') } : null;
}

const tryHits = new Map<string, number[]>(); // fallback when Atlas is not configured
async function allowTry(ipHash: string) {
  try {
    const col = (await db()).collection('try_hits');
    const n = await col.countDocuments({ ipHash, at: { $gt: new Date(Date.now() - 3_600_000) } });
    if (n >= 5) return false;
    await col.insertOne({ ipHash, at: new Date() });
    return true;
  } catch {
    const xs = (tryHits.get(ipHash) ?? []).filter((t) => t > Date.now() - 3_600_000);
    if (xs.length >= 5) return false;
    tryHits.set(ipHash, [...xs, Date.now()]);
    return true;
  }
}

const html = (c: any, body: string, status = 200) => c.html(body, status);

export const routes = [
  // The draft endpoint the Temporal activity calls.
  registerApiRoute('/quorum/draft', {
    method: 'POST', requiresAuth: false,
    handler: async (c) => {
      if (!ok(c)) return c.json({ error: 'unauthorized' }, 401);
      const { chatId, date, roster, home } = (await c.req.json()) as { chatId: string; date: string; roster: RosterLine[]; home: Home };
      if (!chatId || !date || !home) return c.json({ error: 'chatId, date and home are required' }, 400);
      try {
        const res = await draftOptions(agent(c, toolMode() === 'prefetch' ? 'quorum-notools' : 'quorum'), {
          date, roster, home, memory: { resource: `chat:${chatId}`, thread: `plan:${chatId}:${date}` },
        });
        return c.json(res);
      } catch (e) { return fail(c, e); }
    },
  }),

  // A /me line or a recap, stored as a message → embedded → recallable by later drafts.
  registerApiRoute('/quorum/remember', {
    method: 'POST', requiresAuth: false,
    handler: async (c) => {
      if (!ok(c)) return c.json({ error: 'unauthorized' }, 401);
      const { chatId, name, text, thread } = await c.req.json();
      try {
        const res = await agent(c, 'quorum-notools').generate(
          `${name} says: "${text}". Acknowledge in under 12 words. Do not plan anything.`,
          { memory: { resource: `chat:${chatId}`, thread: thread ?? `roster:${chatId}` } });
        return c.json({ reply: res.text });
      } catch (e) { return fail(c, e); }
    },
  }),

  // Weather re-check: the RULE is code, the ALTERNATIVE is Gemma.
  registerApiRoute('/quorum/recheck', {
    method: 'POST', requiresAuth: false,
    handler: async (c) => {
      if (!ok(c)) return c.json({ error: 'unauthorized' }, 401);
      const { chatId, date, chosen, alternatives, home } = (await c.req.json()) as
        { chatId: string; date: string; chosen: Option; alternatives: Option[]; home: Home };
      try {
        const hours = await forecast(home.lat, home.lon, date);
        const maxRain = rainAt(hours, chosen.start, chosen.durationH);
        if (maxRain < Number(process.env.RAIN_LIMIT ?? 50)) return c.json({ go: true, maxRain });
        let fallback: Option | undefined;
        try {
          const res = await agent(c, 'quorum-notools').generate(
            `Rain ${maxRain}% is forecast during "${chosen.title}" at ${chosen.where}. Hourly forecast: ${JSON.stringify(hours)}.\n` +
            `Pick the best of these alternatives, or adapt one (earlier start, shorter, covered spot) to dodge the rain. ` +
            `Keep "where" exactly as written in the alternatives or the chosen plan:\n${JSON.stringify([chosen, ...alternatives])}`,
            { memory: { resource: `chat:${chatId}`, thread: `plan:${chatId}:${date}` },
              structuredOutput: { schema: PlanOption, jsonPromptInjection: true },
              abortSignal: AbortSignal.timeout(20_000) }); // keep the route under the activity's 30 s fetch timeout
          const o = res.object as Option | undefined;
          const known = new Set([chosen, ...alternatives].map((x) => x.where));
          if (o && known.has(o.where)) fallback = o;
        } catch (e) { if (isRateLimit(e)) throw e; }
        // Code fallback: the alternative with the least rain in its window.
        fallback ??= [...alternatives].sort((a, b) => rainAt(hours, a.start, a.durationH) - rainAt(hours, b.start, b.durationH))[0];
        return c.json({ go: false, maxRain, fallback });
      } catch (e) { return fail(c, e); }
    },
  }),

  // Public plan page: status timeline + attempt log. Names only if PUBLIC_NAMES=on (group consented).
  registerApiRoute('/p/:id', {
    method: 'GET', requiresAuth: false,
    handler: async (c) => {
      try {
        const d = await db();
        const id = c.req.param('id');
        const p = await d.collection<any>('plans').findOne({ _id: id });
        if (!p) return html(c, notFoundPage(), 404);
        const recapCount = await d.collection('recaps').countDocuments({ planId: id });
        return html(c, planPage({ ...p, recapCount, tz: process.env.GROUP_UTC_OFFSET ?? '+05:00' }, fmtLocal, process.env.PUBLIC_NAMES === 'on'));
      } catch (e) { console.error(e); return html(c, notFoundPage(), 503); }
    },
  }),

  registerApiRoute('/try', { method: 'GET', requiresAuth: false, handler: async (c) => html(c, tryPage()) }),

  // Judge demo: same draft() with no memory and no SerpApi. 5/hour/IP.
  registerApiRoute('/try', {
    method: 'POST', requiresAuth: false,
    handler: async (c) => {
      const ip = (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
      const ipHash = createHash('sha1').update(ip).digest('hex').slice(0, 16);
      if (!(await allowTry(ipHash))) return c.json({ error: 'That’s five drafts this hour. Try again later, or watch the video.' }, 429);
      const { people = '', place = '', date = '' } = await c.req.json().catch(() => ({}));
      const roster: RosterLine[] = String(people).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => {
        const [name, ...rest] = l.split(':');
        return { name: name.trim().slice(0, 30), constraints: rest.join(':').split(';').map((s) => s.trim().slice(0, 120)).filter(Boolean).slice(0, 4) };
      });
      if (!roster.length) return c.json({ error: 'Add at least one person, like “Sara: no car”.' }, 400);
      const dt = Date.parse(`${date}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dt < Date.now() - 864e5 || dt > Date.now() + 14 * 864e5)
        return c.json({ error: 'Pick a date between today and 14 days from now: that’s as far as the forecast goes.' }, 400);
      const home = await geocode(String(place).slice(0, 80)).catch(() => null);
      if (!home) return c.json({ error: `Couldn’t find “${place}”. Try a bigger nearby city, or “lat, lon”.` }, 400);
      try {
        const res = await draftOptions(agent(c, toolMode() === 'prefetch' ? 'quorum-notools' : 'quorum-try'), {
          date, roster, home: { lat: home.lat, lon: home.lon },
        });
        return c.json({ ...res, placeName: home.name });
      } catch (e) {
        console.error(e);
        if (isRateLimit(e)) return c.json({ error: 'The free Gemma quota is resting. Try again in a minute, or watch the video.' }, 503);
        return c.json({ error: 'Drafting failed. Try a different place or date.' }, 500);
      }
    },
  }),

  registerApiRoute('/', {
    method: 'GET', requiresAuth: false,
    handler: async (c) => html(c, landingPage(process.env.VIDEO_URL, process.env.FEATURED_PLAN_ID)),
  }),
];
