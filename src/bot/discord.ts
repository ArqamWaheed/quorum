// Discord adapter: slash commands + component taps → Atlas + Temporal signals.
// Only the Guilds intent: no Message Content, so the bot never reads ordinary chat (the Discord
// equivalent of Telegram privacy mode). All time math happens here; the workflow sees absolute timestamps.
import {
  ActionRowBuilder, ApplicationCommandOptionType, Client, Events, GatewayIntentBits, MessageFlags, ModalBuilder,
  TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type ChatInputCommandInteraction, type Interaction, type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { Client as TemporalClient, Connection, WorkflowNotFoundError } from '@temporalio/client';
import { planOuting, vote, recap, type PlanInput } from '../temporal/workflows';
import { db, ensureIndexes, requireEnv } from '../shared/db';
import { fmtLocal, localToday, realSchedule, testSchedule } from '../shared/time';
import type { Recap } from '../shared/schema';

requireEnv('DISCORD_BOT_TOKEN', 'MONGODB_URI');

const COMMANDS = [
  { name: 'help', description: 'How Quorum works' },
  { name: 'join', description: 'Let Quorum remember you for planning' },
  { name: 'me', description: 'Add one thing that limits you',
    options: [{ name: 'limit', description: 'e.g. no car, home by 11, knee hates long descents', type: ApplicationCommandOptionType.String, required: true, max_length: 200 }] },
  { name: 'mine', description: 'Show what Quorum remembers about you' },
  { name: 'forget', description: 'Delete everything Quorum stores about you' },
  { name: 'plan', description: 'Draft options and start the poll',
    options: [
      { name: 'date', description: 'YYYY-MM-DD, or "test" for a run compressed into ~15 minutes', type: ApplicationCommandOptionType.String, required: true },
      { name: 'people', description: 'Yeses needed (default 4, or 2 for test)', type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: 50 },
    ] },
  { name: 'status', description: 'Where the current plan stands' },
  { name: 'cancel', description: 'Cancel the current plan' },
  { name: 'recap', description: 'Add your recap of the outing',
    options: [
      { name: 'line', description: 'One line about how it went', type: ApplicationCommandOptionType.String, required: true, max_length: 500 },
      { name: 'photo', description: 'A photo (optional)', type: ApplicationCommandOptionType.Attachment },
    ] },
];

const HELP = `I plan one small outing for this channel and keep time until it happens.

**/join** lets me remember you. I only see slash commands and taps on my buttons, never your normal messages.
**/me** adds one thing that limits you, e.g. \`no car\` or \`home by 11\`.
**/plan date:2026-10-11 people:4** drafts options; the poll closes the night before at ${process.env.POLL_CLOSE ?? '22:00'}, I check the weather at 05:30 and remind everyone at 06:00.
**/status**, **/cancel**, **/mine**, **/forget** (deletes everything about you).

What you send me is processed by Google's Gemini API free tier, which may use it to improve their products.`;

const members = async () => (await db()).collection<any>('members');
const plans = async () => (await db()).collection<any>('plans');
const ACTIVE = ['drafting', 'voting', 'locked', 'fallback', 'reminder', 'recap-ask'];
const nameOf = (i: Interaction) => ((i.member as any)?.displayName ?? i.user.globalName ?? i.user.username) as string;
const pageLink = (id: string) => (process.env.PUBLIC_URL ? `\n<${process.env.PUBLIC_URL}/p/${id}>` : '');

await ensureIndexes().catch((e) => console.error('ensureIndexes:', e.message));
const temporal = new TemporalClient({ connection: await Connection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' }) });

async function rememberRemote(chatId: string, name: string, text: string) {
  if (!process.env.RENDER_URL) return;
  // Best effort: the roster in Atlas is the source of truth; this makes the line recallable by semantic search.
  await fetch(`${process.env.RENDER_URL}/quorum/remember`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-quorum-secret': process.env.QUORUM_SHARED_SECRET ?? '' },
    body: JSON.stringify({ chatId, name, text }), signal: AbortSignal.timeout(90_000) })
    .catch((e) => console.error('remember:', e.message));
}

const latestActive = async (chatId: string) =>
  (await plans()).find({ chatId, status: { $in: ACTIVE } }).sort({ 'schedule.pollCloseAt': -1 }).limit(1).next();

async function startPlan(i: ChatInputCommandInteraction) {
  const chatId = i.channelId;
  const arg = i.options.getString('date', true).trim();
  const test = arg === 'test';
  const now = Date.now();
  const date = test ? localToday(now) : arg;
  const quorum = i.options.getInteger('people') ?? (test ? 2 : 4);
  if (!test && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return i.reply({ content: 'Date must look like 2026-10-11, or "test".', flags: MessageFlags.Ephemeral });
  const s = test ? testSchedule(now) : realSchedule(date);
  if (s.pollCloseAt < now + 2 * 60_000)
    return i.reply({ content: `The poll for ${date} would close at ${fmtLocal(s.pollCloseAt)}, which is too soon. Pick a later date.`, flags: MessageFlags.Ephemeral });
  await i.deferReply(); // Atlas + Temporal can take longer than Discord's 3 s reply window
  const roster = await (await members()).countDocuments({ chatId });
  if (!roster) return i.editReply('Nobody in this channel has joined yet. Use /join first, then /me with anything that limits you.');
  const p: PlanInput = { planId: `plan-${chatId}-${date}${test ? `-t${now}` : ''}`, chatId, date, quorum, ...s,
    recapUntil: test ? s.outingEndAt + 3 * 60_000 : s.outingEndAt + 6 * 3_600_000 };
  try {
    await temporal.workflow.start(planOuting, { taskQueue: 'quorum', workflowId: p.planId, args: [p] });
  } catch (e: any) {
    if (/already started/i.test(e.message)) return i.editReply(`There's already a plan for ${date}. /status shows it.`);
    throw e;
  }
  await (await plans()).updateOne({ _id: p.planId }, { $set: { chatId, date, quorum, status: 'drafting', test,
    schedule: { pollCloseAt: s.pollCloseAt, weatherCheckAt: s.weatherCheckAt, reminderAt: s.reminderAt, outingEndAt: s.outingEndAt } } }, { upsert: true });
  return i.editReply(`Drafting options for ${date} for ${roster} ${roster === 1 ? 'person' : 'people'}. I need ${quorum} yes${quorum === 1 ? '' : 'es'}.\n` +
    `Poll closes ${fmtLocal(s.pollCloseAt)}, weather check ${fmtLocal(s.weatherCheckAt)}, reminder ${fmtLocal(s.reminderAt)}.` +
    (test ? '\n(Test run: the same steps, compressed into minutes.)' : '') + pageLink(p.planId));
}

async function sendRecap(i: ChatInputCommandInteraction | ModalSubmitInteraction, planId: string | undefined, r: Recap) {
  await i.deferReply();
  const plan = planId
    ? await (await plans()).findOne({ _id: planId, status: 'recap-ask' })
    : await (await plans()).findOne({ chatId: i.channelId, status: 'recap-ask' });
  if (!plan) return i.editReply("There's no outing waiting for a recap right now.");
  await temporal.workflow.getHandle(plan._id).signal(recap, r);
  return i.editReply(`Recap from ${r.name}: ${r.line}${r.photoUrl ? ' (with photo)' : ''}`);
}

async function onCommand(i: ChatInputCommandInteraction) {
  const chatId = i.channelId, userId = i.user.id, name = nameOf(i), _id = `${chatId}:${userId}`;
  const col = await members();
  const eph = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral });
  switch (i.commandName) {
    case 'help': return eph(HELP);
    case 'join':
      await col.updateOne({ _id }, { $set: { chatId, userId, name, consentAt: new Date() }, $setOnInsert: { constraints: [] } }, { upsert: true });
      return i.reply(`${name} joined. I only see slash commands and taps on my buttons. Add limits with /me. /forget removes you.`);
    case 'forget':
      await col.deleteOne({ _id });
      await (await db()).collection('recaps').deleteMany({ chatId, userId });
      return eph(`Forgotten, ${name}. Your limits and recaps are deleted.`);
    case 'me': {
      const text = i.options.getString('limit', true).trim().slice(0, 200);
      const r = await col.updateOne({ _id }, { $push: { constraints: { text, addedAt: new Date() } } } as any);
      if (!r.matchedCount) return eph('Use /join first so I can remember you.');
      await i.reply(`Noted, ${name}: "${text}". Every option will respect it.`);
      return rememberRemote(chatId, name, text);
    }
    case 'mine': {
      const doc = await col.findOne({ _id });
      if (!doc) return eph("I don't store anything about you in this channel. /join to start.");
      const xs = (doc.constraints ?? []).map((c: any) => `- ${c.text}`).join('\n');
      return eph(xs ? `What I remember about you:\n${xs}\n/forget deletes it all.` : `You've joined but haven't added limits. Use /me.`);
    }
    case 'plan': return startPlan(i);
    case 'status': {
      await i.deferReply();
      const p = await latestActive(chatId);
      if (!p) return i.editReply('No plan running in this channel. Use /plan to start one.');
      const phase = await temporal.workflow.getHandle(p._id).query<string>('phase').catch(() => p.status);
      return i.editReply(`Plan for ${p.date}: ${phase}.` + (p.chosen ? `\n${p.chosen.title}, ${p.chosen.where}, ${p.chosen.start}.` : '') +
        (p.counts ? `\nVotes: ${p.counts.join(' / ')}.` : '') + pageLink(p._id));
    }
    case 'cancel': {
      await i.deferReply();
      const p = await latestActive(chatId);
      if (!p) return i.editReply('No plan running in this channel.');
      await temporal.workflow.getHandle(p._id).cancel().catch(() => undefined);
      await (await plans()).updateOne({ _id: p._id }, { $set: { status: 'cancelled' } });
      return i.editReply(`Cancelled the plan for ${p.date}.`);
    }
    case 'recap': {
      const photo = i.options.getAttachment('photo');
      return sendRecap(i, undefined, { userId, name, line: i.options.getString('line', true).slice(0, 500),
        ...(photo?.contentType?.startsWith('image/') ? { photoUrl: photo.url } : {}) });
    }
  }
}

async function onVote(i: StringSelectMenuInteraction) {
  const planId = i.customId.slice('vote:'.length);
  const optionIds = i.values.map(Number);
  await i.deferUpdate();
  const col = await plans();
  const plan = await col.findOneAndUpdate({ _id: planId, status: 'voting' }, { $set: { [`votes.${i.user.id}`]: optionIds } }, { returnDocument: 'after' });
  if (!plan) return i.followUp({ content: 'This poll is closed.', flags: MessageFlags.Ephemeral });
  const counts = plan.options.map(() => 0);
  for (const ids of Object.values<number[]>(plan.votes ?? {})) for (const k of ids) if (k < counts.length) counts[k]++;
  await col.updateOne({ _id: planId }, { $set: { counts } });
  await temporal.workflow.getHandle(planId).signal(vote, { userId: i.user.id, name: nameOf(i), optionIds }) // [] = vote cleared
    .catch((e) => { if (!(e instanceof WorkflowNotFoundError)) throw e; });
  const picked = optionIds.map((k) => (k < plan.options.length ? `${k + 1}` : "can't make it")).join(', ') || 'nothing';
  await i.editReply({ content: i.message.content.replace(/Votes: [\d /]+$/, `Votes: ${counts.join(' / ')}`) });
  await i.followUp({ content: `Got it, you picked: ${picked}.`, flags: MessageFlags.Ephemeral });
}

async function onRecapButton(i: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId(i.customId).setTitle('Your recap').addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('line')
      .setLabel('One line about how it went').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)));
  await i.showModal(modal);
}

