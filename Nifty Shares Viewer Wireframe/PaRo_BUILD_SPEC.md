# PaRo — Build Spec (React + FastAPI + PostgreSQL + yfinance)

Hand this to the building agent along with `PaRo.dc.html` (the approved design/prototype). The prototype is the source of truth for **UI, layout, copy, and interactions**. This doc is the source of truth for **architecture and data**.

---

## 0. What PaRo is
A Nifty-200 stock-review workspace. Core idea: track each stock's position vs its **44-day moving average (44 MA)**, review by sector, journal trades with real Zerodha charges, and get AI commentary. Build the screens exactly as in `PaRo.dc.html`.

**Screens (nav rail order):** Market Workspace · Signals (44 MA filter) · Watchlist · Research (favorites) · Sector Analysis · Weekly Sector Trends · Trading Journal · **Library (Kindle-style reader)** · Admin · Settings.

PaRo also includes a **Book Library**: admins ingest PDF books (text or scanned/image) through a parse → OCR → chunk → embed pipeline; users read them in a Kindle-style reader and ask questions answered from the book's own text with page citations (RAG). See §9.

---

## 1. Tech + conventions
- **AI providers: Azure AI Foundry** for everything model-related — chat/completions (sector chat + book Q&A/summaries), text **embeddings** (RAG vectors), and **vision/OCR** (scanned-PDF reading). Wrap each behind a swappable interface; config (endpoint, deployment names, key, api-version) via `.env`, server-side only.
- **Frontend:** React (Vite + TypeScript), React Router, TanStack Query for data fetching/caching, lightweight state (Zustand or Context). Charts: keep the prototype's canvas approach or use a lib (lightweight-charts / visx) — must render candlesticks + 44 MA overlay + volume, a **Daily/Weekly/Monthly timeframe switch** (default Daily), an optional **Bollinger Bands (20, 2)** overlay, an optional **RSI (14)** sub-panel, and the hover crosshair. See §3.
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 + Alembic migrations, `yfinance` for market data, APScheduler (or Celery + Redis) for sync jobs.
- **DB:** PostgreSQL 15+.
- **Auth:** **none in v1 — single-user, single-tenant.** Leave routes open (or a single hard-coded local user); do **not** build login/JWT yet. Keep a `user_id` column on per-user tables (journal, pins, comments, watchlist, reading_progress, bookmarks, highlights) defaulted to a constant so multi-user auth can be layered on later without a migration. `owner_id` on books stays NULL (shared) for now.
- Recreate the visual system from the prototype (design-system tokens: Manrope font, `--hex-blue #3C2CDA`, gray ramp, radii/shadows). Keep the three themes (Default / Sky Blue / Dark) as a CSS-variable swap.

---

## 2. Data model (Postgres)
- **users** (id, email, password_hash, created_at)
- **stock_universe** (id, symbol UNIQUE, company, industry, series, isin, yahoo_symbol, active bool, uploaded_batch_id) — the active list that gates everything.
- **universe_uploads** (id, filename, total, duplicates, invalid, uploaded_at, uploaded_by)
- **price_bars** (id, symbol, date, open, high, low, close, volume) — daily OHLCV; UNIQUE(symbol, date). Store enough history for a 44-day MA (≥ 90 sessions).
- **indicators** (symbol, date, ma44) — or compute on read; cache latest. Weekly/monthly bars, Bollinger, and RSI are derived on read from `price_bars` (see §3), so store enough daily history that a 44-period MA still fills on the **monthly** timeframe (≈ 44×21 + warm-up ≈ 2–4 years of daily bars).
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

### Chart timeframes & indicators (Price Timeline)
- **Timeframe** switch: Daily (default) / Weekly / Monthly. Weekly/monthly bars are **aggregated from daily** `price_bars`: `open`=first, `close`=last, `high`=max, `low`=min, `volume`=sum, date=last bar in the bucket. The prototype buckets by fixed **5** (weekly) and **21** (monthly) trading days; production should prefer true ISO-week / calendar-month buckets — keep the visual identical.
- The chart shows the most recent **44 bars** of the selected timeframe; the **44-period MA** is computed on that timeframe's closes (so weekly/monthly MA needs ≥ 44 prior bars — see §2 history note). MA period stays 44 across all timeframes.
- **Bollinger Bands** (default period 20, k 2), off by default: `mid` = 20-period SMA of close on the selected timeframe; `upper/lower = mid ± 2·σ`, σ = population stdev of the last 20 closes.
- **RSI** (default 14), off by default, drawn in a sub-panel with 30/50/70 guides: Wilder's RSI — seed `avgGain/avgLoss` = simple average of the first 14 gains/losses, then smooth `avg = (avg×13 + current)/14`; `RSI = 100 − 100/(1 + avgGain/avgLoss)`.
- Highlight bands and comment markers render on the **Daily** timeframe only. Toggles (timeframe / Bollinger / RSI) persist per user.
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
- **Full Sync:** fetch ~6 months daily bars for every active universe symbol, upsert `price_bars`, recompute `ma44`.
- **Incremental Sync:** fetch only missing recent sessions.
- **Single-stock sync** endpoint for the row-level "sync this stock".
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
GET  /stocks/{symbol}/candles?timeframe=D|W|M&bars=44&indicators=ma44,bb,rsi
     # OHLCV + ma44 array (+ optional bollinger{mid,up,lo} & rsi arrays) + highlight/comment markers (markers: daily only)
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
CSV upload validation: accept the NSE Nifty-200 export headers `Company Name, Industry, Symbol, Series, ISIN Code` (map → company, industry, symbol, series, isin); derive `yahoo_symbol = symbol + ".NS"`. Report total/duplicates/invalid; replacing the universe is a confirmed destructive action. Reference file: `uploads/ind_nifty200list.csv`.

