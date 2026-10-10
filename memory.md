# memory.md — Quorum brain
> Read this first every task. Update it last. Keep it terse.

## What this is
Quorum — a Discord server member (Mastra agent on Gemma 4) that plans one real outing; a Temporal workflow holds the clock (poll, quorum deadline, 05:30 weather re-check, 06:00 reminder, recap); memory in MongoDB Atlas; hosted on Render.

## Stack
TypeScript, Node 22, ESM · Mastra (agent, tools, memory, server) · Gemma 4 via Gemini API free tier (`QUORUM_MODEL`, Ollama swap) · Temporal OSS dev server + TS worker on the laptop · MongoDB Atlas M0 (+ Vector Search, max 3 indexes) · Render Free web service · Discord bot (discord.js gateway, Guilds intent only; REST from activities) · Open-Meteo · OSM Overpass · SerpApi (stretch) · Entire CLI (branch backend).

## Status snapshot
- 2026-10-10: full stack runs locally (Temporal dev server, worker, `mastra dev` as stand-in for Render at RENDER_URL=localhost:4111, Discord bot `quorum#1044` in guild). Atlas connected; Mastra vector index READY on M0 (3072-d, 2 of 3 search indexes).
- Gate 1 (native): 31B and 26B both 100% valid tool calls, 0 invented places on the rows so far, but slow: 110–475 s per draft on free tier (Gemini 500s happen; retried).
- Blocked on user: Render login + blueprint secrets (agent can't sign in or type keys into fields).
- Next: decide TOOL_MODE from latency (prefetch = 1 Gemma call vs 3); Render deploy → swap RENDER_URL/PUBLIC_URL; `/plan date:test` in Discord; tag `real-run-start`.

## Key decisions (why)
- Temporal runs on the laptop, not Cloud — Cloud needs a card; dev server with `--db-filename` persists.
- Render hosts Mastra only — Free tier has no background workers; its cold start is the retried flaky call.
- Roster in own `members` collection — roster updates must not depend on Gemma tool calls.
- `generate()` not stream — Gemma tool calls unreliable when streaming.
- draftOptions always fetches places+weather in code: validates `where` (invented → dropped), code-built fallback if <2 real options.
- Overpass public instances flaky (all down 2026-10-10): mirrors → Photon fallback → Atlas `places_cache` (7d fresh, 30d TTL, stale on failure).
- Draft activity: 90 s fetch / 150 s startToClose (Gemma+tools slow); recheck/remember 30 s (Gemma fallback aborted at 20 s). Retries 12×, 5 s→2 min.
- Workflow degrades: draft fail → announce; recheck fail → keep plan, reminder says forecast unknown; recap store best effort.
- Announce/sendPoll idempotent (plans.announced, polls by planId). Bot keeps live vote counts in plans for the page.
- 2026-10-10: switched Telegram → Discord (Telegram banned in Pakistan). Slash commands, multi-select menu as the poll (native polls cap answers at 55 chars), recap via button→modal or /recap with photo. chatId = Discord channel id (roster is per channel). No Message Content intent = privacy-mode equivalent.
- HOME = Islamabad (33.6844, 73.0479). Overpass down all day → Nominatim fallback gives real spots (Margalla Hills NP, Shakarparian, Rawal Lake Viewpoint); cached in Atlas.
- Draft activity timeouts raised to 300 s fetch / 6 min startToClose; storeRecap 120 s on the long proxy. Recheck stays 30 s (cold-start retry demo); its Gemma fallback is aborted at 20 s → code picks least-rain alternative.
- Plan page shows counts only unless PUBLIC_NAMES=on. /try uses `quorum-try` agent (no memory, no SerpApi), 5/h/IP.

## Open questions / TODO
- Gate 1 result (native vs prefetch).
- Atlas M0 Vector Search index creation by `@mastra/mongodb` (fallback SEMANTIC_RECALL=off).
- Resolved: Temporal ESM + tsx bundling works.

## File map
- `src/mastra/index.ts` Mastra instance · `agents/quorum.ts` (quorum, quorum-notools, quorum-try) · `tools/{weather,places,liveCheck}.ts`
- `src/mastra/draft.ts` shared draft + validation · `routes.ts` /quorum/{draft,recheck,remember}, /p/:id, /try, / · `pages.ts` HTML (Overpass font, trail-blaze timeline) · `memory.ts`
- `src/shared/{db,schema,model,time}.ts` · `src/temporal/{workflows,activities,worker}.ts` (workflows FROZEN at `real-run-start`) · `src/bot/discord.ts`
- `scripts/{smoke-gemma,test-workflow,warm-places}.ts`, `run-local.sh` · `render.yaml`, `.env.example`
