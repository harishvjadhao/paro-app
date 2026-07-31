# PaRo — Build Checklist (single-agent, phased)

Work top to bottom. Do **one phase per session/PR**, run its checks, commit, then move on.
Sources of truth: `PaRo.dc.html` (UI/interactions) + `PaRo_BUILD_SPEC.md` (architecture/data/math).
For each phase, read the referenced spec section(s) — don't load the whole spec at once.

**v1 decisions (locked):** no auth (single-user); **Azure AI Foundry** for chat + embeddings + vision-OCR; no live orders/F&O; owner supplies the real Nifty-200 CSV.
Global rule: keep a constant `user_id` on per-user tables so multi-user can be added later without migration.

---

## Phase 0 — Scaffold & infra  · spec §1, §8
- [x] Monorepo: `/api` (FastAPI, Python 3.11, Pydantic v2, SQLAlchemy 2.0, Alembic) + `/web` (Vite + React + TS).
- [x] Postgres 15 **with pgvector**; docker-compose: `api`, `db`, `web`, `redis`, `worker`.
- [x] `.env`: `DATABASE_URL`, Azure Foundry (`endpoint`, `api_version`, deployments for `chat`/`embeddings`/`vision`, `key`), object-store creds. **No JWT.**
- [x] Health route + web app shell that boots.
- **Done when:** `docker compose up` serves API and web; `alembic upgrade head` runs clean.

## Phase 1 — Universe + prices + sync  · spec §2, §4, §5
- [x] Tables: `stock_universe`, `universe_uploads`, `price_bars`, `indicators`, `sync_runs`, `sync_run_items`.
- [x] CSV upload + validate (company, symbol, industry, series, isin; report total/dup/invalid; replace = destructive/confirmed).
- [x] Seed script loads the owner's Nifty-200 CSV at `uploads/ind_nifty200list.csv` (header: `Company Name, Industry, Symbol, Series, ISIN Code` → map to company/industry/symbol/series/isin; yahoo_symbol = `SYMBOL.NS`, `&`→ keep, e.g. `M&M.NS`; ~200 rows).
- [x] yfinance provider (swappable): Full sync (~2–4 yrs daily so monthly 44-MA fills), Incremental, single-stock; write `sync_runs`/`_items`; backoff + partial-failure state.
- [x] APScheduler daily incremental (IST, post-close).
- [x] Endpoints: `/universe`, `/admin/universe/upload`, `/admin/sync`, `/admin/sync/{symbol}`, `/admin/sync/runs`, `/admin/sync/runs/{id}`, retry-failed.
- **Done when:** upload → sync → `price_bars` populated; a forced failure shows a `partial` run with per-symbol messages.

## Phase 2 — Stock APIs + candles/indicators  · spec §2, §3
- [ ] `ma44`, `above`, `pct_vs_ma`.
- [ ] `/stocks?filter=all|ma|fav|watch&q=` grouped by industry; `/stocks/{symbol}`.
- [ ] `/stocks/{symbol}/candles?timeframe=D|W|M&bars=44&indicators=ma44,bb,rsi`:
  - [ ] W/M aggregation from daily (open=first, close=last, high=max, low=min, vol=sum).
  - [ ] 44-period MA on the selected timeframe.
  - [ ] Bollinger (20, 2, population σ) and Wilder RSI (14) arrays when requested.
  - [ ] Highlight/comment markers **daily only**.
- **Done when:** unit tests pass for MA, breadth, W/M aggregation, Bollinger, RSI.

## Phase 3 — Workspace + chart (frontend)  · spec §1, §7; prototype
- [ ] Nav rail + routing for all screens; three themes (Default/Sky/Dark) via CSS-var swap; Manrope + tokens.
- [ ] Discovery list (grouped, filters, favorites dropdown, per-industry reorder within group, collapse all, density).
- [ ] Analysis panel + **Price Timeline** canvas: candles + 44 MA + volume + crosshair; **timeframe switch (D/W/M, default D)**, **Bollinger toggle**, **RSI toggle**.
- [ ] Comments CRUD; watchlist/favorite toggles + reorder.
- [ ] ⌘K palette; `↑/↓` nav, `/` search, `Esc` clear; loading skeletons + empty-universe state wired to API.
- [ ] Persist theme/filter/last-screen/default-segment/timeframe/BB/RSI (localStorage). **Do not** persist an "empty universe" flag that blanks lists.
- **Done when:** workspace matches the prototype 1:1 including chart toggles.

