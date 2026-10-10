import type { Agent } from '@mastra/core/agent';
import { PlanOptions, type Option, type RosterLine, type Home } from '../shared/schema';
import { forecast, type Hour } from './tools/weather';
import { places, type Spot } from './tools/places';

// Gemini free tier: 429 = rate limit, 500 "Internal error encountered" / 503 = overloaded. Worth retrying.
export const isTransient = (e: unknown) =>
  /429|quota|rate.?limit|resource.?exhausted|internal error|overloaded|unavailable|503|500/i.test(String((e as Error)?.message ?? e));

export const toolMode = () => (process.env.TOOL_MODE === 'prefetch' ? 'prefetch' : 'native');

export const rosterText = (r: RosterLine[]) =>
  r.map((m) => `- ${m.name}: ${m.constraints.join('; ') || 'no constraints'}`).join('\n');

export interface DraftResult {
  options: Option[];
  toolCalls: number;
  invented: number; // options dropped because `where` was not a places() name
  fallback: boolean; // true if code had to build options itself
  mode: 'native' | 'prefetch';
  ms: number;
}

const rainAt = (hours: Hour[], start: string, durationH: number) =>
  Math.max(0, ...hours.filter((h) => h.t >= start).slice(0, Math.ceil(durationH)).map((h) => h.rain));

// Last resort when Gemma's JSON is unusable: two honest options from the top places() results.
function codeFallback(spots: Spot[], hours: Hour[], roster: RosterLine[]): Option[] {
  const all = roster.flatMap((m) => m.constraints.map((c) => `${m.name}: ${c}`));
  return spots.slice(0, 2).map((s, i) => {
    const start = i === 0 ? '07:00' : '08:30';
    return {
      title: `${i === 0 ? 'Early walk' : 'Easy morning'} at ${s.name}`.slice(0, 90),
      where: s.name, start, durationH: 2,
      shapedBy: all.length ? all : ['no constraints given'],
      weatherNote: hours.length ? `max rain ${rainAt(hours, start, 2)}% (auto-built option)` : 'no forecast (auto-built option)',
    };
  });
}

export async function draftOptions(agent: Agent, args: {
  date: string; roster: RosterLine[]; home: Home; memory?: { resource: string; thread: string }; extra?: string;
}): Promise<DraftResult> {
  const { date, roster, home } = args;
  const mode = toolMode();
  const t0 = Date.now();
  // Fetched in code either way: prefetch puts them in the prompt; native uses them to validate names.
  const [spots, hours] = await Promise.all([
    places(home.lat, home.lon).catch(() => [] as Spot[]),
    forecast(home.lat, home.lon, date).catch(() => [] as Hour[]),
  ]);
  let prompt = `Outing date ${date}. Home lat ${home.lat}, lon ${home.lon}.\nRoster:\n${rosterText(roster)}\n`;
  if (args.extra) prompt += `${args.extra}\n`;
  if (mode === 'prefetch') {
    prompt += `WEATHER (hourly, local) ${JSON.stringify(hours)}\nSPOTS ${JSON.stringify(spots.slice(0, 25))}\n`;
  }
  prompt += 'Draft the options.';

  let options: Option[] = [];
  let toolCalls = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await agent.generate(prompt, {
        maxSteps: 6,
        ...(args.memory ? { memory: args.memory } : {}),
        structuredOutput: { schema: PlanOptions, jsonPromptInjection: true },
      });
      toolCalls = res.steps?.reduce((n: number, s: any) => n + (s.toolCalls?.length ?? 0), 0) ?? res.toolCalls?.length ?? 0;
      options = (res.object as any)?.options ?? [];
      break;
    } catch (e) {
      console.error(`draft generate attempt ${attempt} failed:`, (e as Error).message);
      if (isTransient(e)) { if (attempt < 3) continue; throw e; } // Gemini 500s/429s: retry here, then let Temporal retry
      break; // bad JSON etc.: fall through to validation + code fallback
    }
  }

  const names = new Set(spots.map((s) => s.name));
  const real = spots.length ? options.filter((o) => names.has(o.where)) : options;
  const invented = options.length - real.length;
  let fallback = false;
  if (real.length < 2) {
    fallback = true;
    const used = new Set(real.map((o) => o.where));
    real.push(...codeFallback(spots.filter((s) => !used.has(s.name)), hours, roster).slice(0, 2 - real.length));
  }
  if (real.length < 2) throw new Error('no usable options and no places to fall back on');
  return { options: real.slice(0, 3), toolCalls, invented, fallback, mode, ms: Date.now() - t0 };
}

export { rainAt };
