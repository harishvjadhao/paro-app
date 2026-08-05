# PaRo Build Log

## Status
- Phase 0 — Scaffold & infra: DONE
- Phase 1 — Universe/prices/sync: IN_PROGRESS
- Phase 2 — Stock APIs + candles/indicators: TODO
- Phase 3 — Workspace + chart: TODO
- Phase 4 — Sectors/trends/journal/admin/settings: TODO
- Phase 5 — Sector AI: TODO
- Phase 6 — Book Library + RAG: TODO
- Phase 7 — Hardening: TODO

## Active phase
Phase: 1
Next step: wait for owner verification of S1, then start S2 sync control/status/run-history

## Assumptions
- S0 includes a minimal swappable price-provider interface and a yfinance-first quote implementation with Yahoo chart API and Stooq fallback for later sync screens.
- Commands are run from the api folder for backend tasks so alembic and uvicorn match the requested invocation style.
- Browser-side API calls in local dev run from Vite on localhost:5173, so CORS is enabled for localhost origins.

## Blockers
-

## Journal
- (2026-08-05 15:20) init — created log and started S0 foundation implementation.
- (2026-08-05 15:42) s0 backend — added FastAPI app skeleton, SQLite WAL/foreign-key initialization, centralized error envelope handlers, health route, Alembic bootstrap, and initial migration.
- (2026-08-05 15:48) s0 frontend — scaffolded Vite React TypeScript app, implemented nav rail shell/routes for all destinations, added settings theme switch with localStorage persistence, and created reusable primitive components plus typed API client and useQuery hook.
- (2026-08-05 15:54) verify — ran alembic upgrade head, pytest, live uvicorn /health check, npm run build, and tsc --noEmit; all passing. commit d6ea7da.
- (2026-08-05 15:58) cleanup — ignored and removed SQLite WAL sidecar files from git tracking. commit 3d7c3d7.
- (2026-08-05 16:32) s1 backend — added stock_universe/universe_uploads models and migration, upload CSV parsing/validation service, universe repository, admin upload/list/clear routes, and seed script for uploads/ind_nifty200list (1).csv.
- (2026-08-05 16:36) s1 frontend — replaced admin stub with universe upload card states (empty/progress/success/confirm), wired multipart API client, and added exact missing-column error rendering.
- (2026-08-05 16:40) s1 verify — alembic upgrade head, pytest (4 passed), npm run build, live API/browser acceptance checks for 200-row upload, exact missing ISIN rejection with no writes, and replace-confirm/cancel behavior. commit 040e1f2.
- (2026-08-05 16:58) s1 ui-align — reworked admin stock-universe card layout/copy/styling to match PaRo wireframe structure (intro text, field chips, drop zone CTAs, inline replace warning, validation/success panels, summary boxes, preview table, clear action).
