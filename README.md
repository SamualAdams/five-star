# five-star

Full-stack starter app:
- Frontend: Vite + React
- Backend: FastAPI
- Database: PostgreSQL (local Docker)
- Auth: email/password sign up + login with JWT

## Project structure

- `frontend/` Vite React app
- `backend/` FastAPI API
- `docker-compose.yml` local Postgres
- `build.sh` install/bootstrap script
- `start.sh` starts backend + frontend + Postgres for manual testing
- `stop.sh` stops all local services

## Quick start scripts

```bash
./build.sh
./start.sh
```

`start.sh` is for manual dev testing and launches the stack without running auth flow tests.
It also runs connectivity checks before reporting success:
- Postgres container readiness (`pg_isready`)
- Backend HTTP health (`GET /health`)
- Backend DB readiness (`GET /ready`, validates API-to-Postgres connectivity)
- Frontend reachability (`http://localhost:5173`)

If a `five-star-postgres` container already exists (for example you created it with Docker CLI), `start.sh` reuses it instead of trying to recreate it.

Optional: enable automated auth smoke checks while starting:

```bash
RUN_SMOKE_TESTS=1 ./start.sh
```

Smoke checks include:
- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

Use a different local Postgres host port if needed:

```bash
POSTGRES_PORT=5544 ./start.sh
```

Stop everything:

```bash
./stop.sh
```

## Environment files

- `backend/.env.example` is committed and used as template.
- `backend/.env` is created automatically by `build.sh` if missing.
- `frontend/.env.example` is committed and used as template.
- `frontend/.env` is created automatically by `build.sh` if missing.

## Manual run (optional)

### 1) Start PostgreSQL

```bash
docker compose up -d
```

Postgres is exposed at `localhost:5433` by default (`POSTGRES_PORT` can override) with:
- user: `postgres`
- password: `postgres`
- db: `five_star`

### 2) Run backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
