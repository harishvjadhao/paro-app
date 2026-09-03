# PaRo Implementation Gap Checklist

This checklist compares the live repo against the screen requirements in [Nifty Shares Viewer Wireframe/SCREENS.md](Nifty%20Shares%20Viewer%20Wireframe/SCREENS.md).

Status meanings:

- `Done`: implemented and present in the live repo.
- `Partial`: implemented in part, but missing required behavior or parity.
- `Pending`: not implemented yet, or still only a stub.

## Summary

- S0 Foundation: Done
- S1 Admin - Universe upload: Done
- S2 Admin - Sync control/status/history: Partial
- S3 Market Workspace: Partial (near parity; owner verification remaining)
- S4 Stock List: Partial
- S5 Sector Analysis: Partial
- S6 Weekly Sector Trends: Partial
- S7 Trading Journal: Partial
- S8 Settings + Admin highlights: Partial
- S9 Sector AI chat: Partial
- S10 Library + Reader + RAG: Pending

## S0 - Foundation

Status: `Done`

Implemented:

- App shell, nav rail, and route skeleton are present.
- Theme switching exists in Settings.
- Backend app, DB setup, health route, and error envelope plumbing exist.
- Project structure matches the intended backend/frontend split.

## S1 - Admin / Universe upload

Status: `Done`

Implemented:

- CSV upload flow with append and replace paths.
- Replace confirmation behavior.
- Empty, progress, success, and validation-error states.
- Universe clear action.
- Backend upload/list/clear flows and seed path.

Outstanding:

- No major gap found relative to the S1 checklist.

## S2 - Admin / Sync control, status, run history

Status: `Partial`

Implemented:

- Full and incremental sync entry points in Admin.
- Sync status polling while a run is active.
- Run history and run detail view.
- Retry-failed flow.
- Backend lock to reject concurrent runs.
- Single-symbol sync API and workspace quick sync trigger.
- APScheduler startup wiring exists.

Gaps:

- The acceptance requirement "full sync populates price_bars for all 200 symbols; progress advances live in the UI" is not re-verified in the current repo state.
- Admin copy mentions book library and chart highlights that are not implemented yet (those belong to later screens).

## S3 - Market Workspace

Status: `Partial` (functionally near complete; awaiting owner side-by-side verification)

Implemented:

- Stocks list API, stock detail API, candles API with daily markers, favorite/watch toggles, comments CRUD, and reorder endpoint.
- Domain indicator math for SMA, W/M aggregation, Bollinger, and RSI.
- Workspace screen with grouped industries, search, filter chips, favorites dropdown on search focus, quick sync, per-row actions, reorder, stock detail panel, timeframe switch, Bollinger/RSI toggles, and comments edit/delete.
- Reusable canvas `PriceChart` with ResizeObserver, devicePixelRatio scaling, candles, 44 MA, volume, crosshair, Bollinger, RSI, and daily comment markers.
- Keyboard: `/`, `ArrowUp`/`ArrowDown`, `Escape`, and `Cmd/Ctrl+K` command palette.
- Local storage restoration for selected symbol, density, timeframe, Bollinger, RSI, search, filter, collapse-all, and per-industry collapsed state.
- Loading skeletons, empty-universe state, no-match state, and detail error state.

Gaps remaining before marking Done:

- Chart highlight bands still depend on Admin highlights (S8); marker plumbing is ready but highlight CRUD is not.
- Owner has not completed side-by-side prototype verification at 1440×900 and 900px.
- Full 200-symbol sync + workspace smoke against live Yahoo data is not re-signed in this session.

## S4 - Stock List

Status: `Partial`

Implemented:

- `stock_meta` and `stock_list_columns` tables + migration `0005_s4_stock_list_tables`.
- List API with computed 20 MA (D/W/M), auto screen derivation, and persisted overrides/notes/subcategory/custom values.
- Column create/update/hide/delete/reorder APIs.
- `/list` editable grouped grid: search, sort, filter, group, hide, custom columns, blur autosave toast, MA/screen overrides with clear-to-auto.

Gaps remaining before marking Done:

- Owner acceptance verification (200-row live edit, clear override restores computed pill, persist checks).
- Builtin column hide is client-local only (custom column hide is server-backed).
- Prototype bulk row actions / CSV export polish are not fully mirrored.

## S5 - Sector Analysis

Status: `Partial`

Implemented:

- Domain helpers for breadth %, weekly breadth series, and rotation coordinates.
- APIs: `GET /sectors`, `GET /sectors/{sector}`, `GET /sectors/compare`.
- Sector Analysis screen: sector tabs, summary metrics, sortable constituents with sparklines, leaders/laggards, weekly breadth bars, rotation quadrant (click selects), compare chart + legend, Ask AI stub (S9).
- Breadth reconciled against `/stocks` MA states in API tests.

Gaps remaining before marking Done:

- Owner acceptance verification in the browser.
- Ask AI panel is implemented in S9 (streaming SSE); earlier stub removed.

## S6 - Weekly Sector Trends

Status: `Partial`