---

## 6. AI (Ask AI on Sector Analysis)
> PaRo has **two** AI surfaces: (a) sector chat, below; (b) **Ask-this-book RAG** in the Library reader, specified in §9. Both go through a server-side LLM proxy — never expose keys to the frontend.
- Backend proxies to an LLM (do **not** expose keys to the frontend): `POST /ai/sector-chat` with `{sector, question}`; server builds the grounded prompt from live sector data (breadth, constituents vs 44 MA, weekly trend) and streams the reply (SSE). Frontend already expects streaming, stop, retry, markdown, stock-mention chips, and select-to-pin.
- Rate-limit per user.

---

## 7. Frontend must preserve (from prototype)
Interactions to replicate 1:1: click stock → analysis panel; **Price Timeline timeframe switch (Daily/Weekly/Monthly, default Daily), Bollinger (20,2) toggle, RSI (14) toggle**, hover crosshair; search focus → favorites dropdown; ⌘K command palette; ↑/↓ stock nav, `/` search, `Esc` clear; density toggle; per-industry reorder (within group only); collapse/expand all; sector sortable table + sparkline + rotation click-to-select + compare legend; weekly-trend cell drill; journal open positions/tags/dates/filters/CSV/analytics equity curve + by-segment/symbol; trade → modal candle chart with entry/exit highlight, 44 MA, volume, candle/line toggle; comments CRUD; highlight label→color reuse; sync running disables conflicting actions; empty/loading/error states for every list.
- Loading skeletons and the empty-universe state must be wired to real API states.
- Persist theme, filter, last screen, default segment, **chart timeframe / Bollinger / RSI toggles** (localStorage is fine; server for cross-device later).

---

## 8. Non-functional
- Migrations via Alembic; seed script for a demo Nifty-200 CSV.
- `.env` for DB URL and **Azure AI Foundry** config (endpoint, api-version, and deployment names for chat / embeddings / vision-OCR, plus key); docker-compose (api + db[+pgvector] + frontend[+ worker/redis for ingestion]). No JWT/auth secret in v1.
- Tests: charge calc, 44 MA/breadth math, weekly-trend aggregation, **timeframe bar aggregation (W/M) + Bollinger & RSI math**, sync idempotency.
- Timezone: store UTC, display IST.

---

## 9. Book Library & RAG (PDF ingestion + Kindle reader)

Everything here backs the Admin **Book Library · PDF Ingestion** card and the **Library** screen (shelf + reader) in `PaRo.dc.html`.

### 9.1 Data model (Postgres; vectors via **pgvector**)
- **books** (id, owner_id NULLABLE [null = shared/global], title, author, subtitle, tag, spine_color, kind ['text'|'scanned'], source_filename, storage_key, status ['queued'|'parsing'|'ocr'|'embedding'|'ready'|'failed'], page_count, chunk_count, token_count, ocr_confidence NULLABLE, created_at)
- **book_pages** (id, book_id, page_index, chapter, text) — the reader renders from here; `chapter` drives the TOC (distinct chapter ⇒ TOC entry at its first page).
- **book_chunks** (id, book_id, page_index, chapter, ord, text, char_start, char_end, embedding `vector(N)`) — retrieval unit; index `ivfflat`/`hnsw` on embedding, btree on (book_id, page_index).
- **book_suggestions** (id, book_id, question) — 2–3 starter questions generated at ingest; reader falls back to chapter-title-derived questions if empty.
- **ingestion_jobs** (id, book_id, state, pct, stage_message, error, started_at, finished_at) — powers the live progress UI (Upload → Parse/OCR → Embed → Ready).
- **reading_progress** (user_id, book_id, page_index, updated_at) — resume point; UNIQUE(user_id, book_id).
- **book_bookmarks** (user_id, book_id, page_index) — UNIQUE together.
- **book_highlights** (id, user_id, book_id, page_index, text, note NULLABLE, created_at) — text is an exact substring of the page (so the reader can re-wrap it in `<mark>`).

