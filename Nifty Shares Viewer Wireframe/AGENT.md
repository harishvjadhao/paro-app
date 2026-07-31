# AGENT.md — how to run this build

You are the sole engineer building **PaRo**. Work autonomously, phase by phase, and keep a durable status log so any session can resume after a crash, timeout, or context reset.

## Files (read these; don't ask me to re-paste)
- `PaRo.dc.html` — the approved prototype. Source of truth for UI, layout, copy, interactions.
- `PaRo_BUILD_SPEC.md` — architecture, data model, business math, API, RAG contract.
- `PHASES.md` — the ordered task checklist (Phases 0–7). **This is your work queue.**
- `BUILD_LOG.md` — your running status journal (create it on first run; update it constantly).
- `uploads/ind_nifty200list.csv` — the seed universe.

## Loop (repeat until all phases done)
1. **Resume:** open `BUILD_LOG.md`. Find the first phase not `DONE`. If a phase is `IN_PROGRESS`, re-read its "Next step" line and continue there.
2. **Load context:** read only that phase's tasks in `PHASES.md` and the spec sections it references. Don't load the whole spec.
3. **Plan:** in `BUILD_LOG.md`, set the phase to `IN_PROGRESS` and list the concrete sub-steps you're about to do.
4. **Build** the smallest shippable slice; run it.
5. **Verify** against the phase's "Done when" bar (write/run its tests; boot the app).
6. **Record:** tick the boxes in `PHASES.md`; append a dated entry to `BUILD_LOG.md` (what changed, files touched, test result, commit hash). Commit with `git commit -m "phaseN: <slice>"`.
7. When every box in a phase is ticked and "Done when" passes, mark it `DONE` in `BUILD_LOG.md` and move to the next phase.

## Status/resume rules
- **One source of truth for progress = `BUILD_LOG.md`.** Update it *before and after* each slice, never only at the end.
- Each phase has exactly one status: `TODO` → `IN_PROGRESS` → `DONE` (or `BLOCKED`).
- Always keep a single **`Next step:`** line for the active phase — the exact command/file to resume from. If you crash, that line is how you recover.
- **Commit after every green slice.** A resuming session trusts git + `BUILD_LOG.md`, not memory.
- If something is ambiguous, make the smallest reasonable assumption, record it under `Assumptions` in `BUILD_LOG.md`, and keep going — do **not** stop to ask unless it's a locked-decision conflict (see below).
- On failure: set the phase `BLOCKED`, write the error + last known-good commit under `Blockers`, attempt one fix; if still blocked, leave it `BLOCKED` with a clear repro and continue with any independent later task.

## Locked v1 decisions (do not revisit)
No auth (single-user; keep constant `user_id` columns) · Azure AI Foundry for chat + embeddings + vision-OCR · no broker orders / F&O · daily bars only · seed from the CSV above. See spec §10.

## Engineering standards (apply to every slice)
- **Modularity:** clear layered boundaries — API routes → services (business logic) → repositories (DB) → providers (yfinance, Azure chat/embeddings/vision, storage). No business logic in route handlers or React components. One feature = one cohesive module.
- **Reusability:** put shared math/helpers once and import them — the 44 MA/breadth, timeframe aggregation, Bollinger, RSI, and the Zerodha charge calc live in single, unit-tested functions reused by every caller (API + tests). Frontend: small composable components + hooks (e.g. a `useCandles` hook, a reusable `<Chart>`), a typed API client generated/shared, no copy-paste.
- **Maintainability:** every external service behind a **swappable interface** (so yfinance or an Azure model can be replaced without touching callers); config via env, never hard-coded; typed end-to-end (Pydantic models ↔ TS types); meaningful names; short functions; comments only where non-obvious. Keep the file/folder structure predictable and documented in the README.
- **Testable:** pure functions for all business math; a test per "Done when" bar. Prefer dependency injection so providers can be mocked.
- Don't over-engineer: apply these to earn real reuse/clarity, not speculative abstraction.

## Definition of done (whole build)
All phases `DONE`, `docker compose up` serves web+api, every screen matches `PaRo.dc.html`, and the phase test suites pass.

---
### Kickoff prompt (paste this to start)
> Read `AGENT.md`, then `BUILD_LOG.md` (create it from the template in AGENT.md if missing). Begin at the first non-DONE phase in `PHASES.md`, following the Loop. Update `BUILD_LOG.md` and commit after each slice. Start now with Phase 0.

### `BUILD_LOG.md` template (create on first run)
```
# PaRo Build Log

## Status
- Phase 0 — Scaffold & infra: TODO
- Phase 1 — Universe/prices/sync: TODO
- Phase 2 — Stock APIs + candles/indicators: TODO
- Phase 3 — Workspace + chart: TODO
- Phase 4 — Sectors/trends/journal/admin/settings: TODO
- Phase 5 — Sector AI: TODO
- Phase 6 — Book Library + RAG: TODO
- Phase 7 — Hardening: TODO

## Active phase
Phase: 0
Next step: scaffold /api and /web, add docker-compose

## Assumptions
-

## Blockers
-

## Journal
- (YYYY-MM-DD HH:MM) init — created log, starting Phase 0
```
