# PaRo — Screen-by-Screen Implementation Guide

**For: GitHub Copilot coding agent.** Build **one screen per PR**. Do not start the next screen
until the current screen's **Verification gate** is signed off by the owner.

**Stack for this build (overrides `PaRo_BUILD_SPEC.md` §1/§8 infra):**

| Layer | This build | Spec said |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | same |
| Backend | Python 3.11 + FastAPI + Pydantic v2 + SQLAlchemy 2.0 + Alembic | same |
| DB | **SQLite** (`./data/paro.db`, WAL mode) | Postgres 15 + pgvector |
| Vector search | **`sqlite-vec`** ext; fallback = embeddings as BLOB + numpy cosine in Python | pgvector |
| Jobs | **APScheduler in-process** + FastAPI `BackgroundTasks` | Celery + Redis worker |
| Files | **local `./data/files/`** behind a `Storage` interface | object store |
| Runtime | `uvicorn` + `vite dev`; no Docker required | docker-compose |

Everything else in the spec (data model, business math, API shapes, RAG contract) still applies.
Keep every external dependency behind a swappable interface so SQLite → Postgres and local files →
S3/Blob are a config change, not a rewrite.

**Source of truth for UI:** `PaRo.dc.html` (open it in a browser). Match layout, copy, spacing,
colors, empty/loading states, and interactions. Do not invent new UI.

---

## 0. Ground rules for the agent

1. **One screen = one PR.** Branch `screen/<n>-<slug>`.
2. Order is fixed: **S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10**.
3. Each screen is built **full-stack vertically**: migration → repository → service → API route →
   API tests → typed client → React screen → screen tests.
4. **No business logic in route handlers or React components.** Layering:
   `routes → services → repositories → providers`.
5. Shared math (`ma20`, `ma44`, breadth, W/M aggregation, Bollinger, RSI, Zerodha charges) lives in
   `api/app/domain/` as **pure, unit-tested functions**. Written once, imported everywhere.
6. No auth. Single user. Keep a constant `user_id` column on per-user tables.
7. After each screen: update `BUILD_LOG.md`, tick this file's checkboxes, commit, then **stop and
   request verification**.
8. If something is ambiguous, take the smallest reasonable option, record it under `Assumptions` in
   `BUILD_LOG.md`, and continue — do not block.

### Verification gate (applies to every screen)
A screen is done only when **all** are true:
- [ ] All acceptance criteria in that screen's section pass, checked by hand in the browser.
- [ ] Screen matches `PaRo.dc.html` side-by-side at 1440×900 **and** at 900px wide (mobile stack).
- [ ] Loading, empty, and error states all render (force them by stubbing the API).
- [ ] `pytest` green; `npm run build` and `tsc --noEmit` clean; no console errors/warnings.
- [ ] `BUILD_LOG.md` updated with what changed + how it was verified.
- [ ] **Owner has replied "verified" for this screen.** Then and only then start the next screen.

---

## S0 — Foundation (no user-facing screen)

**Goal:** the shell everything else hangs off.

**Backend**
- `api/app/` layout: `main.py`, `db.py`, `models/`, `schemas/`, `repositories/`, `services/`,
  `domain/`, `providers/`, `routes/`, `tests/`.
- SQLite via SQLAlchemy: `sqlite:///./data/paro.db`, `PRAGMA journal_mode=WAL`,
  `PRAGMA foreign_keys=ON`, `check_same_thread=False`.
- Alembic initialised; `alembic upgrade head` creates an empty schema.
- `.env`: `DATABASE_URL`, `DATA_DIR`, Azure Foundry (`endpoint`, `api_version`, `key`, deployments
  for chat / embeddings / vision). No JWT.
- `GET /health` → `{status, db, version}`.
- Error envelope: every 4xx/5xx returns `{error:{code, message, detail?}}`.

**Frontend**
- Vite + React + TS + React Router. Folders: `src/screens/`, `src/components/`, `src/hooks/`,
  `src/api/`, `src/theme/`.
