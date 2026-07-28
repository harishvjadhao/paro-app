# PaRo — Build Spec (React + FastAPI + PostgreSQL + yfinance)

Hand this to the building agent along with `PaRo.dc.html` (the approved design/prototype). The prototype is the source of truth for **UI, layout, copy, and interactions**. This doc is the source of truth for **architecture and data**.

---

## 0. What PaRo is
A Nifty-200 stock-review workspace. Core idea: track each stock's position vs its **44-day moving average (44 MA)**, review by sector, journal trades with real Zerodha charges, and get AI commentary. Build the screens exactly as in `PaRo.dc.html`.

**Screens (nav rail order):** Market Workspace · Signals (44 MA filter) · Watchlist · Research (favorites) · Sector Analysis · Weekly Sector Trends · Trading Journal · Admin · Settings.

---

## 1. Tech + conventions
- **Frontend:** React (Vite + TypeScript), React Router, TanStack Query for data fetching/caching, lightweight state (Zustand or Context). Charts: keep the prototype's canvas approach or use a lib (lightweight-charts / visx) — must render candlesticks + 44 MA overlay + volume.
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 + Alembic migrations, `yfinance` for market data, APScheduler (or Celery + Redis) for sync jobs.
- **DB:** PostgreSQL 15+.
- **Auth:** JWT (access + refresh) or session; every mutating route requires auth. Journal/pins/comments/watchlist are **per-user**.
- Recreate the visual system from the prototype (design-system tokens: Manrope font, `--hex-blue #3C2CDA`, gray ramp, radii/shadows). Keep the three themes (Default / Sky Blue / Dark) as a CSS-variable swap.

---

## 2. Data model (Postgres)
- **users** (id, email, password_hash, created_at)
- **stock_universe** (id, symbol UNIQUE, company, industry, series, isin, yahoo_symbol, active bool, uploaded_batch_id) — the active list that gates everything.
- **universe_uploads** (id, filename, total, duplicates, invalid, uploaded_at, uploaded_by)
- **price_bars** (id, symbol, date, open, high, low, close, volume) — daily OHLCV; UNIQUE(symbol, date). Store enough history for a 44-day MA (≥ 90 sessions).
- **indicators** (symbol, date, ma44) — or compute on read; cache latest.
- **watchlist_items** (user_id, symbol, favorite bool, watchlist bool, sort_order, industry_sort_order)
- **comments** (id, user_id, symbol, body, created_at, updated_at)
- **chart_highlights** (id, date, label, color) — global; same label ⇒ same color (enforce server-side).
- **journal_trades** (id, user_id, symbol, segment ['Delivery'|'Intraday'], qty, buy_price, sell_price NULLABLE, entry_date, exit_date NULLABLE, note, tags text[], created_at) — `sell_price NULL` = open position.
- **sync_runs** (id, mode ['Full'|'Incremental'], status ['running'|'success'|'partial'|'failed'], started_at, finished_at, processed, updated, failed, error)
- **sync_run_items** (id, run_id, symbol, status ['ok'|'fail'], rows_written, window_start, window_end, message)

---

## 3. Key business logic (must match prototype exactly)

### 44 MA & breadth
- `ma44` = simple mean of the last 44 daily closes. `above = close >= ma44`. `pct_vs_ma = (close - ma44)/ma44*100`.
- **Sector breadth** = % of a sector's stocks with `above = true`.
- **Weekly Sector Trends** = for each of the last 8 weeks, per sector, the *average across the week's trading days* of (stocks above 44 MA / total). Cell sub-figure = avg count above.
- **Sector rotation** point = x: 8-week avg breadth, y: momentum = latest-week breadth − average of the prior 4 weeks.

### Zerodha charges (equity) — for the Trading Journal net P&L
Given buy_val = buy×qty, sell_val = sell×qty, turnover = buy_val+sell_val:
- Exchange txn (NSE) = turnover × 0.0000297; SEBI = turnover × 0.000001.
- **Delivery:** brokerage 0; STT = (buy_val+sell_val) × 0.001; stamp = buy_val × 0.00015; **DP charge = ₹15.34 per scrip on sell**.
- **Intraday:** brokerage = min(20, buy_val×0.0003) + min(20, sell_val×0.0003); STT = sell_val × 0.00025; stamp = buy_val × 0.00003; DP = 0.
- GST = (brokerage + txn + sebi) × 0.18. **total = brokerage+stt+txn+sebi+stamp+gst+dp.**
- gross = (sell−buy)×qty; **net = gross − total.**
- **Open trade** (no sell): charges 0, unrealized = (last_close − buy)×qty.
- Make these rates **config constants** (they change); expose in Settings/Admin later.

