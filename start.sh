#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$ROOT_DIR/.dev/pids"
LOG_DIR="$ROOT_DIR/.dev/logs"
BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BUILD_LOG="$LOG_DIR/build.log"
POSTGRES_MODE_FILE="$ROOT_DIR/.dev/postgres.mode"
POSTGRES_CONTAINER_NAME="five-star-postgres"
BACKEND_PORT=8000
FRONTEND_PORT=5173
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
BACKEND_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:${POSTGRES_PORT}/five_star"
RUN_SMOKE_TESTS="${RUN_SMOKE_TESTS:-0}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

container_exists() {
  docker ps -a --filter "name=^/${POSTGRES_CONTAINER_NAME}$" --format "{{.ID}}" | grep -q .
}

container_running() {
  docker ps --filter "name=^/${POSTGRES_CONTAINER_NAME}$" --format "{{.ID}}" | grep -q .
}

container_is_compose_managed() {
  local compose_project
  compose_project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$POSTGRES_CONTAINER_NAME" 2>/dev/null || true)"
  [[ -n "$compose_project" ]]
}

sync_port_from_container() {
  local mapped_port
  mapped_port="$(docker port "$POSTGRES_CONTAINER_NAME" 5432/tcp 2>/dev/null | head -n 1 | sed -E 's/.*:([0-9]+)$/\1/' || true)"
  if [[ -n "$mapped_port" ]]; then
    POSTGRES_PORT="$mapped_port"
    BACKEND_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:${POSTGRES_PORT}/five_star"
  fi
}

port_listeners() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u
}

assert_port_available() {
  local port="$1"
  local service_name="$2"
  local listeners
  listeners="$(port_listeners "$port" || true)"
  if [[ -n "$listeners" ]]; then
    echo "Port $port is already in use; cannot start $service_name." >&2
    echo "Run ./stop.sh or free the port, then retry." >&2
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local max_attempts="${2:-30}"
  local attempt=1

  while (( attempt <= max_attempts )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((attempt++))
  done

  return 1
}

wait_for_postgres() {
  local max_attempts=30
  local attempt=1

  while (( attempt <= max_attempts )); do
    if docker exec "$POSTGRES_CONTAINER_NAME" \
      pg_isready -U postgres -d five_star >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((attempt++))
  done

  return 1
}

cleanup_on_error() {
  echo "Start failed. Cleaning up partial startup..."
  "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
}

trap cleanup_on_error ERR

require_command curl
require_command docker

mkdir -p "$PIDS_DIR" "$LOG_DIR"

STOP_POSTGRES=0 "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
assert_port_available "$BACKEND_PORT" "backend"
assert_port_available "$FRONTEND_PORT" "frontend"

if ! "$ROOT_DIR/build.sh" >"$BUILD_LOG" 2>&1; then
  echo "Dependency/bootstrap step failed. See $BUILD_LOG" >&2
  exit 1
fi
echo "Dependencies installed."

if container_exists; then
  if ! container_running; then
    docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
  fi
  if container_is_compose_managed; then
    echo "compose" >"$POSTGRES_MODE_FILE"
  else
    echo "reused" >"$POSTGRES_MODE_FILE"
  fi
  sync_port_from_container
  echo "Using existing Postgres container: $POSTGRES_CONTAINER_NAME"
else
  POSTGRES_PORT="$POSTGRES_PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
  echo "compose" >"$POSTGRES_MODE_FILE"
  sync_port_from_container
fi

wait_for_postgres || {
  echo "Postgres did not become ready in time." >&2
  exit 1
}

(
  cd "$ROOT_DIR/backend"
  DATABASE_URL="$BACKEND_DATABASE_URL" \
    exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
) >"$BACKEND_LOG" 2>&1 &
echo "$!" >"$BACKEND_PID_FILE"

wait_for_http "http://127.0.0.1:${BACKEND_PORT}/health" || {
  echo "Backend did not become healthy in time. See $BACKEND_LOG" >&2
  exit 1
}

wait_for_http "http://127.0.0.1:${BACKEND_PORT}/ready" || {
  echo "Backend DB readiness check failed. See $BACKEND_LOG" >&2
  exit 1
}

if [[ "$RUN_SMOKE_TESTS" == "1" ]]; then
  API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
    "$ROOT_DIR/backend/.venv/bin/python" "$ROOT_DIR/scripts/happy_path_test.py"
fi

(
  cd "$ROOT_DIR/frontend"
  exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
) >"$FRONTEND_LOG" 2>&1 &
echo "$!" >"$FRONTEND_PID_FILE"

wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" || {
  echo "Frontend did not become ready in time. See $FRONTEND_LOG" >&2
  exit 1
}

trap - ERR

echo "Startup complete."
echo "Connectivity checks passed (Postgres, backend, DB readiness, frontend)."
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Backend:  http://localhost:${BACKEND_PORT}"
echo "Postgres: localhost:${POSTGRES_PORT}"
echo "Logs:     $LOG_DIR"
echo "Stop all: ./stop.sh"
echo "OPEN THIS URL: http://localhost:${FRONTEND_PORT}"
