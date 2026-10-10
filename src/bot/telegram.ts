// Telegram adapter: long polling (privacy mode ON, bot is NOT an admin) → Atlas + Temporal signals.
// All time math happens here; the workflow only sees absolute timestamps.
import { Client, Connection, WorkflowNotFoundError } from '@temporalio/client';
import { planOuting, vote, recap, type PlanInput } from '../temporal/workflows';
import { db, ensureIndexes } from '../shared/db';
import { fmtLocal, localToday, realSchedule, testSchedule } from '../shared/time';

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');

async function tg(method: string, body: object, timeoutMs = 15_000) {
  const r = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const j: any = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}
const send = (chat_id: string, text: string, reply_to?: number) =>
  tg('sendMessage', { chat_id, text, link_preview_options: { is_disabled: true },
    ...(reply_to ? { reply_parameters: { message_id: reply_to, allow_sending_without_reply: true } } : {}) });

await ensureIndexes().catch((e) => console.error('ensureIndexes:', e.message));
const temporal = new Client({ connection: await Connection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' }) });
const me = await tg('getMe', {});
await tg('setMyCommands', { commands: [
  { command: 'join', description: 'Let Quorum remember you for planning' },
  { command: 'me', description: 'Add one thing that limits you, e.g. /me no car' },
  { command: 'mine', description: 'Show what Quorum remembers about you' },
  { command: 'plan', description: '/plan YYYY-MM-DD [people needed], or /plan test' },
  { command: 'status', description: 'Where the current plan stands' },
  { command: 'cancel', description: 'Cancel the current plan' },
  { command: 'forget', description: 'Delete everything Quorum stores about you' },
  { command: 'help', description: 'How Quorum works' },
] }).catch((e) => console.error(e.message));
console.log(`quorum bot @${me.username} polling`);

const HELP = `I plan one small outing for this group and keep time until it happens.

/join lets me remember you. I only see commands and replies to my messages.
/me <one thing that limits you>, e.g. /me no car, /me home by 11
/plan 2026-10-11 4 drafts options for that date; the poll closes the night before at ${process.env.POLL_CLOSE ?? '22:00'}, and I need 4 yeses.
/status, /cancel, /mine, /forget (deletes everything about you)

What you send me is processed by Google's Gemini API free tier, which may use it to improve their products.`;

const members = async () => (await db()).collection<any>('members');
const plans = async () => (await db()).collection<any>('plans');
const ACTIVE = ['drafting', 'voting', 'locked', 'fallback', 'reminder', 'recap-ask'];

async function rememberRemote(chatId: string, name: string, text: string) {
  if (!process.env.RENDER_URL) return;
  // Best effort: the roster in Atlas is the source of truth; this makes the line recallable by semantic search.
  await fetch(`${process.env.RENDER_URL}/quorum/remember`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-quorum-secret': process.env.QUORUM_SHARED_SECRET ?? '' },
    body: JSON.stringify({ chatId, name, text }), signal: AbortSignal.timeout(90_000) })
    .catch((e) => console.error('remember:', e.message));
}

async function startPlan(chatId: string, args: string, msgId: number) {
  const a = args.trim().split(/\s+/).filter(Boolean);
  const test = a[0] === 'test';
  const now = Date.now();
  const date = test ? localToday(now) : a[0] ?? '';
  const quorum = Number(test ? a[1] ?? 2 : a[1] ?? 4);
  if (!test && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(chatId, 'Usage: /plan YYYY-MM-DD [people needed], e.g. /plan 2026-10-11 4. Or /plan test for a run compressed into 10 minutes.', msgId);
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > 50) return send(chatId, 'People needed must be a whole number from 1 to 50.', msgId);
  const s = test ? testSchedule(now) : realSchedule(date);
  if (s.pollCloseAt < now + 10 * 60_000) return send(chatId, `The poll for ${date} would close at ${fmtLocal(s.pollCloseAt)}, which is too soon. Pick a later date.`, msgId);
  const roster = await (await members()).countDocuments({ chatId });
  if (!roster) return send(chatId, 'Nobody has joined yet. Send /join first, then /me with anything that limits you.', msgId);
  const p: PlanInput = { planId: `plan-${chatId}-${date}${test ? `-t${now}` : ''}`, chatId, date, quorum, ...s,
    recapUntil: test ? s.outingEndAt + 3 * 60_000 : s.outingEndAt + 6 * 3_600_000 };
  try {
    await temporal.workflow.start(planOuting, { taskQueue: 'quorum', workflowId: p.planId, args: [p] });
  } catch (e: any) {
    if (/already started/i.test(e.message)) return send(chatId, `There's already a plan for ${date}. /status shows it.`, msgId);
    throw e;
  }
  await (await plans()).updateOne({ _id: p.planId }, { $set: { chatId, date, quorum, status: 'drafting', test,
    schedule: { pollCloseAt: s.pollCloseAt, weatherCheckAt: s.weatherCheckAt, reminderAt: s.reminderAt, outingEndAt: s.outingEndAt } } }, { upsert: true });
  return send(chatId, `Drafting options for ${date} for ${roster} ${roster === 1 ? 'person' : 'people'}. I need ${quorum} yes${quorum === 1 ? '' : 'es'}.\n` +
    `Poll closes ${fmtLocal(s.pollCloseAt)}, weather check ${fmtLocal(s.weatherCheckAt)}, reminder ${fmtLocal(s.reminderAt)}.` +
    (test ? '\n(Test run: the same steps, compressed into minutes.)' : '') +
    (process.env.PUBLIC_URL ? `\n${process.env.PUBLIC_URL}/p/${p.planId}` : ''), msgId);
}

const latestActive = async (chatId: string) =>
  (await plans()).find({ chatId, status: { $in: ACTIVE } }).sort({ 'schedule.pollCloseAt': -1 }).limit(1).next();

async function onVote(a: any) {
  const poll = await (await db()).collection<any>('polls').findOne({ _id: a.poll_id });
  if (!poll || !a.user) return;
  const userId = String(a.user.id);
  // Live counts for the plan page (the workflow keeps its own tally from signals).
  const col = await plans();
  const plan = await col.findOneAndUpdate({ _id: poll.planId }, { $set: { [`votes.${userId}`]: a.option_ids } }, { returnDocument: 'after' });
  if (plan?.options) {
    const counts = plan.options.map(() => 0);
    for (const ids of Object.values<number[]>(plan.votes ?? {})) for (const i of ids) if (i < counts.length) counts[i]++;
    await col.updateOne({ _id: poll.planId }, { $set: { counts } });
  }
  await temporal.workflow.getHandle(poll.planId)
    .signal(vote, { userId, name: a.user.first_name, optionIds: a.option_ids }) // [] = vote retracted
    .catch((e) => { if (!(e instanceof WorkflowNotFoundError)) throw e; });
}

async function onRecap(chatId: string, userId: string, name: string, m: any) {
  const plan = await (await plans()).findOne({ chatId, status: 'recap-ask' });
  if (!plan) return;
  const line = String(m.text ?? m.caption ?? '').slice(0, 500);
  if (!line && !m.photo) return;
  await temporal.workflow.getHandle(plan._id).signal(recap, { userId, name, line, photoFileId: m.photo?.at(-1)?.file_id });
  await tg('setMessageReaction', { chat_id: chatId, message_id: m.message_id, reaction: [{ type: 'emoji', emoji: '👍' }] }).catch(() => undefined);
}

async function onMessage(m: any) {
  if (!m?.from || m.from.is_bot) return;
  const chatId = String(m.chat.id), userId = String(m.from.id), name = String(m.from.first_name ?? 'friend');
  const [, cmd, target, args = ''] = String(m.text ?? '').match(/^\/(\w+)(?:@(\w+))?\s*(.*)$/s) ?? [];
  if (target && target.toLowerCase() !== String(me.username).toLowerCase()) return; // another bot's command
  const col = await members();
  const _id = `${chatId}:${userId}`;
  switch (cmd) {
    case 'start': case 'help': return send(chatId, HELP);
    case 'join':
      await col.updateOne({ _id }, { $set: { chatId, userId, name, consentAt: new Date() }, $setOnInsert: { constraints: [] } }, { upsert: true });
      return send(chatId, `${name} joined. I only see commands and replies to me. Add limits with /me, e.g. /me no car. /forget removes you.`, m.message_id);
    case 'forget':
      await col.deleteOne({ _id });
      await (await db()).collection('recaps').deleteMany({ chatId, userId });
      return send(chatId, `Forgotten, ${name}. Your limits and recaps are deleted.`, m.message_id);
    case 'me': {
      const text = args.trim().slice(0, 200);
      if (!text) return send(chatId, 'Tell me one thing that limits you, e.g. /me knee hates long descents', m.message_id);
      const r = await col.updateOne({ _id }, { $push: { constraints: { text, addedAt: new Date() } } } as any);
      if (!r.matchedCount) return send(chatId, 'Send /join first so I can remember you.', m.message_id);
      await send(chatId, `Noted, ${name}: "${text}". Every option will respect it.`, m.message_id);
      return rememberRemote(chatId, name, text);
    }
    case 'mine': {
      const doc = await col.findOne({ _id });
      if (!doc) return send(chatId, "I don't store anything about you. /join to start.", m.message_id);
      const xs = (doc.constraints ?? []).map((c: any) => `- ${c.text}`).join('\n');
      return send(chatId, xs ? `What I remember about you, ${name}:\n${xs}\n/forget deletes it all.` : `You've joined but haven't added limits. Use /me.`, m.message_id);
    }
    case 'plan': return startPlan(chatId, args, m.message_id);
    case 'status': {
      const p = await latestActive(chatId);
      if (!p) return send(chatId, 'No plan running. /plan YYYY-MM-DD to start one.');
      const phase = await temporal.workflow.getHandle(p._id).query<string>('phase').catch(() => p.status);
      return send(chatId, `Plan for ${p.date}: ${phase}.` + (p.chosen ? `\n${p.chosen.title}, ${p.chosen.where}, ${p.chosen.start}.` : '') +
        (p.counts ? `\nVotes: ${p.counts.join(' / ')}.` : '') + (process.env.PUBLIC_URL ? `\n${process.env.PUBLIC_URL}/p/${p._id}` : ''));
    }
    case 'cancel': {
      const p = await latestActive(chatId);
      if (!p) return send(chatId, 'No plan running.');
      await temporal.workflow.getHandle(p._id).cancel().catch(() => undefined);
      await (await plans()).updateOne({ _id: p._id }, { $set: { status: 'cancelled' } });
      return send(chatId, `Cancelled the plan for ${p.date}.`);
    }
  }
  if (!cmd && m.reply_to_message?.from?.id === me.id) return onRecap(chatId, userId, name, m);
}

let offset = 0;
for (;;) {
  const updates: any[] = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'poll_answer'] }, 60_000)
    .catch((e) => { console.error('getUpdates:', e.message); return new Promise((r) => setTimeout(() => r([]), 3_000)); });
  for (const u of updates) {
    offset = u.update_id + 1;
    await (u.poll_answer ? onVote(u.poll_answer) : onMessage(u.message)).catch((e) => console.error(e));
  }
}
