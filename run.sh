#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

# shellcheck source=/dev/null
source .venv/bin/activate

python3 -m pip install --upgrade pip
pip install -r requirements.txt

echo "Starting Discord bot and Bot UI..."
python3 bot.py &
BOT_PID=$!
python3 app.py &
APP_PID=$!

wait -n "$BOT_PID" "$APP_PID"
EXIT_STATUS=$?

echo "One process exited; stopping the other..."
kill "$BOT_PID" "$APP_PID" 2>/dev/null || true
wait "$BOT_PID" "$APP_PID" 2>/dev/null || true
exit "$EXIT_STATUS"
