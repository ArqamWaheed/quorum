import { Context, ApplicationFailure } from '@temporalio/activity';
import { db, roster, logEvent } from '../shared/db';
import type { PlanInput } from './workflows';
import type { Option, Recap } from '../shared/schema';

const HOME = () => ({ lat: Number(process.env.HOME_LAT), lon: Number(process.env.HOME_LON) });

// Every attempt is written to plans.events (Temporal only records the last attempt in history).
async function render(planId: string, path: string, body: unknown, timeoutMs: number): Promise<any> {
  const { attempt, activityType } = Context.current().info;
  const t0 = Date.now();
  try {
    const r = await fetch(`${process.env.RENDER_URL}${path}`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-quorum-secret': process.env.QUORUM_SHARED_SECRET ?? '' },
      signal: AbortSignal.timeout(timeoutMs), // fail fast; Temporal retries (Render cold start ≈ 1 min)
    });
    if (r.status === 400 || r.status === 401)
      throw ApplicationFailure.create({ type: 'BadRequest', message: `render ${r.status}: ${await r.text()}`, nonRetryable: true });
    if (!r.ok) throw new Error(`render ${r.status}`); // 5xx while waking, 503 = Gemma rate limit
    const json = await r.json();
    await logEvent(planId, activityType, `attempt ${attempt} ok in ${Date.now() - t0} ms`);
    return json;
  } catch (e: any) {
    await logEvent(planId, activityType, `attempt ${attempt} failed after ${Date.now() - t0} ms: ${e.name}: ${e.message}`).catch(() => undefined);
    throw e;
  }
}

const plans = async () => (await db()).collection<any>('plans');

export async function draftPlans(p: PlanInput): Promise<Option[]> {
  const home = HOME();
  if (!Number.isFinite(home.lat) || !Number.isFinite(home.lon))
    throw ApplicationFailure.create({ type: 'BadRequest', message: 'HOME_LAT/HOME_LON not set', nonRetryable: true });
  const res = await render(p.planId, '/quorum/draft', { chatId: p.chatId, date: p.date, roster: await roster(p.chatId), home }, 90_000);
  if (res.fallback || res.invented)
    await logEvent(p.planId, 'draftQuality', `${res.toolCalls} tool calls, ${res.invented} invented places dropped${res.fallback ? ', code-built fallback used' : ''} (${res.mode})`);
  await (await plans()).updateOne({ _id: p.planId }, {
    $set: { chatId: p.chatId, date: p.date, quorum: p.quorum, status: 'voting', options: res.options, counts: res.options.map(() => 0),
      schedule: { pollCloseAt: p.pollCloseAt, weatherCheckAt: p.weatherCheckAt, reminderAt: p.reminderAt, outingEndAt: p.outingEndAt } },
  }, { upsert: true });
  return res.options;
}

export async function recheckWeather(p: PlanInput, chosen: Option, alternatives: Option[]) {
  const res = await render(p.planId, '/quorum/recheck', { chatId: p.chatId, date: p.date, chosen, alternatives, home: HOME() }, 30_000);
  await (await plans()).updateOne({ _id: p.planId }, {
    $set: { weather: { checkedAt: new Date(), maxRain: res.maxRain, go: res.go }, ...(res.go ? {} : { chosen: res.fallback, status: 'fallback' }) },
  });
  return res as { go: boolean; maxRain: number; fallback?: Option };
}

export async function storeRecap(p: PlanInput, plan: Option, recaps: Recap[]) {
  const col = (await db()).collection<any>('recaps');
  await col.bulkWrite(recaps.map((r) => ({
    updateOne: { filter: { _id: `${p.planId}:${r.userId}` },
      update: { $set: { ...r, planId: p.planId, chatId: p.chatId, at: new Date() } }, upsert: true },
  })));
  const text = `Recap of "${plan.title}" at ${plan.where} on ${p.date}: ` + recaps.map((r) => `${r.name}: ${r.line}`).join(' | ');
  await render(p.planId, '/quorum/remember', { chatId: p.chatId, name: 'The group', text, thread: `recap:${p.chatId}:${p.date}` }, 30_000);
}

