# AGENTS.md

## Purpose

Use this file as the fast-start guide for AI coding agents working in this repository. Keep it minimal, actionable, and aligned with the live codebase.

## Repo Shape

- `api/`: FastAPI backend with SQLAlchemy, Alembic, and backend tests.
- `web/`: Vite + React + TypeScript frontend.
- `data/`: SQLite database files used by local development and tests.
- `Nifty Shares Viewer Wireframe/`: product, phase, and design reference docs. Treat these as reference material, not always as the source of truth for implemented behavior.

## Source Of Truth

Prefer these docs when you need commands or current implementation status:

- [README.md](README.md): local setup, migrations, run commands, test/build checks.
- [BUILD_LOG.md](BUILD_LOG.md): implemented scope and verified flows.
- [Nifty Shares Viewer Wireframe/AGENT.md](Nifty%20Shares%20Viewer%20Wireframe/AGENT.md): intended workflow and layering rules.
- [Nifty Shares Viewer Wireframe/PaRo_BUILD_SPEC.md](Nifty%20Shares%20Viewer%20Wireframe/PaRo_BUILD_SPEC.md): product intent.
- [Nifty Shares Viewer Wireframe/PHASES.md](Nifty%20Shares%20Viewer%20Wireframe/PHASES.md): phase checklist.
- [Nifty Shares Viewer Wireframe/DEPLOY.md](Nifty%20Shares%20Viewer%20Wireframe/DEPLOY.md): deployment notes.

Do not rely on `web/README.md` for project guidance; it is still the default Vite template.

## Working Directories

Command context matters in this repo.

- Run backend commands from `api/`.
- Run frontend commands from `web/`.
- The default local database is SQLite at `data/paro.db`.

## Common Commands

Backend from `api/`:

- Migrations: `../.venv/Scripts/python.exe -m alembic upgrade head`
- Run API: `../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`
- Tests: `../.venv/Scripts/python.exe -m pytest -q`

Frontend from `web/`:

- Install deps: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`

## Backend Architecture

Follow the existing backend layering:

- `app/routes/`: thin HTTP adapters.
- `app/services/`: business logic and orchestration.
- `app/repositories/`: database access.
- `app/providers/`: external integrations.
- `app/domain/`: pure domain calculations such as indicators.

Prefer fixing behavior in the layer that directly owns it rather than patching around it in routes.

## Frontend Architecture

Frontend is organized around:

- `src/screens/`: top-level UI screens.
- `src/api/`: typed API wrappers.
- `src/components/layout/`: app shell and navigation.
- `src/hooks/`: shared hooks.

Routing is simple and local in `web/src/App.tsx`. Some routes still render stub screens, so verify that a requested feature is implemented before extending it.

## Repo-Specific Conventions

- The live app is SQLite-first. If wireframe/spec docs mention Postgres, Redis, workers, or broader infra, verify against the current code before acting.
- Backend error responses are normalized as `{ error: { code, message, detail? } }`. Preserve that shape when adding or changing API failures.
- Some backend flows assume a single user and default to `user_id=1`. Do not introduce multi-user behavior accidentally.
- Workspace reads may trigger provider fetches and database writes when local bars are missing. Treat read-path changes carefully.
- Sync behavior uses both an in-memory lock and persisted run records; stale running rows are intentionally recoverable.
- Scheduler startup is wired into backend app lifecycle. Keep that in mind when changing startup behavior or tests.

## Validation Guidance

Use the narrowest check that matches the area you changed.

- Backend: run `pytest` from `api/`.
- Frontend: run `npm run lint` and/or `npm run build` from `web/`.
- If a change touches migrations or DB setup, run Alembic upgrade from `api/`.

## Pitfalls

- Wireframe/spec docs are useful, but they drift from the implemented stack in several places. Confirm behavior in code before editing.
- SQLite WAL sidecar files should remain ignored.
- Alternate frontend origins may fail until CORS config is updated in the backend.
- Search results may be noisy if generated frontend output or dependencies are included.

## Suggested Next Customizations

If this repo keeps growing, useful follow-ups would be:

1. A backend-specific instruction file for `api/**` covering testing, migrations, repository/service boundaries, and DB-side pitfalls.
2. A frontend-specific instruction file for `web/**` covering screen/API-client patterns, validation commands, and implemented-vs-stub screen checks.
3. A small skill for common local verification flows, such as running backend tests plus frontend build/lint together.

Use `/chronicle improve` over time to refine these instructions based on repeated friction in real coding sessions.
