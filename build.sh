#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command python3
require_command npm
require_command docker

mkdir -p "$ROOT_DIR/.dev/logs" "$ROOT_DIR/.dev/pids"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "Created backend/.env from .env.example"
fi

if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  echo "Created frontend/.env from .env.example"
fi

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  python3 -m venv "$BACKEND_DIR/.venv"
fi

"$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
npm --prefix "$FRONTEND_DIR" install

echo "Build setup complete."
