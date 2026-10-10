import { Agent } from '@mastra/core/agent';
import { quorumModel } from '../../shared/model';
import { memory } from '../memory';
import { weatherTool, placesTool } from '../tools';
import { liveCheckTool } from '../tools/liveCheck';

export const instructions = `You plan ONE small real-world outing for a friend group.
- Every option must respect EVERY roster constraint. List in shapedBy which constraints changed it, naming the person (e.g. "Sara: knee hates long descents").
- Call weather for the date and places near home before proposing. Use ONLY place names returned by the places tool, copied exactly. Never invent a place.
- 2–3 options, each 1–4 hours, within 30 km, starting 06:30–10:00 local. Plain words, no hype. Titles under 90 characters.
- If someone's constraint can't be met by any option, say so in shapedBy instead of hiding it.
- If earlier recaps or constraints are in memory, use them (e.g. avoid repeating a place the group disliked).`;

const tools = { weatherTool, placesTool, ...(process.env.SERPAPI_KEY ? { liveCheckTool } : {}) };

export const quorumAgent = new Agent({ id: 'quorum', name: 'Quorum', instructions, model: quorumModel(), tools, memory });
// Prefetch fallback twin: same model + memory, no tools (code runs the tools, Gemma reasons).
export const quorumNoTools = new Agent({ id: 'quorum-notools', name: 'Quorum (prefetch)', instructions, model: quorumModel(), memory });
// /try twin: no memory, no liveCheck. Judges must not drain SerpApi or write to the group's memory.
export const quorumTry = new Agent({ id: 'quorum-try', name: 'Quorum (try)', instructions, model: quorumModel(), tools: { weatherTool, placesTool } });
