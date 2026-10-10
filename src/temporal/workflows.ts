// FROZEN at git tag `real-run-start` (Temporal determinism). After that: wf.patched() or a new workflow type.
import * as wf from '@temporalio/workflow';
import type { RetryPolicy } from '@temporalio/common';
import type * as acts from './activities';
import type { Option, Recap, Vote } from '../shared/schema';

// Calls that cross the internet to Render/Gemma: fail fast (fetch timeout inside), retry patiently.
const retry: RetryPolicy = { initialInterval: '5 seconds', backoffCoefficient: 2, maximumInterval: '2 minutes',
  maximumAttempts: 12, nonRetryableErrorTypes: ['BadRequest'] };
const remote = wf.proxyActivities<typeof acts>({ startToCloseTimeout: '60 seconds', retry });
const drafting = wf.proxyActivities<typeof acts>({ startToCloseTimeout: '150 seconds', retry }); // Gemma + tools is slow
const chat = wf.proxyActivities<typeof acts>({ startToCloseTimeout: '20 seconds', retry: { maximumAttempts: 6 } });

export const vote = wf.defineSignal<[Vote]>('vote');
export const recap = wf.defineSignal<[Recap]>('recap');
export const phaseQuery = wf.defineQuery<string>('phase');

// Every time is an absolute ms timestamp computed by the client (bot). No time math in here.
export interface PlanInput {
  planId: string; chatId: string; date: string; quorum: number;
  pollCloseAt: number; weatherCheckAt: number; reminderAt: number; outingEndAt: number; recapUntil: number;
}

const until = (t: number) => Math.max(1_000, t - Date.now()); // workflow Date.now() is deterministic

function tally(votes: Map<string, number[]>, n: number) {
  const counts = Array<number>(n).fill(0);
  for (const ids of votes.values()) for (const i of ids) if (i < n) counts[i]++; // index n = "can't make it"
  const index = counts.indexOf(Math.max(...counts));
  return { index, count: counts[index] ?? 0, counts };
}

export async function planOuting(p: PlanInput): Promise<string> {
  let phase = 'drafting';
  const votes = new Map<string, number[]>();
  const recaps = new Map<string, Recap>();
  wf.setHandler(phaseQuery, () => phase);
  wf.setHandler(vote, (v) => { if (v.optionIds.length) votes.set(v.userId, v.optionIds); else votes.delete(v.userId); });
  wf.setHandler(recap, (r) => { recaps.set(r.userId, r); });

  let options: Option[];
  try {
    options = await drafting.draftPlans(p); // Render + Gemma
  } catch {
    phase = 'draft-failed'; await chat.announce(p, 'draft-failed', {}); return phase;
  }
  await chat.sendPoll(p.planId, p.chatId, options);
  phase = 'voting';
  const reached = await wf.condition(() => tally(votes, options.length).count >= p.quorum, until(p.pollCloseAt));
  await chat.closePoll(p.planId);
  const t = tally(votes, options.length);
  if (!reached) { phase = 'no-quorum'; await chat.announce(p, 'no-quorum', { count: t.count, counts: t.counts }); return phase; }

  let plan = options[t.index];
  phase = 'locked';
  await chat.announce(p, 'locked', { plan, counts: t.counts });

  await wf.sleep(until(p.weatherCheckAt)); // hours: poll close → 05:30
  let wx: { go: boolean; maxRain?: number; fallback?: Option } = { go: true };
  try {
    wx = await remote.recheckWeather(p, plan, options.filter((_, i) => i !== t.index)); // Render asleep → retries
  } catch {
    wx = { go: true }; // weather unknown: keep the plan, say so in the reminder
  }
  const switched = !wx.go && !!wx.fallback;
  if (switched) { plan = wx.fallback!; phase = 'fallback'; }

  await wf.sleep(until(p.reminderAt)); // 06:00 local
  await chat.announce(p, 'reminder', { plan, maxRain: wx.maxRain, switched });

  await wf.sleep(until(p.outingEndAt));
  phase = 'recap';
  await chat.announce(p, 'recap-ask', {});
  const want = Math.max(1, Math.min(p.quorum, t.count));
  await wf.condition(() => recaps.size >= want, until(p.recapUntil));
  if (recaps.size) {
    try { await remote.storeRecap(p, plan, [...recaps.values()]); } catch { /* recaps are in Atlas; memory write is best effort */ }
  }
  phase = 'done';
  await chat.announce(p, 'done', { recaps: recaps.size });
  return phase;
}