Delete of a book cascades pages, chunks, suggestions, jobs, progress, bookmarks, highlights, and the stored PDF/page-images.

### 9.2 Ingestion pipeline (async worker — Celery/RQ)
1. **Upload:** accept a PDF (multipart), enforce type + size cap, store in object storage (S3/MinIO), create `books` row (status `queued`) + `ingestion_jobs`. `kind` may be user-supplied; otherwise auto-detect (below).
2. **Detect kind:** sample pages — if extractable text density is high ⇒ `text`; if pages are image-only ⇒ `scanned`.
3. **Parse (text):** extract text per page (PyMuPDF/pdfplumber), strip repeating headers/footers, de-hyphenate line breaks, keep page boundaries.
   **OCR (scanned):** render each page to an image, read with a **vision model** (LLM vision endpoint or Tesseract/textract); capture a per-page confidence; average → `ocr_confidence`. Deskew; drop figures/marginalia from the reading flow but keep them in the source.
4. **Segment:** persist `book_pages` (page_index, chapter, text). Infer `chapter` from headings where present.
5. **Chunk + embed:** split each page into ~600–900-token chunks with ~15% overlap; embed each with the embeddings model; upsert `book_chunks` with `char_start/char_end` (needed for citation highlighting). Record `chunk_count`, `token_count`.
6. **Finalize:** generate `book_suggestions`; set status `ready`; write the **report** (`page_count`, `chunk_count`, `token_count`, `ocr_confidence`) shown on the Admin done-card.
- Update `ingestion_jobs.pct/state` throughout so the UI's stepper + progress bar reflect real progress (poll `GET /library/jobs/{id}` or SSE). Failures → status `failed` with a surfaced error.
- Providers (OCR/vision, embeddings, LLM) behind **swappable interfaces**; keys server-side only.

### 9.3 RAG query logic (must match the prototype's behavior)
- **Ask:** embed the question, vector-search top-k `book_chunks` **scoped to that book_id** (cosine), optional rerank. Build a grounded prompt from the retrieved chunks and **stream** the answer (SSE). Response also returns `cites[]` = the distinct source pages, each with `{page_index, chapter, quote}` where `quote` is the best-matching sentence/char-range — the reader jumps to the page and flash-highlights that quote.
- If no chunk is relevant, answer from the closest chunk and say so (prototype: "I could not find a direct passage, but the closest is this.").
- **Explain page:** summarize the current page's chunks; cite that page.
- **Summarize chapter:** map over the chapter's pages; cite each.
- **Summarize book:** map-reduce over chapter-lead chunks; cite the first page of each chapter.
- **In-book search:** plain text search over `book_pages.text`; return page_index + chapter + snippet (this is lexical, distinct from the semantic Ask).
- Rate-limit Ask per user; keep the whole flow server-side.

### 9.4 REST API
```
POST   /library/books/upload            # multipart pdf, kind? -> {book_id, job_id}
GET    /library/jobs/{id}               # {state, pct, stage, report?, error?}  (or SSE)
GET    /library/books                   # shelf: id,title,author,tag,kind,page/chunk counts,progress%
GET    /library/books/{id}              # meta + report + toc + suggestions
PATCH  /library/books/{id}              # rename (title)
DELETE /library/books/{id}              # cascade (see 9.1)
GET    /library/books/{id}/pages?from=&to=      # reader pages (page_index, chapter, text)
GET    /library/books/{id}/search?q=            # in-book lexical search
GET/PUT        /library/books/{id}/progress     # resume point
GET/POST/DELETE /library/books/{id}/bookmarks
GET/POST/DELETE /library/books/{id}/highlights  # GET = export (all, page-ordered)
POST   /library/books/{id}/ask                  # {question} -> SSE stream + cites[]
POST   /library/books/{id}/explain-page         # {page_index}
POST   /library/books/{id}/summarize-chapter    # {page_index|chapter}
POST   /library/books/{id}/summarize-book
```
Progress, bookmarks, highlights are **per-user**; books/chunks may be shared or per-user (decide with auth model). Highlight `text` must round-trip exactly for `<mark>` re-wrapping.

### 9.5 Frontend must preserve (reader)
Kindle-style reader: paginated pages (Prev/Next + `←/→`, progress bar, "Page X of Y"), **font size A−/A+**, **reading theme** (Light/Sepia/Dark), **font family** (Serif/Sans) and **page width** (Narrow/Normal/Wide); left panel with **in-book search**, **bookmarks**, **contents (TOC)**, and **highlights** (with one-click **Export/Copy**); **select-to-highlight** popover; **Ask-this-book** panel with streaming answers, a caret while streaming, "Retrieving passages…" state, clickable **p.N** citations that jump + flash-highlight, per-book **suggested questions**, and quick actions **Explain page / Summarize chapter / Summarize book**. Persist reading progress, font, theme, font-family, width, bookmarks, and highlights (localStorage in prototype; server for cross-device). Admin ingestion card: drag-&-drop or browse, source-type (Text/Scanned-OCR) choice, live stepper, and the completion **report** (pages/chunks/tokens/OCR confidence); per-book **rename/delete** on the shelf with a delete confirm.

