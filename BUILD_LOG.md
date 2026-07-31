# PaRo Build Log

## Status
- Phase 0 — Scaffold & infra: DONE (code; live compose/alembic deferred)
- Phase 1 — Universe/prices/sync: DONE (code + offline tests; live DB/yfinance deferred)
- Phase 2 — Stock APIs + candles/indicators: DONE
- Phase 3 — Workspace + chart: DONE (web build green)
- Phase 4 — Sectors/trends/journal/admin/settings: DONE (API + UI; live data deferred)
- Phase 5 — Sector AI: DONE (SSE + Sector UI; Foundry optional)
- Phase 6 — Book Library + RAG: DONE (API + shelf/reader shell; live PDF deferred)
- Phase 7 — Hardening: DONE (README/providers/TZ documented; e2e compose deferred)
- Phase 8 — Deploy: BLOCKED — awaiting deploy path choice (A/A1/B/C/D/E/F)

## Active phase
Phase: 8
Next step: owner picks DEPLOY.md path (A–F); then scaffold that blueprint under deploy/

## Assumptions
- Monorepo at repo root; docs under `Nifty Shares Viewer Wireframe/`.
- No Docker / Postgres / yfinance on build machine — offline tests + mock provider.
- `PRICE_PROVIDER=mock` until Yahoo reachable; Full sync ~4 years daily.
- Library ingest inline if Redis down; Azure optional (stub embeddings / config message).
- Embedding dim 1536. Journal trade→modal chart is deferred polish (candles API exists).
- Library reader Ask UI is wired at API; full flash-highlight polish can deepen once live PDF tested.
- Phase 7 compose e2e marked done for code readiness; runtime verify when Docker available.

## Blockers
- No Docker / Postgres+pgvector on this machine.
- No yfinance network access.
- Phase 8: deploy path not chosen.

## Journal
- (2026-07-31 19:51) init — Phase 0
- (2026-07-31 20:00) phase0 DONE — 88b3f06
- (2026-07-31 20:15) phase1 DONE — 70bfc64
- (2026-07-31 20:30) phase2 DONE — d412656
- (2026-07-31 21:30) phases 3–7 code complete; web build OK; 23 pytest green; Phase 8 waiting path choice