// ---- Telegram ----
async function tg(method: string, body: object) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  const j: any = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}

const optionLine = (o: Option, i: number) =>
  `${i + 1}. ${o.title}\n   ${o.where}, ${o.start} for ${o.durationH} h. ${o.weatherNote}` +
  (o.shapedBy.length ? `\n   Shaped by: ${o.shapedBy.join('; ')}` : '');

export async function sendPoll(planId: string, chatId: string, options: Option[]) {
  const polls = (await db()).collection<any>('polls');
  if (await polls.findOne({ planId })) return; // already sent (activity retry)
  await tg('sendMessage', { chat_id: chatId, text: `Here are the options:\n\n${options.map(optionLine).join('\n\n')}` });
  const m = await tg('sendPoll', {
    chat_id: chatId, question: 'Which one are we actually doing? Tap all you can make.',
    options: [...options.map((o) => ({ text: o.title.slice(0, 100) })), { text: "Can't make it" }],
    is_anonymous: false, allows_multiple_answers: true, // non-anonymous → poll_answer updates
  });
  await polls.insertOne({ _id: m.poll.id, planId, chatId, messageId: m.message_id });
}

export async function closePoll(planId: string) {
  const poll = await (await db()).collection<any>('polls').findOne({ planId });
  if (poll) await tg('stopPoll', { chat_id: poll.chatId, message_id: poll.messageId }).catch(() => undefined);
}

export type AnnounceKind = 'locked' | 'no-quorum' | 'reminder' | 'recap-ask' | 'done' | 'draft-failed';

export async function announce(p: PlanInput, kind: AnnounceKind, data: any) {
  const col = await plans();
  const doc = await col.findOne({ _id: p.planId }, { projection: { announced: 1 } });
  if (doc?.announced?.includes(kind)) return; // already posted (activity retry)
  const page = process.env.PUBLIC_URL ? `\n${process.env.PUBLIC_URL}/p/${p.planId}` : '';
  const o: Option | undefined = data.plan;
  const text = {
    'locked': () => `Locked: ${o!.title}\n${o!.where}, ${p.date}, start ${o!.start}, about ${o!.durationH} h.\nVotes: ${data.counts.join(' / ')}.\nI'll check the weather at 05:30 and remind everyone at 06:00.${page}`,
    'no-quorum': () => `The poll closed with ${data.count} yes for the best option, and we needed ${p.quorum}. No outing this time. /plan another date when you're ready.`,
    'reminder': () => (data.switched
      ? `Good morning. Rain is likely on the original plan, so we're switching to:\n${o!.title}\n${o!.where}, start ${o!.start}.`
      : `Good morning. Today: ${o!.title}\n${o!.where}, start ${o!.start}, about ${o!.durationH} h.`) +
      (data.maxRain === undefined ? `\nI couldn't reach the forecast this morning, so check the sky before you leave.` : `\nRain chance during the outing: up to ${data.maxRain}%.`) + page,
    'recap-ask': () => `Back home? Reply to this message with one line about how it went (a photo is welcome). I'll remember it for next time.`,
    'done': () => data.recaps ? `Saved ${data.recaps} recap${data.recaps > 1 ? 's' : ''}. That one actually happened.${page}` : `No recaps came in. I've closed this plan.${page}`,
    'draft-failed': () => `I couldn't draft options: the planning server didn't answer after many tries. Try /plan again later.`,
  }[kind]();
  await tg('sendMessage', { chat_id: p.chatId, text, link_preview_options: { is_disabled: true } });
  const status = kind === 'reminder' && data.switched ? 'reminder' : kind;
  await col.updateOne({ _id: p.planId }, {
    $set: { status, ...(o ? { chosen: o } : {}), ...(data.counts ? { counts: data.counts } : {}) },
    $addToSet: { announced: kind },
  }, { upsert: true });
  await logEvent(p.planId, 'announce', kind);
}
