# PaRo — Nifty-200 workspace (React + FastAPI + Postgres)

Monorepo layout:

| Path | Role |
|------|------|
| `api/` | FastAPI backend (Python 3.11+, Pydantic v2, SQLAlchemy 2, Alembic) |
| `web/` | Vite + React + TypeScript frontend |
| `docker-compose.yml` | api, db (pgvector), web, redis, worker |
| `Nifty Shares Viewer Wireframe/` | Prototype (`PaRo.dc.html`), build spec, phases, agent rules |
| `uploads/` | Seed CSV symlink/copy target (see `Nifty Shares Viewer Wireframe/uploads/`) |

## Quick start (Docker — preferred)

```bash
cp .env.example .env
# fill Azure Foundry + optional storage keys
docker compose up --build
```

- Web: http://localhost:5173  
- API: http://localhost:8000/health  
- Migrations run on api start (`alembic upgrade head`).

## Local without Docker

Requires Postgres 15+ with `pgvector`, and Redis (Phase 6). Set `DATABASE_URL` / `REDIS_URL` in `.env`, then:

```bash
cd api && python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

cd web && npm install && npm run dev
```

## Seed universe

```bash
cd api && python -m app.scripts.seed_universe
```

Uses `Nifty Shares Viewer Wireframe/uploads/ind_nifty200list.csv` by default.

## Docs

- `Nifty Shares Viewer Wireframe/AGENT.md` — build loop
- `Nifty Shares Viewer Wireframe/PHASES.md` — task queue
- `Nifty Shares Viewer Wireframe/PaRo_BUILD_SPEC.md` — architecture
- `Nifty Shares Viewer Wireframe/DEPLOY.md` — Phase 8 deploy paths
- `BUILD_LOG.md` — status / resume
