# PaRo Build Log

## Status
- Phase 0 — Scaffold & infra: DONE (code complete; live compose/alembic verify deferred)
- Phase 1 — Universe/prices/sync: DONE (code + offline tests; live DB/yfinance sync deferred)
- Phase 2 — Stock APIs + candles/indicators: IN_PROGRESS
- Phase 3 — Workspace + chart: TODO
- Phase 4 — Sectors/trends/journal/admin/settings: TODO
- Phase 5 — Sector AI: TODO
- Phase 6 — Book Library + RAG: TODO
- Phase 7 — Hardening: TODO
- Phase 8 — Deploy: TODO

## Active phase
Phase: 2
Next step: implement ma44/breadth helpers, /stocks list+detail, /candles with D/W/M aggregation + BB + RSI + unit tests

## Assumptions
- App monorepo lives at repo root (`/api`, `/web`); wireframe/spec docs stay under `Nifty Shares Viewer Wireframe/`.
- Docker is **not** available on this machine; compose files are authored for later. Local Postgres/psql also absent — DB boot/`alembic upgrade` deferred until Docker or local Postgres+pgvector is available.
- yfinance network access unavailable here; implement real provider + mock/fixture for offline unit tests; live sync deferred until network is available. Default `PRICE_PROVIDER=mock` in `.env.example` until yfinance works.
- Local Python is 3.14; Docker images pin Python 3.11 per spec. Code stays 3.11-compatible.
- Single-user constant: `DEFAULT_USER_ID = 1` (no users table required for v1 routes).
- Full sync window: **~4 years** daily bars (PHASES / §2 monthly-44MA requirement), not the §4 “~6 months” note.
- Phase 0/1 runtime “Done when” bars deferred per owner note; offline tests cover CSV, mock provider, partial sync status.

## Blockers
- No Docker / no local Postgres+pgvector → cannot run `docker compose up` or `alembic upgrade head` until runtime is provisioned.
- No yfinance access → Phase 1 live sync verification deferred; mock provider covers offline tests.

## Journal
- (2026-07-31 19:51) init — created log, starting Phase 0 (no Docker / no yfinance; scaffold-first, live verify later)
- (2026-07-31 20:00) phase0 — scaffolded api/web/compose/.env.example/alembic 0001 + health; pytest health OK; web build OK. Runtime compose/alembic deferred. commit 88b3f06
- (2026-07-31 20:15) phase1 — universe CSV parse/upload/seed, yfinance+mock providers, sync service + admin routes, IST APScheduler; 9 offline tests green (partial status via mock FAIL symbol). Live DB upsert deferred.