- **App shell from the prototype:** left icon nav rail (10 items, in prototype order), main region,
  Manrope font, CSS-variable design tokens, three themes (Default / Sky Blue / Dark) swapped by
  setting vars on the root — theme value read from `localStorage`.
- Typed API client (`src/api/client.ts`) + `useQuery`-style hook with `loading | error | data`.
- Reusable primitives used by every later screen: `Card`, `Chip`, `Pill`, `Button`, `IconButton`,
  `Modal`, `Toast`, `Skeleton`, `EmptyState`, `Dropdown`, `Tabs`.

**Nav rail (exact order + icon + target):**
| # | Icon (lucide) | Label | Route |
|---|---|---|---|
| 1 | `layout-dashboard` | Market workspace | `/workspace?filter=all` |
| 2 | `activity` | Signals · above 44 MA | `/workspace?filter=ma` |
| 3 | `bookmark` | Watchlist | `/workspace?filter=watch` |
| 4 | `flask-conical` | Research · favorites | `/workspace?filter=fav` |
| 5 | `layers` | Sector analysis | `/sector` |
| 6 | `bar-chart-3` | Weekly sector trends | `/trends` |
| 7 | `notebook-pen` | Trading journal | `/journal` |
| 8 | `table-2` | Stock list | `/list` |
| 9 | `book-open` | Library · reader | `/library` |
| 10 | `sliders-horizontal` | Admin | `/admin` |

Plus a settings affordance → `/settings`.

**Acceptance**
- [ ] `uvicorn app.main:app --reload` serves `/health`; `data/paro.db` is created.
- [ ] `npm run dev` boots; every nav item routes to a stub screen with the right title.
- [ ] Theme switch changes accent + dark surfaces app-wide and survives reload.

> **STOP. Request verification of S0 before S1.**

---

## S1 — Admin › Universe upload  (`/admin`, upper-left card)

**Why first:** no other screen has data until the universe exists.

**DB:** `stock_universe(id, symbol UNIQUE, company, industry, series, isin, yahoo_symbol, active,
created_at)`, `universe_uploads(id, filename, total, dup, invalid, mode, created_at)`.

**API**
- `POST /admin/universe/upload` (multipart) → validate headers `Company Name, Industry, Symbol,
  Series, ISIN Code`; report `{total, dup, invalid, preview[4]}`; `mode=append|replace`
  (replace is destructive → requires `confirm=true`).
- `GET /universe` · `DELETE /admin/universe` (clear).
- Seed script loads `uploads/ind_nifty200list (1).csv`. `yahoo_symbol = SYMBOL + ".NS"` (keep `&`,
  e.g. `M&M.NS`).

**UI states (all four exist in the prototype — build all four):**
`empty` (dashed "No stock universe uploaded yet") → `progress` (percent bar) → `success`
(total / duplicates / invalid + 4-row preview + timestamp) → `confirm` (replace warning modal).
Missing-column error shows the exact message: *"Missing required column(s): X. No changes were applied."*

**Acceptance**
- [ ] Real CSV uploads → 200 rows, correct dup/invalid counts, preview matches file.
- [ ] A CSV missing `ISIN Code` is rejected with the exact copy and **no** DB writes.
- [ ] Replace requires confirmation; cancel leaves data untouched.

> **STOP. Request verification of S1 before S2.**

---

## S2 — Admin › Sync control, status, run history  (`/admin`, rest of the page)

**DB:** `price_bars(symbol, date, o, h, l, c, v, UNIQUE(symbol,date))` (index `(symbol, date DESC)`),
`sync_runs(id, mode, scope, status, started_at, finished_at, processed, updated, failed, error)`,
`sync_run_items(run_id, symbol, status, rows, window, message)`.

**Provider:** `providers/prices.py` → `PriceProvider` interface, `YFinanceProvider` implementation.
Retry with backoff; per-symbol failure never aborts the run.