## Phase 4 — Sectors, weekly trends, journal, admin, settings  · spec §2, §3, §5, §7
- [ ] Sector analysis: breadth, constituents (sortable + sparkline), leaders/momentum, rotation quadrant (click-to-select), compare legend.
- [ ] Weekly trends: 8-week breadth matrix + cell drill (`/trends/weekly`, `/trends/weekly/{sector}/{weekIndex}`).
- [ ] Journal: CRUD, open positions, tags/dates/filters, **Zerodha charge math incl. DP ₹15.34 delivery-sell**, unrealized P&L for open trades, analytics equity curve + by-segment/symbol, CSV import/export, trade→modal candle chart (entry/exit highlight, 44 MA, volume, candle/line).
- [ ] Admin: universe + sync UI (running disables conflicting actions) + highlights (label→color reuse).
- [ ] Settings: theme, default segment, clear-local-data.
- **Done when:** charge calc + weekly-trend aggregation tests pass; every list has empty/loading/error states.

## Phase 5 — Sector AI (Azure Foundry, streaming)  · spec §6
- [ ] `POST /ai/sector-chat` {sector, question}: build grounded prompt from live sector data; **stream (SSE)** via Azure Foundry chat.
- [ ] Frontend: streaming, stop, retry, markdown, stock-mention chips, select-to-pin; per-request rate-limit.
- **Done when:** answers stream and are grounded in real breadth/constituent data.

## Phase 6 — Book Library + RAG  · spec §9 (incl. 9.2 pipeline, 9.3 logic, 9.4 API, 9.7 sequence, 9.8 payloads)
- [ ] Tables (9.1): books, book_pages, book_chunks (pgvector), book_suggestions, ingestion_jobs, reading_progress, book_bookmarks, book_highlights.
- [ ] Object storage for PDFs + rendered page images; upload size/MIME checks.
- [ ] Worker pipeline: upload → detect kind → **parse (PyMuPDF) / OCR (Azure vision)** → segment pages+chapters → chunk (~600–900 tok, ~15% overlap) → **embed (Azure)** → suggestions → ready + report (pages/chunks/tokens/ocr_confidence). Live job state drives the Admin stepper.
- [ ] Reader APIs: pages, progress, bookmarks, highlights (GET = export), in-book search, rename, delete (cascade).
- [ ] RAG: `/ask` (scoped top-k vector search → **SSE** stream + `cites[]` with page/quote/char-range per 9.8), `explain-page`, `summarize-chapter`, `summarize-book`.
- [ ] Reader frontend (9.5): pagination + `←/→`, font A−/A+, themes, font-family, page-width, TOC/bookmarks/search/highlights panel, select-to-highlight, Ask panel (streaming + caret + retrieving state + clickable p.N jump-and-flash-highlight + suggestions + quick actions), export highlights; shelf rename/delete + delete confirm.
- **Done when:** a real PDF (text and scanned) ingests, reads, and answers with working citations; delete cascades; tests pass for chunking + citation char-range mapping + delete cascade.

## Phase 7 — Hardening
- [ ] Timezone (store UTC, show IST); Alembic migrations reviewed; docker-compose end-to-end.
- [ ] Provider interfaces confirmed swappable (yfinance, Azure chat/embed/vision).
- [ ] Seed/demo path documented in README; smoke test of every screen against the prototype.

## Phase 8 — Deploy  · see `DEPLOY.md`
- [ ] Pick a path: **A Free** · **A1 One-click** (`render.yaml`) · **B Azure** (Bicep button) · **C AWS** (CFN button) · **D Google Cloud** (button + Terraform) · **E Local/Windows** (E1 Docker Desktop, or E2 native) · **F Always-free VM 24/7** (Oracle Cloud Ampere A1 + compose + Caddy TLS).
- [ ] For one-click: commit the path's blueprint under `deploy/` (`render.yaml` / `azuredeploy.bicep`+`.json` / `paro.cfn.yaml` / `main.tf` + Cloud Run button), add the deploy button to README, push images to the registry where required, `CREATE EXTENSION vector` + `alembic upgrade head` on release, paste Azure Foundry + storage secrets once.
- [ ] Multi-stage Dockerfiles for api / worker / web; secrets via host store (not in image).
- [ ] Managed Postgres with `vector` extension enabled; migrations run as a release step.
- [ ] Object storage + Redis provisioned; worker running (or on-demand job on free tier).
- [ ] Web built and pointed at the API URL (CORS); HTTPS + domain.
- [ ] Run the **Post-deploy checklist** in `DEPLOY.md` (seed universe, first sync, Foundry reachable, ingest+ask work, daily sync scheduled, budget alert).
- **Done when:** the deployed app passes a full smoke test of every screen vs `PaRo.dc.html`.

---
### Do NOT (v1)
Login/JWT/multi-tenant · broker orders / order placement · live intraday ticks · F&O / multi-exchange charge schedules · cross-book "ask my whole library" search.
