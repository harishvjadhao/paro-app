from __future__ import annotations

from datetime import date, datetime
import threading
from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.providers.prices import PriceProvider, YFinanceProvider
from app.repositories.sync import SyncRepository
from app.repositories.universe import UniverseRepository

SyncMode = Literal["full", "incremental"]
SyncScope = Literal["universe", "watchlist", "single"]


class SyncService:
    _lock = threading.Lock()
    _running = False

    def __init__(
        self,
        sync_repo: SyncRepository | None = None,
        universe_repo: UniverseRepository | None = None,
        provider: PriceProvider | None = None,
    ) -> None:
        self.sync_repo = sync_repo or SyncRepository()
        self.universe_repo = universe_repo or UniverseRepository()
        self.provider = provider or YFinanceProvider()
        self._run_totals: dict[int, int] = {}

    def start_run(self, db: Session, *, mode: SyncMode, scope: SyncScope) -> int:
        if mode not in {"full", "incremental"}:
            raise HTTPException(status_code=400, detail="Invalid sync mode")
        if scope not in {"universe", "watchlist", "single"}:
            raise HTTPException(status_code=400, detail="Invalid sync scope")

        with self._lock:
            if self._running:
                raise HTTPException(status_code=409, detail="A sync run is already in progress")
            self._running = True

        run = self.sync_repo.create_run(db, mode=mode, scope=scope, status="running")
        db.commit()
        return run.id

    def release_lock(self) -> None:
        with self._lock:
            self._running = False

    def get_symbols_for_scope(self, db: Session, scope: SyncScope, explicit_symbols: list[str] | None = None) -> list[str]:
        if explicit_symbols:
            return explicit_symbols
        if scope == "watchlist":
            # Watchlist persistence is introduced in a later screen, so quick sync no-ops for now.
            return []
        return [row.symbol for row in self.universe_repo.list_universe(db)]

    def execute_run(
        self,
        run_id: int,
        mode: SyncMode,
        scope: SyncScope,
        explicit_symbols: list[str] | None = None,
    ) -> None:
        try:
            with SessionLocal() as db:
                symbols = self.get_symbols_for_scope(db, scope, explicit_symbols)
                self._run_totals[run_id] = len(symbols)

                processed = 0
                updated = 0
                failed = 0
                forced_fails = {token.strip().upper() for token in settings.sync_force_fail_symbols.split(",") if token.strip()}

                for symbol in symbols:
                    processed += 1
                    try:
                        if symbol.upper() in forced_fails:
                            raise RuntimeError("Forced failure for acceptance testing")

                        last_date: date | None = None
                        if mode == "incremental":
                            last_date = self.sync_repo.get_latest_bar_date(db, symbol)

                        bars = self.provider.fetch_daily_bars(symbol, mode, last_date)
                        rows = self.sync_repo.upsert_price_bars(db, symbol, bars)
                        updated += rows
                        window = self._format_window(bars)
                        self.sync_repo.add_run_item(
                            db,
                            run_id=run_id,
                            symbol=symbol,
                            status="ok",
                            rows=rows,
                            window=window,
                            message="",
                        )
                    except Exception as exc:
                        failed += 1
                        self.sync_repo.add_run_item(
                            db,
                            run_id=run_id,
                            symbol=symbol,
                            status="fail",
                            rows=0,
                            window="-",
                            message=str(exc),
                        )

                    self.sync_repo.update_run_counters(
                        db,
                        run_id=run_id,
                        processed=processed,
                        updated=updated,
                        failed=failed,
                    )
                    db.commit()

                if failed == 0:
                    status = "success"
                elif updated == 0:
                    status = "failed"
                else:
                    status = "partial"

                self.sync_repo.finish_run(db, run_id=run_id, status=status)
                db.commit()
        finally:
            self.release_lock()

    def _format_window(self, bars: list[dict[str, float | date]]) -> str:
        if not bars:
            return "-"
        start = bars[0]["date"]
        end = bars[-1]["date"]
        return f"{start} -> {end}"

    def _recover_stale_run_if_needed(self, db: Session, run) -> None:
        # If process restarted or run was interrupted, DB can keep a stale
        # `running` state while there is no active in-memory execution.
        with self._lock:
            running_now = self._running

        if run.status != "running" or running_now:
            return

        self.sync_repo.finish_run(
            db,
            run_id=run.id,
            status="partial",
            error="Sync run was interrupted and auto-recovered.",
        )
        db.commit()

    def status(self, db: Session):
        run = self.sync_repo.latest_run(db)
        if run is None:
            return {
                "id": 0,
                "mode": "-",
                "scope": "-",
                "status": "idle",
                "started_at": datetime.utcnow(),
                "finished_at": None,
                "processed": 0,
                "updated": 0,
                "failed": 0,
                "total": 0,
                "error": None,
            }

        self._recover_stale_run_if_needed(db, run)
        run = self.sync_repo.get_run(db, run.id)

        return {
            "id": run.id,
            "mode": run.mode,
            "scope": run.scope,
            "status": run.status,
            "started_at": run.started_at,
            "finished_at": run.finished_at,
            "processed": run.processed,
            "updated": run.updated,
            "failed": run.failed,
            "total": self._run_totals.get(run.id, max(run.processed, len(self.sync_repo.list_run_items(db, run.id)))),
            "error": run.error,
        }

    def list_runs(self, db: Session):
        runs = self.sync_repo.list_runs(db)
        if runs:
            self._recover_stale_run_if_needed(db, runs[0])
            runs = self.sync_repo.list_runs(db)
        payload = []
        for run in runs:
            payload.append(
                {
                    "id": run.id,
                    "mode": run.mode,
                    "scope": run.scope,
                    "status": run.status,
                    "started_at": run.started_at,
                    "finished_at": run.finished_at,
                    "processed": run.processed,
                    "updated": run.updated,
                    "failed": run.failed,
                    "total": self._run_totals.get(run.id, max(run.processed, len(self.sync_repo.list_run_items(db, run.id)))),
                    "error": run.error,
                }
            )
        return payload

    def run_detail(self, db: Session, run_id: int):
        run = self.sync_repo.get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Sync run not found")

        self._recover_stale_run_if_needed(db, run)
        run = self.sync_repo.get_run(db, run_id)

        items = self.sync_repo.list_run_items(db, run_id)
        return {
            "run": {
                "id": run.id,
                "mode": run.mode,
                "scope": run.scope,
                "status": run.status,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "processed": run.processed,
                "updated": run.updated,
                "failed": run.failed,
                "total": self._run_totals.get(run.id, max(run.processed, len(items))),
                "error": run.error,
            },
            "items": [
                {
                    "id": item.id,
                    "run_id": item.run_id,
                    "symbol": item.symbol,
                    "status": item.status,
                    "rows": item.rows,
                    "window": item.window,
                    "message": item.message,
                }
                for item in items
            ],
        }

    def retry_failed(self, db: Session, run_id: int) -> tuple[int, list[str], str, str]:
        run = self.sync_repo.get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Sync run not found")

        failed_symbols = self.sync_repo.failed_symbols_for_run(db, run_id)
        if not failed_symbols:
            raise HTTPException(status_code=400, detail="No failed symbols found for this run")

        new_id = self.start_run(db, mode=run.mode, scope=run.scope)
        return new_id, failed_symbols, run.mode, run.scope

    def start_scheduled_incremental(self) -> None:
        with SessionLocal() as db:
            try:
                run_id = self.start_run(db, mode="incremental", scope="universe")
            except HTTPException:
                return

        thread = threading.Thread(
            target=self.execute_run,
            args=(run_id, "incremental", "universe", None),
            daemon=True,
        )
        thread.start()
