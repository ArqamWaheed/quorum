# Quorum

A member of your friend group's Telegram chat that turns "we should go out" into an actual outing. A Mastra agent on Gemma 4 drafts plans around everyone's constraints, and a Temporal workflow holds the clock: poll, quorum deadline, weather re-check, morning reminder, recap.

## Run

```bash
npm install
cp .env.example .env            # fill in keys
npm run dev                     # Mastra server on :4111
```

Laptop side (separate terminals):

```bash
./scripts/run-local.sh          # Temporal dev server, UI on :8233
npm run worker
npm run bot
```

## Privacy

Only people who `/join` are stored. `/forget` deletes you. The bot runs with Telegram privacy mode on, so it only sees commands and replies addressed to it.

## License

Apache-2.0
