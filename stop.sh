#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$ROOT_DIR/.dev/pids"
BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"
POSTGRES_MODE_FILE="$ROOT_DIR/.dev/postgres.mode"
POSTGRES_CONTAINER_NAME="five-star-postgres"
BACKEND_PORT=8000
FRONTEND_PORT=5173
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
STOP_POSTGRES="${STOP_POSTGRES:-1}"

container_exists() {
  docker ps -a --filter "name=^/${POSTGRES_CONTAINER_NAME}$" --format "{{.ID}}" | grep -q .
}

container_is_compose_managed() {
  local compose_project
  compose_project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$POSTGRES_CONTAINER_NAME" 2>/dev/null || true)"
  [[ -n "$compose_project" ]]
}

stop_pid() {
  local pid="$1"
  local service_name="$2"

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
}

stop_pid_file() {
  local pid_file="$1"
  local service_name="$2"

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  stop_pid "$pid" "$service_name"

  rm -f "$pid_file"
}

stop_listener_by_pattern() {
  local port="$1"
  local service_name="$2"
  local pattern="$3"

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    local command
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command" == *"$pattern"* ]]; then
      stop_pid "$pid" "$service_name"
    fi
  done < <(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)
}

stop_pid_file "$FRONTEND_PID_FILE" "frontend"
stop_pid_file "$BACKEND_PID_FILE" "backend"
stop_listener_by_pattern "$FRONTEND_PORT" "frontend" "node_modules/.bin/vite"
stop_listener_by_pattern "$BACKEND_PORT" "backend" "uvicorn app.main:app"

postgres_mode=""
if [[ -f "$POSTGRES_MODE_FILE" ]]; then
  postgres_mode="$(cat "$POSTGRES_MODE_FILE")"
fi

if [[ "$STOP_POSTGRES" == "1" ]]; then
  if [[ "$postgres_mode" == "compose" ]]; then
    POSTGRES_PORT="$POSTGRES_PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  elif [[ -z "$postgres_mode" ]] && container_exists && container_is_compose_managed; then
    POSTGRES_PORT="$POSTGRES_PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi

  rm -f "$POSTGRES_MODE_FILE"
fi

echo "All services stopped."