**Sync modes — exactly three, no others:**
| Mode | Scope | Trigger | Range fetched |
|---|---|---|---|
| **Full** | whole universe | Admin "Full Sync" | ~2–4 yrs daily (monthly 44-MA must fill) |
| **Incremental** | whole universe | Admin "Incremental Sync" + daily scheduler | since last bar |
| **Quick sync** | **watchlist symbols only** | sidebar button on Workspace | since last bar (incremental) |

Quick sync is *not* a fourth mode — it is `mode=incremental, scope=watchlist`. Log it as
`Incremental · Watchlist`.

**API:** `POST /admin/sync {mode, scope}` · `POST /admin/sync/{symbol}` ·
`GET /admin/sync/status` (poll while running) · `GET /admin/sync/runs` ·
`GET /admin/sync/runs/{id}` (per-symbol items) · `POST /admin/sync/runs/{id}/retry-failed`.
Runs execute in a `BackgroundTasks`/APScheduler job; a global lock prevents concurrent runs.

**Scheduler:** APScheduler daily incremental, IST post-close.

**UI:** Sync Control (Full / Incremental buttons — **disabled while running**), Sync Status card
(status dot, mode, processed/updated/failed/total, progress, last success, error banner on partial),
Run History list with per-run drill-down table and retry-failed.
Admin has **no theme card** (theme lives in Settings) and **no quick-sync button**.

**Acceptance**
- [ ] Full sync populates `price_bars` for all 200 symbols; progress advances live in the UI.
- [ ] Forcing 3 symbol failures yields a `partial` run with per-symbol messages and a retry action.
- [ ] Both sync buttons disable while a run is in flight; a second POST returns 409.

> **STOP. Request verification of S2 before S3.**

---

## S3 — Market Workspace  (`/workspace`) — the core screen

**Domain functions first (pure, unit-tested):** `sma(series, n)`, `above_ma`, `pct_vs_ma`,
`aggregate(daily, "W"|"M")` (open=first, close=last, high=max, low=min, vol=sum),
`bollinger(close, 20, 2, population σ)`, `rsi_wilder(close, 14)`.

**API**
- `GET /stocks?filter=all|ma|fav|watch&q=` → grouped by industry, each stock with last close, %
  change, MA state, sync status.
- `GET /stocks/{symbol}` → detail header + stats.
- `GET /stocks/{symbol}/candles?timeframe=D|W|M&bars=44&indicators=ma44,bb,rsi`.
- `POST /stocks/{symbol}/favorite` · `/watch` (toggle) · `PATCH /stocks/order` (per-industry order).
- Comments: `GET/POST/PATCH/DELETE /stocks/{symbol}/comments`.

**UI — left sidebar:** filter chips, search (`/` focuses), favorites dropdown, density toggle,
collapse-all, **Quick sync** button (watchlist incremental — S2), industry groups with collapse,
per-row favorite / watchlist / external-chart / sync-one / reorder actions.

**UI — right panel:** stock header + stats strip, **Price Timeline canvas** (candles + 44 MA +
volume + crosshair + legend), timeframe switch **D / W / M (default D)**, Bollinger toggle, RSI
toggle, comments list with add/edit/delete.

**Also here:** ⌘K command palette; `↑/↓` moves selection; `Esc` clears selection; skeletons while
loading; empty-universe state; persist `filter`, `selected`, `timeframe`, `bb`, `rsi`, `dense`,
`collapsed`, `order` to localStorage.

**Chart:** one reusable `<PriceChart>` component (canvas, devicePixelRatio-aware, ResizeObserver).
Highlight/comment markers render on **daily only**.

**Acceptance**
- [ ] MA / breadth / W-M aggregation / Bollinger / RSI unit tests pass against hand-computed values.
- [ ] Switching D→W→M re-fetches and redraws; toggles add/remove overlays without a full reload.
- [ ] Keyboard: `/`, `↑/↓`, `Esc`, ⌘K all behave as in the prototype.
- [ ] Reload restores the exact previous view.

> **STOP. Request verification of S3 before S4.**

---

## S4 — Stock List  (`/list`) — editable SharePoint-style grid

**DB:** `stock_meta(symbol PK, subcategory, notes, screen, ma_d_override, ma_w_override,
ma_m_override, updated_at)`, `stock_list_columns(id, key, label, type, options_json, position,
hidden)` for user-added columns.

