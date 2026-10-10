// Gate 1: 20 drafts with a fixed 5-person FAKE roster at 4 home locations × 5 dates. No real data.
// Records: tool calls > 0? valid PlanOptions JSON? every `where` ∈ places() names? latency.
// Usage: npm run smoke [-- --mode prefetch] [-- --n 6]. Swap QUORUM_MODEL to compare models.
import { quorumTry, quorumNoTools } from '../src/mastra/agents/quorum';
import { PlanOptions, type RosterLine } from '../src/shared/schema';
import { places } from '../src/mastra/tools/places';
import { forecast } from '../src/mastra/tools/weather';
import { rosterText } from '../src/mastra/draft';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const mode = arg('mode') === 'prefetch' ? 'prefetch' : 'native';
const n = Number(arg('n') ?? 20);
const pause = Number(arg('pause') ?? 4000); // free tier: be gentle

const roster: RosterLine[] = [
  { name: 'Sara', constraints: ['knee hates long descents'] },
  { name: 'Omar', constraints: ['no car', 'home by 11'] },
  { name: 'Lina', constraints: ['broke this month'] },
  { name: 'Tom', constraints: ['wants a view'] },
  { name: 'Ayesha', constraints: [] },
];
const homes = [
  { city: 'Lahore', lat: 31.5204, lon: 74.3587 },
  { city: 'Islamabad', lat: 33.6844, lon: 73.0479 },
  { city: 'Berlin', lat: 52.52, lon: 13.405 },
  { city: 'Seattle', lat: 47.6062, lon: -122.3321 },
];
const dates = [1, 2, 3, 4, 5].map((d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10));
const cases = homes.flatMap((h) => dates.map((date) => ({ ...h, date }))).slice(0, n);

const agent = mode === 'prefetch' ? quorumNoTools : quorumTry;
const model = process.env.QUORUM_MODEL ?? 'google/gemma-4-31b-it';
console.log(`model ${model} · mode ${mode} · ${cases.length} cases`);

type Row = { i: number; city: string; date: string; tools: number; valid: boolean; invented: number; ms: number; err?: string };
const rows: Row[] = [];
for (const [i, c] of cases.entries()) {
  const spots = await places(c.lat, c.lon).catch(() => []);
  const names = new Set(spots.map((s) => s.name));
  let prompt = `Outing date ${c.date}. Home lat ${c.lat}, lon ${c.lon}.\nRoster:\n${rosterText(roster)}\n`;
  if (mode === 'prefetch') prompt += `WEATHER ${JSON.stringify(await forecast(c.lat, c.lon, c.date).catch(() => []))}\nSPOTS ${JSON.stringify(spots.slice(0, 25))}\n`;
  prompt += 'Draft the options.';
  const t0 = Date.now();
  try {
    const r = await agent.generate(prompt, { maxSteps: 6, structuredOutput: { schema: PlanOptions, jsonPromptInjection: true } });
    const tools = r.steps?.reduce((k: number, s: any) => k + (s.toolCalls?.length ?? 0), 0) ?? 0;
    const opts = (r.object as any)?.options;
    const valid = PlanOptions.safeParse(r.object).success;
    rows.push({ i, city: c.city, date: c.date, tools, valid, invented: valid ? opts.filter((o: any) => !names.has(o.where)).length : NaN, ms: Date.now() - t0 });
  } catch (e) {
    rows.push({ i, city: c.city, date: c.date, tools: 0, valid: false, invented: NaN, ms: Date.now() - t0, err: String((e as Error).message).slice(0, 80) });
  }
  console.log(JSON.stringify(rows.at(-1)));
  if (i < cases.length - 1) await new Promise((r) => setTimeout(r, pause));
}
console.table(rows);
const pass = rows.filter((r) => r.valid && (mode === 'prefetch' || r.tools > 0)).length;
const invented = rows.reduce((k, r) => k + (Number.isNaN(r.invented) ? 0 : r.invented), 0);
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const median = ms[Math.floor(ms.length / 2)] ?? 0;
const threshold = Math.ceil(cases.length * 0.8);
console.log(`\n${model} · ${mode}: validity ${pass}/${cases.length} · invented places ${invented} · median ${(median / 1000).toFixed(1)} s`);
if (mode === 'native') console.log(pass >= threshold ? 'Gate 1 PASS → TOOL_MODE=native' : 'Gate 1 FAIL → TOOL_MODE=prefetch');
process.exit(0);