Implemented:

- APIs: `GET /trends/weekly` (8×sector breadth matrix) and `GET /trends/weekly/{sector}/{weekIndex}` drill.
- Domain helpers for week windows and per-stock week above-share; aggregation unit tests.
- Trends screen: colour-scaled matrix, week labels from bar dates, click-to-drill panel with above/below + flipped markers.

Gaps remaining before marking Done:

- Owner browser verification of matrix values and drill contents.

## S7 - Trading Journal

Status: `Partial`

Implemented:

- `trades` table + migration `0006_s7_journal_tables`.
- Domain `zerodha_charges(...)` with unit tests for Delivery/Intraday components (incl. DP ₹15.34) and open-trade zero charges.
- APIs: trades CRUD, charges preview, analytics (equity curve / by segment / by symbol), positions (unrealized from latest close), CSV import/export.
- Journal screen: KPI strip, analytics + equity curve, add-trade form with live charge preview, filterable trade table, CSV I/O, trade chart modal reusing `PriceChart` (entry/exit markers, price levels, candle/line).

Gaps remaining before marking Done:

- Owner verification vs a real Zerodha contract note (paisa match).
- Confirm unrealized updates after sync and export→import round-trip in the browser.

## S8 - Settings + Admin highlights

Status: `Partial`

Implemented:

- Settings: theme picker, default trade segment (`paro.defaultSegment`), clear-local-data with confirm (localStorage prefs only; never deletes server data).
- Theme applied before first paint via inline script in `web/index.html` (`data-theme` from `paro.theme`).
- Journal add-trade form seeds segment from the Settings default.
- `chart_highlights` table + migration `0007`; label→color reuse domain helper; CRUD `/highlights`.
- Daily candle markers include highlight bands for matching dates (global or symbol-scoped).
- Admin › Chart Highlights card (date + label, color preview, reuse note, delete).

Gaps remaining before marking Done:

- Owner verification: cold-load theme (no flash), clear-local does not touch server, Admin highlight appears on workspace daily chart.

## S9 - Sector AI chat

Status: `Partial`

Implemented:

- `providers/ai.py`: `ChatProvider` + `AzureFoundryChat` + `StubChatProvider` (auto when Azure env unset / `AI_FORCE_STUB=true`).
- `POST /ai/sector-chat` SSE stream grounded on live sector breadth/constituents/weekly trend; in-process rate limit; client disconnect sets cancel.
- Sector Ask AI panel: streaming caret, stop (AbortController), retry, simple markdown, stock-mention chips → workspace, select-to-pin, pins list with reorder/export.

Gaps remaining before marking Done:

- Owner verification with Azure Foundry credentials (token streaming + stop cancels server-side).
- Spot-check that factual claims match the grounded prompt on 3 questions.

## S10 - Library + Reader + RAG

Status: `Partial` (S10a + S10b + S10c)

Implemented (S10a):

- Migration `0008_s10a_library_tables`: `books`, `book_pages`, `ingestion_jobs`, `book_suggestions`.
- PDF upload (MIME/size checks) → `data/books/{id}/source.pdf` → background ingest (detect kind → PyMuPDF parse / OCR → pages + chapter infer → report).
- APIs: upload, job poll, shelf list, book detail, rename, delete (cascade), pages.
- Admin › Book Library · PDF Ingestion card (dropzone, kind, live stepper, report).
- Library `/library` shelf with rename/delete confirm.

Implemented (S10b):

- Migration `0009_s10b_reader_tables`: `reading_progress`, `book_bookmarks`, `book_highlights` (cascade on book delete).
- APIs: progress GET/PUT, bookmarks list/add/delete/toggle, highlights list/add/delete (GET = export payload), in-book search.
- `BookReader`: pagination + ←/→, font A−/A+, themes (light/sepia/dark), font family, page width, TOC/bookmarks/search/highlights panel, select-to-highlight popover, export highlights.
- Reader chrome prefs in `paro.readerPrefs` (local); progress/bookmarks/highlights server-side per book.

Implemented (S10c):

- Migration `0010_s10c_chunk_tables`: `book_chunks` with embedding BLOB + page-local `char_start`/`char_end`.
- Chunk ~750 tokens / ~15% overlap on ingest; stub or Azure embeddings; `VectorStore` interface with numpy cosine search.
- SSE: `/ask`, `/explain-page`, `/summarize-chapter`, `/summarize-book` with `meta`/`token`/`cites`/`done`.
- Reader Ask panel: retrieving state, streaming caret, suggestions, quick actions, clickable `p.N` jump + flash-highlight.
- Book delete cascades chunks.

Gaps remaining before marking S10 Done:

- Owner verification: cite char-ranges map to page text; click jumps and flashes; delete cascades.

## Recommended next order

1. Owner-verify S10c (and earlier S10a/b checks if not already), then mark S10 Done.
2. Phase 7 hardening / final gate smoke across all nav destinations.
3. Update this file and `BUILD_LOG.md` together whenever a screen moves from `Pending` to `Partial` or `Done`.
