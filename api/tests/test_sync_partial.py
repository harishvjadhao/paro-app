"""Offline sync partial-failure behavior without Postgres.

Exercises provider + status aggregation using a tiny in-memory stand-in.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from app.providers.prices.mock import MockPriceProvider


@dataclass
class FakeStock:
    symbol: str
    yahoo_symbol: str
    active: bool = True


@dataclass
class FakeItem:
    symbol: str
    status: str
    message: str | None = None
    rows_written: int = 0


@dataclass
class FakeRun:
    mode: str
    status: str = "running"
    processed: int = 0
    updated: int = 0
    failed: int = 0
    items: list[FakeItem] = field(default_factory=list)
    finished_at: datetime | None = None


def simulate_sync(stocks: list[FakeStock], mode: str = "Full") -> FakeRun:
    provider = MockPriceProvider()
    run = FakeRun(mode=mode)
    end = date.today()
    start = date(end.year - 1, end.month, end.day)
    for s in stocks:
        run.processed += 1
        try:
            bars = provider.fetch_daily(s.yahoo_symbol, start, end)
            run.items.append(FakeItem(symbol=s.symbol, status="ok", rows_written=len(bars)))
            run.updated += 1
        except Exception as exc:  # noqa: BLE001
            run.items.append(FakeItem(symbol=s.symbol, status="fail", message=str(exc)))
            run.failed += 1
    if run.failed and run.updated:
        run.status = "partial"
    elif run.failed:
        run.status = "failed"
    else:
        run.status = "success"
    run.finished_at = datetime.now(timezone.utc)
    return run


def test_partial_run_with_forced_failure():
    stocks = [
        FakeStock("RELIANCE", "RELIANCE.NS"),
        FakeStock("BAD", "FAIL.NS"),
        FakeStock("TCS", "TCS.NS"),
    ]
    run = simulate_sync(stocks)
    assert run.status == "partial"
    assert run.updated == 2
    assert run.failed == 1
    fail = next(i for i in run.items if i.symbol == "BAD")
    assert fail.status == "fail"
    assert fail.message
