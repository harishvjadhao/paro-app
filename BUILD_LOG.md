# PaRo Build Log

## Status
- Phase 0 — Scaffold & infra: DONE
- Phase 1 — Universe/prices/sync: DONE
- Phase 2 — Stock APIs + candles/indicators: DONE
- Phase 3 — Workspace + chart: IN_PROGRESS (near parity; owner verification remaining)
- Phase 4 — Stock List / Sector / Trends / Journal / Settings+Highlights Partial
- Phase 5 — Sector AI: IN_PROGRESS (Partial)
- Phase 6 — Book Library + RAG: IN_PROGRESS (S10a–c Partial; owner verify remaining)
- Phase 7 — Hardening: TODO

## Active phase
Phase: 6 (S10c Book RAG Ask)
Next step: owner-verify citation jump/flash + delete cascade, then Phase 7 hardening / final gate

## Assumptions
- S0 includes a minimal swappable price-provider interface and a yfinance-first quote implementation with Yahoo chart API and Stooq fallback for later sync screens.
- Commands are run from the api folder for backend tasks so alembic and uvicorn match the requested invocation style.
- Browser-side API calls in local dev run from Vite on localhost:5173, so CORS is enabled for localhost origins.
- Chart highlight bands come from `chart_highlights`; daily comment markers remain separate.
- Stock List custom column values live in `stock_meta.custom_values` JSON; builtin hide state for Symbol/Company/etc. is client-local until S8 persistence needs broaden.
- Sector/trends weekly breadth uses 5-session week buckets from daily 44-MA above flags (prototype-aligned).
- Journal Zerodha rates live as domain constants in `app/domain/zerodha.py` (Settings/Admin exposure deferred).
- Settings theme/default-segment/clear-local are localStorage-only; clear-local never calls journal/comment delete APIs.
- Sector AI uses Azure Foundry when `AZURE_FOUNDRY_*` env is set; otherwise `StubChatProvider` returns a grounded demo reply. Tests force stub via `AI_FORCE_STUB=true`.
- S10a stores PDFs under `data/books/{id}/source.pdf`; OCR uses Azure vision when configured else stub.
- S10b reader chrome prefs (font/theme/family/width) are localStorage (`paro.readerPrefs`); progress/bookmarks/highlights are server-side per book for `user_id=1`.
- S10c embeddings use Azure when `AZURE_FOUNDRY_EMBEDDINGS_DEPLOYMENT` is set, else deterministic stub vectors; `VectorStore` is numpy/BLOB cosine (sqlite-vec hook reserved).

## Blockers
- S3–S10 still await formal owner verification.

## Verified state
- S0–S2 as previously recorded.
- S3–S8 as previously recorded.
- S9 sector-chat SSE + stub/Azure provider + Ask AI UI implemented; AI tests green; frontend build passed.
- S10a library tables + upload/ingest + shelf UI implemented; library tests green; frontend build passed.
- S10b reader tables + APIs + BookReader UI implemented; reader tests green; frontend build passed.
- S10c chunks/embeddings/RAG Ask + BookAskPanel implemented; RAG tests green; frontend build passed.

