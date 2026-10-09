#!/usr/bin/env bash
# Laptop side of Quorum: Temporal dev server + worker + Telegram bot.
# Run each in its own terminal (or tmux pane):
#
#   temporal server start-dev --db-filename ./.temporal/quorum.db   # UI: http://localhost:8233
#   npm run worker
#   npm run bot
#
# Keep the laptop awake from poll to recap:
#   Linux: systemd-inhibit --what=sleep:idle sleep infinity
#   macOS: caffeinate -dimsu
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .temporal
exec temporal server start-dev --db-filename ./.temporal/quorum.db
