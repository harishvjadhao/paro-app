# PaRo — Nifty-200 workspace (React + FastAPI + Postgres)

Monorepo layout:

| Path | Role |
|------|------|
| `api/` | FastAPI backend (Python 3.11+, Pydantic v2, SQLAlchemy 2, Alembic) |
| `web/` | Vite + React + TypeScript frontend |
| `docker-compose.yml` | api, db (pgvector), web, redis, worker |
| `Nifty Shares Viewer Wireframe/` | Prototype (`PaRo.dc.html`), build spec, phases, agent rules |

## Quick start (Docker — preferred)

```bash
cp .env.example .env
# fill Azure Foundry + optional storage keys; set PRICE_PROVIDER=yfinance when Yahoo is reachable
docker compose up --build
```

- Web: http://localhost:5173  
- API: http://localhost:8000/health  
- Migrations run on api start (`alembic upgrade head`).

## Local without Docker

Requires **Postgres 15+ with `pgvector`**, and Redis (book ingest queue). Set `DATABASE_URL` / `REDIS_URL` in `.env`, then:

```bash
cd api && python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

cd web && npm install && npm run dev
```

Offline/dev without Yahoo: `PRICE_PROVIDER=mock` in `.env`. Ingest runs inline if Redis is down.

## Seed + first sync

```bash
cd api
python -m app.scripts.seed_universe
# then POST /admin/sync {"mode":"Full"} or use Admin UI
```

CSV default: `Nifty Shares Viewer Wireframe/uploads/ind_nifty200list.csv`.

## Provider interfaces (swappable)

| Concern | Interface / factory | Implementations |
|---------|---------------------|----------------|
| Prices | `get_price_provider()` | `yfinance`, `mock` |
| Chat | `get_chat_provider()` | Azure Foundry |
| Embeddings | `get_embeddings_provider()` | Azure Foundry (+ stub if no key) |
| Vision OCR | `get_vision_provider()` | Azure Foundry |
| Object store | `get_storage()` | local filesystem (v1) |

## Timezone

Timestamps stored **UTC** in Postgres; scheduler cron uses `TZ=Asia/Kolkata` (IST). UI should display IST.

## Tests

```bash
cd api && python -m pytest tests -q
cd web && npm run build
```

## Smoke checklist (when Docker/DB/Yahoo ready)

1. `docker compose up` → `/health` ok, web shell loads  
2. Seed universe → Admin upload/sync → workspace lists stocks  
3. Chart D/W/M + BB/RSI toggles  
4. Sector / trends / journal charges  
5. Sector Ask AI streams (Foundry key set)  
6. Upload PDF → job ready → Library reader + Ask cites  
7. Daily incremental sync scheduled post-close IST  

## Deploy

See `Nifty Shares Viewer Wireframe/DEPLOY.md` (Phase 8 — pick a path before scaffolding deploy blueprints).

## Docs

- `Nifty Shares Viewer Wireframe/AGENT.md` — build loop  
- `Nifty Shares Viewer Wireframe/PHASES.md` — task queue  
- `Nifty Shares Viewer Wireframe/PaRo_BUILD_SPEC.md` — architecture  
- `BUILD_LOG.md` — status / resume  
