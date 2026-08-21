#!/usr/bin/env sh
# TarotNAI launcher. Run from anywhere - it locates the project itself.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js is not on your PATH."
  echo "    Install Node 22 or newer from https://nodejs.org"
  exit 1
fi

MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$MAJOR" -lt 22 ]; then
  echo "[X] Node $MAJOR is too old - this needs Node 22 or newer."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[*] Installing dependencies..."
  npm install
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "[!] No .env yet - creating one from .env.example."
  echo "    Add your NovelAI key to it, then restart."
  cp .env.example .env
  echo
fi

echo "[*] Starting TarotNAI..."
echo "    Press Ctrl+C to stop."
echo

exec npm start