## Pending from current active scope
- Owner verification of S10c (cite char-ranges map to page text; click jumps + flashes; delete cascades chunks).
- Phase 7 / final gate after S10 sign-off.

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
- (2026-08-05 17:22) s2 backend — added sync data model + migration (`price_bars`, `sync_runs`, `sync_run_items`), sync repository/service orchestration with per-symbol result logging, retry-failed flow, run lock (409 on overlap), and APScheduler daily incremental trigger.
- (2026-08-05 17:30) s2 api/tests — added sync endpoints (`start/status/history/detail/retry/single-symbol`) and pytest coverage for partial run + retry-failed + concurrency guard. `alembic upgrade head` and `pytest -q` passed (6 tests).
- (2026-08-05 17:39) s2 frontend — wired Admin sync control/status/history/detail cards, disabled sync actions while running, added polling for active runs, and surfaced per-symbol failure messages + retry action. `npm run build` passed.
- (2026-08-05 19:45) s3 backend start — added workspace persistence (`stock_states`, `stock_comments`) with migration `0004_s3_workspace_tables`; introduced domain indicator module (SMA, aggregate W/M, Bollinger, RSI) and tests; added workspace APIs (`/stocks`, detail, candles, favorite/watch toggles, comments, order patch).
- (2026-08-05 19:46) s3 frontend start — replaced workspace stub with live discovery + detail layout (search, filter chips, grouped rows, quick sync, per-stock actions, timeline card, metrics, comments), wired typed workspace API client, and added dedicated workspace styling.
- (2026-08-05 19:47) s3 validate — `alembic upgrade head`, `pytest -q` (11 passed), and `npm run build` passed.
- (2026-08-28 10:00) progress audit — re-verified repo against live code and wireframe/docs. Marked S1 complete, S2 complete, and S3 in progress. Confirmed Sector, Trends, Journal, Stock List, and Library remain stub screens; recorded outstanding workspace parity gaps in this log.
- (2026-08-31 20:15) s3 parity — replaced SVG chart with canvas `PriceChart` (crosshair, BB/RSI, daily comment markers); added candle `markers` API field; favorites dropdown on search focus; fuller localStorage restore; list/detail skeletons + empty-universe state; comment edit UI. `pytest` workspace/indicator suites and `npm run build` passed.
- (2026-08-31 21:35) s4 stock list — added `stock_meta`/`stock_list_columns` migration, derive_screen domain helper, list/patch/column APIs + tests; wired `/list` editable grouped grid (sort/filter/hide/reorder, MA & screen overrides, custom columns, blur autosave toast).
- (2026-08-31 21:50) s5 sectors — added sector breadth/rotation domain helpers, `/sectors` list/detail/compare APIs + tests; wired Sector Analysis screen (tabs, metrics, sortable constituents + sparklines, rotation quadrant click-to-select, compare chart, AI stub).
- (2026-08-31 22:25) s6 trends — added `/trends/weekly` matrix + `/trends/weekly/{sector}/{weekIndex}` drill APIs, weekly aggregation tests; wired colour-scaled matrix UI with cell drill panel.
- (2026-08-31 22:40) s7 journal — added `trades` migration, `zerodha_charges` domain + tests, journal CRUD/analytics/positions/CSV APIs; wired Trading Journal UI with charge preview, equity curve, CSV I/O, and trade chart modal on `PriceChart` (entry/exit + candle/line).
- (2026-08-31 22:55) s8 settings/highlights — theme FOUC script, default segment + clear-local prefs; `chart_highlights` CRUD with label→color reuse; Admin highlights card; daily candle highlight bands.
- (2026-08-31 23:05) s9 sector AI — `ChatProvider`/`AzureFoundryChat`/`StubChatProvider`, grounded `POST /ai/sector-chat` SSE + rate limit; Sector Ask AI panel (stream/stop/retry/markdown/chips/pins).
- (2026-08-31 23:20) s10a library — migration `0008` (`books`/`book_pages`/`ingestion_jobs`/`book_suggestions`); PyMuPDF extract + OCR provider; upload/job/shelf APIs; Admin ingest stepper + Library shelf (thin page preview); `pytest` library 3 passed; `npm run build` passed.
- (2026-08-31 23:35) s10b reader — migration `0009` (`reading_progress`/`book_bookmarks`/`book_highlights`); progress/bookmarks/highlights/search APIs; Kindle-style `BookReader` (←/→, font, themes, width, TOC/search/bookmarks/highlights panel, select-to-highlight, export); reader tests green; `npm run build` passed.
- (2026-08-31 23:50) s10c rag — migration `0010` (`book_chunks`); chunk+embed on ingest; `VectorStore` (numpy/BLOB cosine) + stub/Azure embeddings; `/ask` `/explain-page` `/summarize-chapter` `/summarize-book` SSE + cites; Ask panel with retrieving/caret/p.N jump-flash; RAG tests green; `npm run build` passed.
