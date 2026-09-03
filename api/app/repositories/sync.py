from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import and_, delete, desc, select
from sqlalchemy.orm import Session

from app.models.sync import PriceBar, SyncRun, SyncRunItem


class SyncRepository:
    def create_run(self, db: Session, *, mode: str, scope: str, status: str) -> SyncRun:
        run = SyncRun(mode=mode, scope=scope, status=status)
        db.add(run)
        db.flush()
        db.refresh(run)
        return run

    def update_run_counters(
        self,
        db: Session,
        *,
        run_id: int,
        processed: int,
        updated: int,
        failed: int,
    ) -> None:
        run = db.get(SyncRun, run_id)
        if not run:
            return
        run.processed = processed
        run.updated = updated
        run.failed = failed
        db.add(run)

    def finish_run(self, db: Session, *, run_id: int, status: str, error: str | None = None) -> None:
        run = db.get(SyncRun, run_id)
        if not run:
            return
        run.status = status
        run.finished_at = datetime.utcnow()
        run.error = error
        db.add(run)

    def add_run_item(
        self,
        db: Session,
        *,
        run_id: int,
        symbol: str,
        status: str,
        rows: int,
        window: str,
        message: str,
    ) -> None:
        item = SyncRunItem(
            run_id=run_id,
            symbol=symbol,
            status=status,
            rows=rows,
            window=window,
            message=message,
        )
        db.add(item)

    def list_runs(self, db: Session, limit: int = 30) -> list[SyncRun]:
        statement = select(SyncRun).order_by(desc(SyncRun.started_at)).limit(limit)
        return list(db.scalars(statement))

    def get_run(self, db: Session, run_id: int) -> SyncRun | None:
        return db.get(SyncRun, run_id)

    def latest_run(self, db: Session) -> SyncRun | None:
        statement = select(SyncRun).order_by(desc(SyncRun.started_at)).limit(1)
        return db.scalar(statement)

    def list_run_items(self, db: Session, run_id: int) -> list[SyncRunItem]:
        statement = select(SyncRunItem).where(SyncRunItem.run_id == run_id).order_by(SyncRunItem.id.asc())
        return list(db.scalars(statement))

    def failed_symbols_for_run(self, db: Session, run_id: int) -> list[str]:
        statement = select(SyncRunItem.symbol).where(
            and_(SyncRunItem.run_id == run_id, SyncRunItem.status == "fail")
        )
        return list(db.scalars(statement))

    def get_latest_bar_date(self, db: Session, symbol: str) -> date | None:
        statement = select(PriceBar).where(PriceBar.symbol == symbol).order_by(desc(PriceBar.date)).limit(1)
        row = db.scalar(statement)
        return row.date if row else None

    def upsert_price_bars(self, db: Session, symbol: str, bars: Sequence[dict[str, float | date]]) -> int:
        rows_written = 0
        for item in bars:
            statement = select(PriceBar).where(
                and_(PriceBar.symbol == symbol, PriceBar.date == item["date"])
            )
            current = db.scalar(statement)
            if current is None:
                current = PriceBar(
                    symbol=symbol,
                    date=item["date"],
                    o=float(item["o"]),
                    h=float(item["h"]),
                    l=float(item["l"]),
                    c=float(item["c"]),
                    v=float(item["v"]),
                )
                db.add(current)
                rows_written += 1
                continue

            changed = False
            for key in ("o", "h", "l", "c", "v"):
                value = float(item[key])
                if getattr(current, key) != value:
                    setattr(current, key, value)
                    changed = True

            if changed:
                rows_written += 1

        return rows_written