const discord = new Client({ intents: [GatewayIntentBits.Guilds] });
discord.once(Events.ClientReady, async (c) => {
  const guild = process.env.DISCORD_GUILD_ID; // guild commands appear instantly; global ones can take up to an hour
  const invite = `https://discord.com/oauth2/authorize?client_id=${c.application.id}&scope=bot+applications.commands&permissions=19456`;
  try {
    if (guild) await c.application.commands.set(COMMANDS as any, guild);
    else await c.application.commands.set(COMMANDS as any);
  } catch (e: any) {
    if (e.code !== 50001) throw e;
    console.error(`The bot isn't in server ${guild} yet. Add it with this link, then restart npm run bot:\n${invite}`);
    process.exit(1);
  }
  console.log(`quorum bot ${c.user.tag} ready (${guild ? `guild ${guild}` : 'global'} commands)`);
  console.log(`invite: ${invite}`);
});
discord.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) await onCommand(i);
    else if (i.isStringSelectMenu() && i.customId.startsWith('vote:')) await onVote(i);
    else if (i.isButton() && i.customId.startsWith('recap:')) await onRecapButton(i);
    else if (i.isModalSubmit() && i.customId.startsWith('recap:'))
      await sendRecap(i, i.customId.slice('recap:'.length), { userId: i.user.id, name: nameOf(i), line: i.fields.getTextInputValue('line').slice(0, 500) });
  } catch (e) {
    console.error(e);
    const msg = { content: 'Something went wrong on my side. Try again in a minute.', flags: MessageFlags.Ephemeral } as const;
    if (i.isRepliable()) await (i.replied || i.deferred ? i.followUp(msg) : i.reply(msg)).catch(() => undefined);
  }
});
await discord.login(process.env.DISCORD_BOT_TOKEN);
