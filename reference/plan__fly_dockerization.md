# Fly.io Dockerization Handoff

## Goal

Deploy `five-star` to Fly.io as a single containerized app:

- React frontend is built during the Docker build
- FastAPI backend serves the built frontend in production
- frontend and backend run on the same host
- Postgres is external via `DATABASE_URL`

This avoids managing separate frontend and backend deployments.

## Current Repo State

The repo already contains the first-pass Fly deployment setup on `main`.

Files already added or updated:

- `Dockerfile`
- `.dockerignore`
- `fly.toml`
- `backend/app/main.py`
- `backend/app/config.py`
- `frontend/src/api.js`

`render.yaml` was removed so Fly is now the active deployment direction.

## Deployment Model

### App Shape

- Single Fly app
- FastAPI serves API routes and also serves the built SPA from `frontend/dist`
- Browser routes like `/dashboard` and `/feedback/:token` are handled by SPA fallback
- JSON API routes stay under backend paths and should not fall through to the SPA

### Why This Shape

- simpler than separate frontend/backend apps
- no cross-origin frontend/backend setup in production
- easier to demo to local businesses quickly
- easier to reason about on Fly with one app and one URL

## Important Code Changes Already Made

### 1. Public feedback API moved under `/api`

The public feedback API was moved:

- from `/feedback/{token}`
- to `/api/feedback/{token}`

And:

- from `/feedback/{token}/submit`
- to `/api/feedback/{token}/submit`

Reason:

- the frontend page route `/feedback/:token` needs to resolve to the SPA
- the API route needs to remain JSON
- these two cannot safely share the same path prefix in a single-host deployment

### 2. FastAPI now serves the built frontend

`backend/app/main.py` now:

- looks for `frontend/dist`
- serves static built assets directly
- serves `index.html` for client-side routes
- preserves 404 behavior for API and reserved backend paths

### 3. Hosted Postgres URL normalization

`backend/app/config.py` now normalizes:

- `postgres://...`
- `postgresql://...`

into:

- `postgresql+psycopg://...`

This matters because hosted providers often hand out plain Postgres URLs, while this app uses SQLAlchemy with `psycopg`.

## Docker Setup Already Added

### `Dockerfile`

Multi-stage build:

1. build frontend with Node
2. install Python backend dependencies
3. copy backend code
4. copy built frontend assets into the final image
5. run Uvicorn on Fly’s `$PORT`

### `.dockerignore`

Excludes:

- git metadata
- local env files
- local virtualenvs
- node modules
- build artifacts
- local Codex and dev folders

### `fly.toml`

Current file is intentionally minimal:

- single app
- internal port `8080`
- HTTPS forced
- machine can autostop/autostart
- shared CPU
- 512 MB RAM

The `app` name still needs to be replaced with a real Fly app name.

## What Still Needs To Be Built Out

### Required

1. Validate the Docker image against Fly, not just local Docker.
2. Replace the placeholder app name in `fly.toml`.
3. Choose the database provider and set `DATABASE_URL`.
4. Set Fly secrets:
   - `DATABASE_URL`
   - `JWT_SECRET_KEY`
   - `FRONTEND_ORIGIN`
   - `OPENAI_API_KEY` if digests are needed
5. Run the first real `fly deploy`.
6. Verify the hosted app end to end.

### Strongly Recommended

1. Update `README.md` to document Fly deployment instead of Render.
2. Add explicit production deployment notes:
   - how to create the app
   - how to set secrets
   - how to deploy
   - how to inspect logs
3. Verify that invite URLs and feedback URLs use the final production domain correctly.
4. Decide whether the Fly region in `fly.toml` should stay `ord` or be changed.

### Optional But Useful

1. Add a release process if schema changes become more serious than `Base.metadata.create_all(...)`.
2. Add a custom domain.
3. Tighten the Docker image size if startup cost becomes noticeable.
4. Add production-safe observability/logging guidance.

## Database Recommendation

Do not default to Fly managed Postgres for this stage if cost is the main concern.

Reason:

- Fly managed Postgres is materially more expensive than the cheapest external hosted Postgres options.

Preferred path for a quick low-cost launch:

- keep app on Fly
- use external hosted Postgres
- pass the connection string in `DATABASE_URL`

## Secrets and Config

Minimum production secrets/config:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `FRONTEND_ORIGIN`

Optional:

- `OPENAI_API_KEY`

Notes:

- `FRONTEND_ORIGIN` should be the public Fly URL or custom domain
- because frontend and backend are same-host in production, `VITE_API_BASE_URL` is not required for Fly deployment

## Validation Checklist

Another agent should verify all of this after deploying:

1. App loads at `/`
2. Signup works
3. Login works
4. Organization creation works
5. Dashboard loads
6. Org settings loads
7. Public search page works
8. Public feedback page works
9. Feedback submission works
10. Invite flow works
11. Digest generation either:
    - works if `OPENAI_API_KEY` is set
    - fails clearly if it is not set

## Local Verification Already Completed

The following already passed locally before this handoff:

- `npm run build`
- Python compile check
- `docker build -t five-star-fly-test .`
- local app startup with smoke tests
- backend serving SPA HTML for frontend routes
- backend returning JSON for `/api/feedback/...`

## Suggested Next-Agent Tasks

1. Replace the placeholder Fly app name in `fly.toml`.
2. Update `README.md` for Fly deployment.
3. Pick and document the external Postgres provider.
4. Run:
   - `fly auth login`
   - `fly apps create ...`
   - `fly secrets set ...`
   - `fly deploy`
5. Fix any Fly-specific runtime issues discovered in the first deploy.
6. Confirm the production URL is ready for customer demos.
