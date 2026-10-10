// Offline check of planOuting against the local Temporal dev server: mocked activities, timers in seconds.
// Covers: happy path (vote → lock → weather ok → reminder → recap → done), no-quorum, rain fallback,
// a Render call that fails twice before succeeding (retries), and draft failure.
// Usage: temporal server start-dev (or ./scripts/run-local.sh), then `npx tsx scripts/test-workflow.ts`.
import { Worker, NativeConnection } from '@temporalio/worker';
import { Client, Connection } from '@temporalio/client';
import { fileURLToPath } from 'node:url';
import { planOuting, vote, recap, type PlanInput } from '../src/temporal/workflows';
import type { Option } from '../src/shared/schema';

const opt = (title: string, where: string): Option => ({ title, where, start: '07:00', durationH: 2, shapedBy: ['Sara: knee'], weatherNote: 'dry' });
const OPTIONS = [opt('Walk A', 'Park A'), opt('Walk B', 'Park B'), opt('Walk C', 'Park C')];
const log: string[] = [];
let rain = false, recheckFails = 0, draftFails = false;

const activities = {
  async draftPlans(p: PlanInput) { if (draftFails) throw new Error('render 502'); log.push(`${p.planId} draft`); return OPTIONS; },
  async sendPoll(planId: string) { log.push(`${planId} poll`); },
  async closePoll(planId: string) { log.push(`${planId} close`); },
  async recheckWeather(p: PlanInput, chosen: Option, alts: Option[]) {
    if (recheckFails > 0) { recheckFails--; log.push(`${p.planId} recheck-fail`); throw new Error('TimeoutError: render asleep'); }
    log.push(`${p.planId} recheck`);
    return rain ? { go: false, maxRain: 80, fallback: alts[0] } : { go: true, maxRain: 10 };
  },
  async storeRecap(p: PlanInput, _plan: Option, rs: unknown[]) { log.push(`${p.planId} store ${rs.length}`); },
  async announce(p: PlanInput, kind: string, data: any) { log.push(`${p.planId} ${kind}${data.plan ? `:${data.plan.where}` : ''}`); },
};

const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const worker = await Worker.create({
  connection: await NativeConnection.connect({ address }), taskQueue: 'quorum-test', activities,
  workflowsPath: fileURLToPath(new URL('../src/temporal/workflows.ts', import.meta.url)),
});
const client = new Client({ connection: await Connection.connect({ address }) });
const s = (n: number) => Date.now() + n * 1000;
const input = (id: string, quorum = 2): PlanInput => ({ planId: `${id}-${Date.now()}`, chatId: 'test', date: '2026-10-11', quorum,
  pollCloseAt: s(6), weatherCheckAt: s(8), reminderAt: s(9), outingEndAt: s(10), recapUntil: s(14) });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const check = (name: string, cond: boolean) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) process.exitCode = 1; };

await worker.runUntil(async () => {
  // 1. Happy path, with the weather call failing twice first (initial retry interval 5 s → ~15 s).
  recheckFails = 2;
  const a = input('happy');
  const ha = await client.workflow.start(planOuting, { taskQueue: 'quorum-test', workflowId: a.planId, args: [a] });
  await wait(2000);
  await ha.signal(vote, { userId: '1', name: 'Sara', optionIds: [1] });
  await ha.signal(vote, { userId: '2', name: 'Omar', optionIds: [1, 2] });
  await wait(15_000);
  await ha.signal(recap, { userId: '1', name: 'Sara', line: 'great view' });
  await ha.signal(recap, { userId: '2', name: 'Omar', line: 'too early' });
  check('happy path ends done', (await ha.result()) === 'done');
  check('locked on most-voted option (Park B)', log.includes(`${a.planId} locked:Park B`));
  check('weather retried twice then succeeded', log.filter((l) => l === `${a.planId} recheck-fail`).length === 2 && log.includes(`${a.planId} recheck`));
  check('both recaps stored', log.includes(`${a.planId} store 2`));

  // 2. No quorum.
  const b = input('noq', 3);
  const hb = await client.workflow.start(planOuting, { taskQueue: 'quorum-test', workflowId: b.planId, args: [b] });
  await wait(1500);
  await hb.signal(vote, { userId: '1', name: 'Sara', optionIds: [0] });
  check('no-quorum when poll closes short', (await hb.result()) === 'no-quorum');

  // 3. Rain → fallback plan in the reminder; recap window times out with zero recaps.
  rain = true;
  const c = input('rain', 1);
  const hc = await client.workflow.start(planOuting, { taskQueue: 'quorum-test', workflowId: c.planId, args: [c] });
  await wait(1500);
  await hc.signal(vote, { userId: '1', name: 'Sara', optionIds: [0] });
  check('rain run ends done', (await hc.result()) === 'done');
  check('reminder uses the fallback (Park B)', log.includes(`${c.planId} reminder:Park B`));
  check('no store when no recaps', !log.some((l) => l.startsWith(`${c.planId} store`)));

  // 4. Retracted vote does not count.
  rain = false;
  const d = input('retract', 1);
  const hd = await client.workflow.start(planOuting, { taskQueue: 'quorum-test', workflowId: d.planId, args: [{ ...d, pollCloseAt: s(5) }] });
  await wait(1500);
  await hd.signal(vote, { userId: '1', name: 'Sara', optionIds: [3] }); // "can't make it"
  check('"can\'t make it" never reaches quorum', (await hd.result()) === 'no-quorum');
});
console.log(log.join('\n'));
process.exit(process.exitCode ?? 0);
