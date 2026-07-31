from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import Indicator, PriceBar, StockUniverse, SyncRun, SyncRunItem
from app.providers.prices.base import OhlcvBar, PriceProvider
from app.services.indicators import ma44


FULL_YEARS = 4
INCREMENTAL_LOOKBACK_DAYS = 14


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _window_for_mode(db: Session, symbol: str, mode: str) -> tuple[date, date]:
    end = date.today()
    if mode == "Full":
        start = end - timedelta(days=365 * FULL_YEARS + 30)
        return start, end
    # Incremental: from last bar - lookback, or full if empty
    last = db.scalar(
        select(PriceBar.date)
        .where(PriceBar.symbol == symbol)
        .order_by(PriceBar.date.desc())
        .limit(1)
    )
    if last is None:
        start = end - timedelta(days=365 * FULL_YEARS + 30)
    else:
        start = last - timedelta(days=INCREMENTAL_LOOKBACK_DAYS)
    return start, end


def _upsert_bars(db: Session, symbol: str, bars: list[OhlcvBar]) -> int:
    if not bars:
        return 0
    rows = [
        {
            "symbol": symbol,
            "date": b.date,
            "open": b.open,
            "high": b.high,
            "low": b.low,
            "close": b.close,
            "volume": b.volume,
        }
        for b in bars
    ]
    stmt = pg_insert(PriceBar).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_price_bars_symbol_date",
        set_={
            "open": stmt.excluded.open,
            "high": stmt.excluded.high,
            "low": stmt.excluded.low,
            "close": stmt.excluded.close,
            "volume": stmt.excluded.volume,
        },
    )
    db.execute(stmt)
    return len(rows)


def _recompute_ma44(db: Session, symbol: str) -> None:
    closes_rows = db.execute(
        select(PriceBar.date, PriceBar.close)
        .where(PriceBar.symbol == symbol)
        .order_by(PriceBar.date.asc())
    ).all()
    if len(closes_rows) < 44:
        return
    db.execute(delete(Indicator).where(Indicator.symbol == symbol))
    closes = [float(c) for _, c in closes_rows]
    dates = [d for d, _ in closes_rows]
    batch = []
    for i in range(43, len(closes)):
        val = ma44(closes[: i + 1])
        if val is None:
            continue
        batch.append({"symbol": symbol, "date": dates[i], "ma44": val})
    if batch:
        db.execute(pg_insert(Indicator).values(batch))


def run_sync(
    db: Session,
    provider: PriceProvider,
    *,
    mode: str = "Incremental",
    symbols: list[str] | None = None,
) -> SyncRun:
    if mode not in ("Full", "Incremental"):
        raise ValueError("mode must be Full or Incremental")

    run = SyncRun(mode=mode, status="running", started_at=_utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    stmt = select(StockUniverse).where(StockUniverse.active.is_(True))
    if symbols:
        stmt = stmt.where(StockUniverse.symbol.in_([s.upper() for s in symbols]))
    stocks = list(db.scalars(stmt).all())

    processed = updated = failed = 0
    for stock in stocks:
        processed += 1
        start, end = _window_for_mode(db, stock.symbol, mode)
        try:
            bars = provider.fetch_daily(stock.yahoo_symbol, start, end)
            n = _upsert_bars(db, stock.symbol, bars)
            _recompute_ma44(db, stock.symbol)
            db.add(
                SyncRunItem(
                    run_id=run.id,
                    symbol=stock.symbol,
                    status="ok",
                    rows_written=n,
                    window_start=start,
                    window_end=end,
                    message=None,
                )
            )
            updated += 1
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            # re-attach run after rollback
            run = db.get(SyncRun, run.id) or run
            failed += 1
            db.add(
                SyncRunItem(
                    run_id=run.id,
                    symbol=stock.symbol,
                    status="fail",
                    rows_written=0,
                    window_start=start,
                    window_end=end,
                    message=str(exc)[:500],
                )
            )
            db.commit()

    run = db.get(SyncRun, run.id)
    assert run is not None
    run.processed = processed
    run.updated = updated
    run.failed = failed
    run.finished_at = _utcnow()
    if failed and updated:
        run.status = "partial"
    elif failed and not updated:
        run.status = "failed"
    else:
        run.status = "success"
    db.commit()
    db.refresh(run)
    return run


def retry_failed(db: Session, provider: PriceProvider, run_id: int) -> SyncRun:
    failed_syms = list(
        db.scalars(
            select(SyncRunItem.symbol).where(
                SyncRunItem.run_id == run_id, SyncRunItem.status == "fail"
            )
        ).all()
    )
    return run_sync(db, provider, mode="Incremental", symbols=failed_syms)