**API:** `GET /list` (200 rows: symbol, company, industry, subcategory, notes, three MA states,
screen) · `PATCH /list/{symbol}` (partial, one field per edit) · `POST /list/columns` ·
`PATCH /list/columns/{id}` · `DELETE /list/columns/{id}`.

**Columns (default order):** Symbol · Company Name · Industry · Subcategory *(auto-curated,
editable)* · Notes · **20 MA (D)** · **20 MA (W)** · **20 MA (Aug '26 M)** · **Screen**.

**Rules**
- MA columns are computed (green *Above* / red *Below* pill) but **manually overridable** — an
  override wins until cleared.
- `Screen` is a colour-coded choice: Strong buy / Buy / Watch / Avoid / On hold, **auto-derived**
  from how many of the three timeframes are above the 20 MA, and manually overridable.
- Inline edit **auto-saves on blur** with a toast. No unsaved-changes bar.
- Column header menu: sort, filter, group by, hide. Columns are **drag-reorderable** by handle.
- Default grouping = Industry, groups collapsible; paging is **within** each group and the count
  reads "n of N" accurately.

**Acceptance**
- [ ] All 200 rows load; edit → blur → toast → value survives reload.
- [ ] Clearing an MA override restores the computed pill.
- [ ] Group/filter/sort/hide/reorder all work and persist.

> **STOP. Request verification of S4 before S5.**

---

## S5 — Sector Analysis  (`/sector`)

**API:** `GET /sectors` (breadth per sector) · `GET /sectors/{sector}` (constituents + sparkline
series, leaders, momentum, rotation-quadrant coordinates) · `GET /sectors/compare?a=&b=`.

**UI:** breadth summary, sortable constituents table with sparklines, leaders / momentum lists,
rotation quadrant (click a bubble to select), compare legend. Chat panel stub only — the AI wiring
is S9.

**Acceptance**
- [ ] Breadth numbers reconcile with `/stocks` MA states for the same sector.
- [ ] Quadrant click selects, and the selection drives the constituents table.

> **STOP. Request verification of S5 before S6.**

---

## S6 — Weekly Sector Trends  (`/trends`)

**API:** `GET /trends/weekly` (8-week × sector breadth matrix) ·
`GET /trends/weekly/{sector}/{weekIndex}` (drill: which stocks flipped).

**UI:** colour-scaled matrix, cell click opens the drill panel, week labels from real bar dates.

**Acceptance**
- [ ] Weekly aggregation unit tests pass; matrix cell values match a manual spot-check.
- [ ] Drill lists the correct constituents for the clicked cell.

> **STOP. Request verification of S6 before S7.**

---

## S7 — Trading Journal  (`/journal`)

**DB:** `trades(id, user_id, symbol, segment, side, qty, entry_price, entry_date, exit_price,
exit_date, tags, notes, created_at)`.

**Domain:** `zerodha_charges(...)` — pure function, incl. **DP charge ₹15.34 on delivery sell**.
Unit-test every component (brokerage, STT, exchange txn, GST, SEBI, stamp, DP).

**API:** trades CRUD · `GET /journal/analytics` (equity curve, by segment, by symbol) ·
`GET /journal/positions` (open, with unrealized P&L from latest close) ·
`POST /journal/import` / `GET /journal/export` (CSV).

**UI:** trade table with tag/date/segment filters, open-positions panel, analytics charts,
CSV import/export, and a trade → modal candle chart (entry/exit markers, 44 MA, volume,
candle/line switch) reusing `<PriceChart>`.

**Acceptance**
- [ ] Charge math matches a real Zerodha contract note to the paisa.
- [ ] Unrealized P&L updates after a sync.
- [ ] Export → import round-trips without data loss.

> **STOP. Request verification of S7 before S8.**

---

## S8 — Settings  (`/settings`) + Admin › Chart highlights

**Settings:** theme (Default / Sky Blue / Dark), default segment, clear-local-data (with confirm).
This is the **only** place theme lives.

**Admin highlights:** `chart_highlights(id, label, color, symbol?, date_from, date_to)` — CRUD with
label→colour reuse; markers render on daily charts (S3).

**Acceptance**
- [ ] Theme persists and applies on cold load before first paint (no flash).
- [ ] Clear-local-data resets UI prefs but never touches server data.
- [ ] A highlight created in Admin appears on the matching daily chart.

> **STOP. Request verification of S8 before S9.**

---

## S9 — Sector AI chat  (`/sector`, right panel)

**Provider:** `providers/ai.py` → `ChatProvider` interface + `AzureFoundryChat` implementation.

**API:** `POST /ai/sector-chat {sector, question}` → build a grounded prompt from **live** breadth +
constituent data, **stream via SSE**. Per-request rate limit.

**UI:** streaming text with caret, stop, retry, markdown, stock-mention chips, select-to-pin, pins
list with export.

**Acceptance**
- [ ] Answers stream token-by-token; stop actually cancels the request server-side.
- [ ] Every factual claim traces to data in the prompt (spot-check 3 questions).

> **STOP. Request verification of S9 before S10.**

---

## S10 — Book Library + Reader + RAG  (`/library`)

Biggest screen — split into **three sequential PRs**, each with its own gate.

**S10a — Shelf + ingestion (Admin stepper)**
`books`, `ingestion_jobs`, `book_pages`. Upload PDF (size/MIME checks) → local storage → background
pipeline: detect kind → parse (PyMuPDF) / OCR (Azure vision) → segment pages + chapters → report
(pages / chunks / tokens / ocr_confidence). Live job state drives the stepper. Shelf grid with
rename / delete (cascade) / delete-confirm.
- [ ] A text PDF and a scanned PDF both ingest to `ready`; failures show a real error.

**S10b — Reader**
`reading_progress`, `book_bookmarks`, `book_highlights`. Pagination + `←/→`, font A−/A+, reader
themes (light/sepia/dark), font family, page width, TOC / bookmarks / search / highlights panel,
select-to-highlight popover, export highlights.
- [ ] Progress, bookmarks, and highlights all survive reload and are per-book.

**S10c — RAG / Ask**
`book_chunks` with embeddings — `sqlite-vec` if available, else BLOB + numpy cosine, **behind one
`VectorStore` interface** so Postgres/pgvector drops in later. Chunk ~600–900 tokens, ~15% overlap.
Endpoints: `/ask` (scoped top-k → SSE stream + `cites[]` with page / quote / char-range),
`explain-page`, `summarize-chapter`, `summarize-book`. UI: Ask panel with retrieving state,
streaming caret, clickable `p.N` that jumps and flash-highlights, suggestions, quick actions.
- [ ] Citation char-ranges map to the real page text; clicking a cite jumps and flashes.
- [ ] Deleting a book cascades chunks, pages, highlights, bookmarks, progress.

> **STOP. Request verification of each S10 sub-PR before the next.**

---

## Final gate — before calling the build done
- [ ] Every screen above verified by the owner.
- [ ] Full smoke test of all 10 nav destinations against `PaRo.dc.html`.
- [ ] `pytest` green; `tsc --noEmit` clean; `npm run build` succeeds.
- [ ] README documents: install, seed, run, and the SQLite → Postgres migration path.
- [ ] `BUILD_LOG.md` has an entry per screen.

### Do NOT build (v1)
Login / JWT / multi-tenant · broker orders · live intraday ticks · F&O or multi-exchange charge
schedules · cross-book "ask my whole library" search.

---

### Kickoff prompt for the agent
> Read `SCREENS.md`, then `AGENT.md` and `PaRo_BUILD_SPEC.md`. Stack is React + FastAPI + SQLite as
> described in SCREENS.md (it overrides the spec's Postgres/Docker/Celery infra). Start at **S0**,
> build it end-to-end, run its acceptance checks, update `BUILD_LOG.md`, open a PR, and then STOP
> and ask me to verify. Do not begin S1 until I reply "verified".
