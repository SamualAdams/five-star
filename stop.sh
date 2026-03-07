#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$ROOT_DIR/.dev/pids"
BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"
POSTGRES_MODE_FILE="$ROOT_DIR/.dev/postgres.mode"
POSTGRES_CONTAINER_NAME="five-star-postgres"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

stop_pid_file() {
  local pid_file="$1"
  local service_name="$2"

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true

    for _ in {1..10}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "Stopped $service_name (pid $pid)"
  fi

  rm -f "$pid_file"
}

stop_pid_file "$FRONTEND_PID_FILE" "frontend"
stop_pid_file "$BACKEND_PID_FILE" "backend"

postgres_mode=""
if [[ -f "$POSTGRES_MODE_FILE" ]]; then
  postgres_mode="$(cat "$POSTGRES_MODE_FILE")"
fi

if [[ "$postgres_mode" == "compose" ]]; then
  POSTGRES_PORT="$POSTGRES_PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
elif [[ "$postgres_mode" == "external" ]]; then
  if docker ps --filter "name=^/${POSTGRES_CONTAINER_NAME}$" --format "{{.ID}}" | grep -q .; then
    docker stop "$POSTGRES_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
else
  POSTGRES_PORT="$POSTGRES_PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  if docker ps --filter "name=^/${POSTGRES_CONTAINER_NAME}$" --format "{{.ID}}" | grep -q .; then
    docker stop "$POSTGRES_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
fi

rm -f "$POSTGRES_MODE_FILE"

echo "All services stopped."
