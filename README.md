# Quorum

A member of your friend group's Discord server that turns "we should go out" into an actual outing. A Mastra agent on Gemma 4 drafts plans around everyone's constraints, and a Temporal workflow holds the clock: poll, quorum deadline, weather re-check, morning reminder, recap.

```
Discord ──► laptop: bot + Temporal dev server + worker ──HTTPS──► Render: Mastra agent (Gemma 4) ──► MongoDB Atlas
                                                                    tools: Open-Meteo, OpenStreetMap
```

- **Temporal** owns time: waiting for votes, the 05:30 weather check, the 06:00 reminder, retrying a sleeping server.
- **Mastra + Gemma 4** own reasoning: which outing, and which constraint shaped it.
- **MongoDB Atlas** owns memory: who joined, their limits, plans, recaps, and semantic recall of past outings.
- **Render** owns the public face: the agent API, the plan page `/p/:id`, and the demo at `/try`.

## Run

Needs Node 22, the [Temporal CLI](https://docs.temporal.io/cli), a Google AI Studio key, an Atlas M0 cluster and a Discord bot token.

```bash
npm install
cp .env.example .env            # fill in keys
npm run smoke -- --n 6          # Gemma tool-call check (full Gate 1: npm run smoke)
npm run places                  # cache real spots around HOME_LAT/HOME_LON
npm run dev                     # Mastra server on :4111 (or deploy to Render, below)
```

Laptop side (separate terminals):

```bash
./scripts/run-local.sh          # Temporal dev server, UI on :8233
npm run worker
npm run bot
```

In your Discord channel: `/join`, `/me limit:no car`, then `/plan date:test` for a run compressed into ~10 minutes, or `/plan date:2026-10-11 people:4` for the real thing (poll closes the night before at `POLL_CLOSE`, weather check 05:30, reminder 06:00, recap at `OUTING_END`).

Check the workflow without any external service: `./scripts/run-local.sh`, then `npm run test:workflow`.

### Set up the Discord bot

1. [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → **Bot** → Reset Token → put it in `.env` as `DISCORD_BOT_TOKEN`. Leave every privileged intent off.
2. Discord → Settings → Advanced → Developer Mode on. Right-click your server → Copy Server ID → `DISCORD_GUILD_ID`.
3. `npm run bot` prints an invite link (scopes `bot applications.commands`; permissions: View Channel, Send Messages, Embed Links). Open it and add the bot to your server.
4. Use one channel for the group: the roster and plans belong to the channel where people `/join`.

### Deploy the agent to Render

New → Blueprint → this repo (uses `render.yaml`). Set `GOOGLE_API_KEY`, `MONGODB_URI`, `QUORUM_SHARED_SECRET`, `PUBLIC_URL` (the `onrender.com` URL). Atlas Network Access must allow `0.0.0.0/0` (Render Free has no static IP). Put the same URL in the laptop's `.env` as `RENDER_URL` and `PUBLIC_URL`.

Render Free sleeps after 15 idle minutes. The 05:30 weather check usually hits a sleeping server, times out after 30 s, and Temporal retries it; every attempt is logged on the plan page.

## Privacy

Only people who `/join` are stored. `/forget` deletes your limits and recaps. The bot connects with only the `Guilds` intent (no Message Content), so it never sees ordinary messages: only slash commands and taps on its own buttons. The public plan page shows counts only, unless `PUBLIC_NAMES=on` because the group agreed. Recap photos stay as Discord attachment links and are never re-hosted. Messages sent to the bot are processed by Google's Gemini API free tier, which may use them to improve Google's products; run `QUORUM_MODEL=ollama:gemma4:e4b` to keep everything local.

## License

Apache-2.0