### 9.6 Non-functional (library-specific)
- pgvector extension (or an external vector store) + embedding-dimension config; object storage for PDFs and rendered page images; async worker + queue (Celery+Redis / RQ); upload size/MIME limits and virus/type checks; tests for chunking, citation char-range mapping, and delete cascade.

### 9.7 Sequence — ingestion (Admin upload → ready)
```
Admin UI        API                Queue/Worker         Object store   OCR/Embed         DB (pg+pgvector)
   |  POST /library/books/upload    |                        |             |                 |
   |------------------------------->| create books(queued)   |             |                 |
   |                                | + ingestion_job         |             |                 |
   |                                |----- store PDF -------->|             |                 |
   |                                |----- enqueue(job) ----->|             |                 |
   |  {book_id, job_id}   <---------|                        |             |                 |
   |                                |                        | detect kind |                 |
   |  GET /library/jobs/{id}  (poll or SSE)                  | parse|OCR ---+---> confidence   |
   |------------------------------->| read job state <-------| segment ----+-----------------> book_pages
   |  {state:'ocr', pct:42} <-------|                        | chunk+embed +---> vectors -----> book_chunks
   |          ...                   |                        | suggestions +-----------------> book_suggestions
   |  {state:'ready',               |                        | finalize    |                 | books(ready)+report
   |    report:{pages,chunks,...}}  |                        |             |                 |
```
Text PDFs skip the OCR box (no `ocr_confidence`). The UI stepper maps 1:1 to `state`: `uploading→parsing/ocr→embedding→ready`.

### 9.8 Example — Ask-this-book (RAG, streaming)
**Request**
```
POST /library/books/bk_9f2/ask
Authorization: Bearer <jwt>
Content-Type: application/json

{ "question": "how do reversal patterns work?", "top_k": 4 }
```
**Response** — `Content-Type: text/event-stream`. Server retrieves top-k chunks scoped to the book, streams answer tokens, then emits a terminal `cites` event:
```
event: meta
data: {"retrieved":[{"chunk_id":"c_512","page_index":1,"chapter":"Chapter 2 · Reversal Patterns","score":0.83},
                    {"chunk_id":"c_530","page_index":2,"chapter":"Chapter 2 · Reversal Patterns","score":0.71}]}

event: token
data: {"t":"A few passages "}
event: token
data: {"t":"bear on that. "}
   ... (streamed word/'token' deltas) ...

event: cites
data: {"cites":[
  {"page_index":1,"chapter":"Chapter 2 · Reversal Patterns","quote":"Engulfing patterns work because they show a full transfer of control within one session.","char_start":0,"char_end":84},
  {"page_index":2,"chapter":"Chapter 2 · Reversal Patterns","quote":"The strongest reversals cluster at a level the market already respects.","char_start":0,"char_end":72}
]}

event: done
data: {"finish":"stop"}
```
The reader renders `token` deltas live (with the trailing caret), then draws one **p.N** chip per `cites[]` entry; clicking a chip calls `gotoPage(page_index)` and flash-highlights `quote` (matched via `char_start/char_end`, falling back to substring search). If `retrieved` is empty, the server answers from the nearest chunk and prefixes the "could not find a direct passage" caveat. `explain-page` / `summarize-chapter` / `summarize-book` use the same event shape, differing only in which chunks seed the prompt.

**Non-streaming fallback** (same data, one JSON body):
```
{ "answer": "A few passages bear on that. In Chapter 2 …",
  "cites": [ {"page_index":1,"chapter":"…","quote":"…","char_start":0,"char_end":84}, … ] }
```

---

## 10. Explicitly out of prototype scope (decide before building)
> **v1 decisions (locked):** no auth (single-user); **Azure AI Foundry** for chat, embeddings, and vision-OCR; **no** live broker orders / F&O; real Nifty-200 seed CSV supplied by the owner. Remaining below is genuinely deferred.

Real broker integration/order placement (prototype journal is manual), live intraday ticks (daily bars only), and multi-exchange/F&O charge schedules — **out of v1 (confirmed).**

**Library/RAG:** providers standardized on **Azure AI Foundry** (embeddings + vision-OCR + chat). Books are **shared** (single-user v1). Still deferred: cross-book (“ask my whole library”) search and a formal re-ranking/eval quality bar. The prototype uses simulated ingestion + keyword retrieval — production must swap in the real pipeline in §9.
