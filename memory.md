# memory.md — Quorum brain
> Read this first every task. Update it last. Keep it terse.

## What this is
Quorum — a Telegram group member (Mastra agent on Gemma 4) that plans one real outing; a Temporal workflow holds the clock (poll, quorum deadline, 05:30 weather re-check, 06:00 reminder, recap); memory in MongoDB Atlas; hosted on Render.

## Stack
TypeScript, Node 22, ESM · Mastra (agent, tools, memory, server) · Gemma 4 via Gemini API free tier (`QUORUM_MODEL`, Ollama swap) · Temporal OSS dev server + TS worker on the laptop · MongoDB Atlas M0 (+ Vector Search, max 3 indexes) · Render Free web service · Telegram Bot API (long polling) · Open-Meteo · OSM Overpass · SerpApi (stretch) · Entire CLI (branch backend).

## Status snapshot
- Phase: Hour 0 bootstrap done (scaffold only, no feature code).
- Last task: repo scaffold, config, agent files, Entire enabled.
- Next: `npm install`; accounts + `.env`; Mastra agent + weather/places tools + `scripts/smoke-gemma.ts` → Gate 1 (tool-call validity ≥16/20 → `TOOL_MODE=native`, else `prefetch`).

## Key decisions (why)
- Temporal runs on the laptop, not Cloud — Cloud needs a card; dev server with `--db-filename` persists.
- Render hosts Mastra only — Free tier has no background workers; its cold start is the retried flaky call.
- Roster in own `members` collection — roster updates must not depend on Gemma tool calls.
- `generate()` not stream — Gemma tool calls unreliable when streaming.

## Open questions / TODO
- Gate 1 result (native vs prefetch).
- Atlas M0 Vector Search index creation by `@mastra/mongodb`.
- Temporal workflow bundling under ESM + tsx (fallback: CommonJS for `src/temporal/`).

## File map (planned — create as built)
- `src/mastra/index.ts` — Mastra instance (Render entry)
- `src/mastra/agents/quorum.ts` — agent + no-tools twin
- `src/mastra/tools/{weather,places,liveCheck}.ts` — Open-Meteo, Overpass, SerpApi
- `src/mastra/memory.ts` — MongoDBStore + MongoDBVector + embedder
- `src/mastra/routes.ts` — `/quorum/{draft,recheck,remember}`, `/p/:id`, `/try`
- `src/shared/{db,schema,model,time}.ts`
- `src/temporal/{workflows,activities,worker}.ts` — workflows FROZEN at `real-run-start`
- `src/bot/telegram.ts` — commands, poll votes → signals, recaps
- `scripts/smoke-gemma.ts`, `scripts/run-local.sh`
- `render.yaml`, `.env.example`