---

## 4. yfinance / sync
- Symbols are NSE: use `<SYMBOL>.NS` (e.g. `RELIANCE.NS`). Handle `&` symbols (M&M → `M&M.NS`).
- **Full Sync:** for every active universe symbol, clear any existing `price_bars` and indicator rows first, then fetch ~12 months daily bars, reinsert `price_bars`, and recompute `ma44`.
- **Incremental Sync:** fetch from the last synced trading date through today. If the latest stored bar is already for today, fetch and re-sync today's data again so the current session can be refreshed.
- **Single-stock sync** endpoint for the row-level "sync this stock"; use the same behavior as incremental sync for that symbol, fetching from the last synced trading date through today and re-syncing today's data again if today's bar already exists.
- Run inside a `sync_runs` record; write a `sync_run_items` row per symbol (ok/fail + message). Rate-limit and retry failures (yfinance throttles) → this produces the **partial-failure** state the UI shows.
- Schedule a daily incremental sync after market close (APScheduler cron, IST).
- yfinance is unofficial and flaky — wrap in try/except, backoff, and cache; make the provider a swappable interface so it can be replaced later.

---

## 5. REST API (suggested)
```
POST /auth/login, /auth/refresh
GET  /universe                      # active stocks
GET  /stocks?filter=all|ma|fav|watch&q=   # list + 44MA status, grouped by industry
GET  /stocks/{symbol}               # detail: identifiers, freshness, 44MA, pct
GET  /stocks/{symbol}/candles?range=44   # OHLCV + ma44 array + highlight/comment markers
GET  /stocks/{symbol}/comments  · POST · PATCH /{id} · DELETE /{id}
POST /watchlist/{symbol}/favorite  (toggle) · /watchlist   (reorder)
GET  /sectors  · GET /sectors/{name}        # breadth, constituents, leaders, momentum
GET  /sectors/rotation                       # quadrant points
GET  /trends/weekly                          # 8-week breadth matrix
GET  /trends/weekly/{sector}/{weekIndex}     # drill: constituents that week
GET/POST/PATCH/DELETE /journal/trades  · GET /journal/analytics  · GET/POST /journal/import|export (CSV)
GET/POST/DELETE /highlights
POST /admin/universe/upload (CSV multipart) · POST /admin/sync (mode) · POST /admin/sync/{symbol}
GET  /admin/sync/runs  · GET /admin/sync/runs/{id}   # logs + run detail; POST retry-failed
GET/PATCH /settings   # theme, default segment
```
CSV upload validation: require columns company, symbol, industry, series, isin; report total/duplicates/invalid; replacing the universe is a confirmed destructive action.

---

## 6. AI (Ask AI on Sector Analysis)
- Backend proxies to an LLM (do **not** expose keys to the frontend): `POST /ai/sector-chat` with `{sector, question}`; server builds the grounded prompt from live sector data (breadth, constituents vs 44 MA, weekly trend) and streams the reply (SSE). Frontend already expects streaming, stop, retry, markdown, stock-mention chips, and select-to-pin.
- Rate-limit per user.

---

## 7. Frontend must preserve (from prototype)
Interactions to replicate 1:1: click stock → analysis panel; search focus → favorites dropdown; ⌘K command palette; ↑/↓ stock nav, `/` search, `Esc` clear; density toggle; per-industry reorder (within group only); collapse/expand all; sector sortable table + sparkline + rotation click-to-select + compare legend; weekly-trend cell drill; journal open positions/tags/dates/filters/CSV/analytics equity curve + by-segment/symbol; trade → modal candle chart with entry/exit highlight, 44 MA, volume, candle/line toggle; comments CRUD; highlight label→color reuse; sync running disables conflicting actions; empty/loading/error states for every list.
- Loading skeletons and the empty-universe state must be wired to real API states.
- Persist theme, filter, last screen, default segment (localStorage is fine; server for cross-device later).

---

## 8. Non-functional
- Migrations via Alembic; seed script for a demo Nifty-200 CSV.
- `.env` for DB URL, JWT secret, LLM key; docker-compose (api + db + frontend).
- Tests: charge calc, 44 MA/breadth math, weekly-trend aggregation, sync idempotency.
- Timezone: store UTC, display IST.

---

## 9. Explicitly out of prototype scope (decide before building)
Real broker integration/order placement (prototype journal is manual), live intraday ticks (daily bars only), and multi-exchange/F&O charge schedules. Confirm whether these are in v1.
