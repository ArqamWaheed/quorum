# memory.md — Quorum brain
> Read this first every task. Update it last. Keep it terse.

## What this is
Quorum — a Telegram group member (Mastra agent on Gemma 4) that plans one real outing; a Temporal workflow holds the clock (poll, quorum deadline, 05:30 weather re-check, 06:00 reminder, recap); memory in MongoDB Atlas; hosted on Render.

## Stack
TypeScript, Node 22, ESM · Mastra (agent, tools, memory, server) · Gemma 4 via Gemini API free tier (`QUORUM_MODEL`, Ollama swap) · Temporal OSS dev server + TS worker on the laptop · MongoDB Atlas M0 (+ Vector Search, max 3 indexes) · Render Free web service · Telegram Bot API (long polling) · Open-Meteo · OSM Overpass · SerpApi (stretch) · Entire CLI (branch backend).

## Status snapshot
- Phase: all code built (2026-10-10). Typecheck clean; `mastra build` + `mastra dev` serve /, /try, /p/:id, /health; `npm run test:workflow` 9/9 PASS (mock activities on local Temporal).
- Blocked on user: `.env` keys (GOOGLE_API_KEY, MONGODB_URI, TELEGRAM_BOT_TOKEN, HOME_LAT/LON, secret), Render deploy.
- Next: `npm run smoke` → Gate 1 → TOOL_MODE; `npm run places`; Render deploy; `/plan test` in a test group; tag `real-run-start` before the real run.

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
- Plan page shows counts only unless PUBLIC_NAMES=on. /try uses `quorum-try` agent (no memory, no SerpApi), 5/h/IP.

## Open questions / TODO
- Gate 1 result (native vs prefetch).
- Atlas M0 Vector Search index creation by `@mastra/mongodb` (fallback SEMANTIC_RECALL=off).
- Resolved: Temporal ESM + tsx bundling works.

## File map
- `src/mastra/index.ts` Mastra instance · `agents/quorum.ts` (quorum, quorum-notools, quorum-try) · `tools/{weather,places,liveCheck}.ts`
- `src/mastra/draft.ts` shared draft + validation · `routes.ts` /quorum/{draft,recheck,remember}, /p/:id, /try, / · `pages.ts` HTML (Overpass font, trail-blaze timeline) · `memory.ts`
- `src/shared/{db,schema,model,time}.ts` · `src/temporal/{workflows,activities,worker}.ts` (workflows FROZEN at `real-run-start`) · `src/bot/telegram.ts`
- `scripts/{smoke-gemma,test-workflow,warm-places}.ts`, `run-local.sh` · `render.yaml`, `.env.example`
