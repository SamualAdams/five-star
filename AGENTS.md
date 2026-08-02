# AGENTS.md

Notes for AI coding agents (Claude Code, etc.) running this app locally. See
[README.md](README.md) for the human-facing quick start (`build.sh` / `start.sh`).
This file only covers things that differ from that flow or have bitten agents
running the app via the Browser-pane preview tooling.

## Preview tooling (`.claude/launch.json`)

The launch config runs the frontend on port **5274**, not the README's 5173,
and the backend on 8000:

```json
{
  "frontend": { "port": 5274 },
  "backend": { "port": 8000 }
}
```

Because of this, the backend's default CORS origin (`http://localhost:5173`,
from `backend/app/config.py`) does **not** match, and login/signup requests
fail client-side with `Failed to fetch` (the `OPTIONS` preflight returns
`400`). Fix by creating/editing `backend/.env`:

```
FRONTEND_ORIGIN=http://localhost:5274
APP_BASE_URL=http://localhost:5274
```

`backend/.env` is gitignored — safe to create/edit locally without affecting
the repo.

**`uvicorn --reload` does not watch `.env`** (only `*.py` by default), so
after editing `backend/.env` you must fully stop and restart the backend
preview server, not just wait for autoreload.

## Worktrees

`.claude/launch.json` is checked in with paths under the main checkout
(`/Users/jon/Desktop/workbench/five-star/...`). When working in a git
worktree, update both the `frontend` and `backend` `cd` targets in
`launch.json` to the worktree's path first — otherwise the preview serves
main-branch code instead of your changes. Revert before merging if the repo
wants `launch.json` to stay pointed at the primary checkout.

## Database port

`backend/app/config.py`'s default `DATABASE_URL` uses port **5432**, but the
project's own `five-star-postgres` Docker container (per `docker-compose.dev.yml`)
publishes on **5433** by default. On a dev machine that also runs some other
project's Postgres on 5432, the backend will connect to the *wrong* database
and fail with `password authentication failed for user "postgres"` rather
than "connection refused" — easy to misdiagnose as a CORS/auth bug instead of
a port collision. Check `docker ps` for the actual mapped port and set it
explicitly in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/five_star
```

## "Blank white page" / "dashboard isn't showing up" is not always an env problem

If the app loads (network tab shows 200s, login succeeds) but the page renders
totally blank, this is **not** the CORS/DB-port issue above — those fail
loudly (`Failed to fetch`, 401/500 in network). A silent blank page after a
successful login means a React render crashed with no error boundary, and
this has happened for a real reason in this app before:

**Root cause found 2026-08-02:** `App.jsx`'s route for `/org/:id/feed` read
`currentOrg.feedback_token` without optional chaining, while every sibling
prop on the same route used `currentOrg?.`. `currentOrg` is legitimately
`null` for one render frame whenever the `:id` in the URL doesn't match any
org the signed-in user currently has access to (stale bookmark, removed org
membership, deleted org, race on first load) — there's already a `useEffect`
(around line 184) that redirects such URLs to `/dashboard`, but it can only
run *after* the first render, and that first render was crashing before the
effect got a chance to fire. No error boundary exists, so the crash unmounts
the entire `<App>`, not just the feed page — which is why it can masquerade
as "the dashboard is broken" even though the dashboard code is fine. This
reproduced identically in production, confirming it was a real app bug, not
a local dev-environment artifact. Fixed by adding a `!currentOrg` loading
guard before that route touches org properties, matching the pattern already
used by the sibling `/org/:id/locations` route.

**Diagnosing this class of bug:** `read_console_messages` on this app only
surfaces React's generic `"An error occurred in the <App> component..."`
warning with `%s` placeholders — the actual `TypeError` and stack are logged
as separate `console.error` args that the tool doesn't stringify. To get the
real error and line number, use `javascript_tool` to attach a `window`
`error` listener *before* reproducing, or check what threw via the component
props involved (e.g. `grep` for the property name in the crash-adjacent
component and look for a version of the same line elsewhere in the file that
*does* guard it with `?.` — the inconsistency is usually the bug). Don't
assume a blank page automatically means the local backend/DB is misconfigured
— rule out an actual render crash first before touching `.env`.

## Browser-pane screenshots

Screenshots of this app taken via the Browser-pane preview tools come back
blank/ghosted whenever the page is scrolled down (a compositor quirk — the
page itself is fine, DOM checks pass). For below-the-fold content, resize the
viewport tall enough to show the target section without scrolling, or verify
with `read_page`/JS DOM checks instead of screenshots.
