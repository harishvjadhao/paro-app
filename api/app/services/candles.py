"""Candle aggregation + Bollinger + Wilder RSI (pure functions)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Bar:
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float


def aggregate_weekly(daily: list[Bar]) -> list[Bar]:
    """ISO-week buckets (Mon–Sun); date = last daily bar in bucket."""
    return _bucket_by_key(daily, key=lambda b: (b.date.isocalendar().year, b.date.isocalendar().week))


def aggregate_monthly(daily: list[Bar]) -> list[Bar]:
    """Calendar-month buckets; date = last daily bar in bucket."""
    return _bucket_by_key(daily, key=lambda b: (b.date.year, b.date.month))


def _bucket_by_key(daily: list[Bar], *, key) -> list[Bar]:
    if not daily:
        return []
    ordered = sorted(daily, key=lambda b: b.date)
    buckets: list[Bar] = []
    cur_key = key(ordered[0])
    open_ = ordered[0].open
    high = ordered[0].high
    low = ordered[0].low
    close = ordered[0].close
    vol = ordered[0].volume
    last_date = ordered[0].date
    for b in ordered[1:]:
        k = key(b)
        if k != cur_key:
            buckets.append(Bar(last_date, open_, high, low, close, vol))
            cur_key = k
            open_ = b.open
            high = b.high
            low = b.low
            close = b.close
            vol = b.volume
            last_date = b.date
        else:
            high = max(high, b.high)
            low = min(low, b.low)
            close = b.close
            vol += b.volume
            last_date = b.date
    buckets.append(Bar(last_date, open_, high, low, close, vol))
    return buckets


def sma_series(closes: list[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(closes)
    if period <= 0:
        return out
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        out[i] = sum(window) / period
    return out


def ma44_series(closes: list[float]) -> list[float | None]:
    return sma_series(closes, 44)


def population_stdev(values: list[float]) -> float:
    n = len(values)
    if n == 0:
        return 0.0
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    return math.sqrt(var)


def bollinger_bands(
    closes: list[float], period: int = 20, k: float = 2.0
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    mid = sma_series(closes, period)
    up: list[float | None] = [None] * len(closes)
    lo: list[float | None] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        m = mid[i]
        if m is None:
            continue
        sigma = population_stdev(window)
        up[i] = m + k * sigma
        lo[i] = m - k * sigma
    return mid, up, lo


def wilder_rsi(closes: list[float], period: int = 14) -> list[float | None]:
    """Wilder RSI: seed with SMA of first `period` gains/losses, then smooth."""
    n = len(closes)
    out: list[float | None] = [None] * n
    if n <= period:
        return out

    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, n):
        change = closes[i] - closes[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))

    # gains/losses indexed aligned to closes[1..]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def rsi_from(ag: float, al: float) -> float:
        if al == 0:
            return 100.0
        rs = ag / al
        return 100.0 - (100.0 / (1.0 + rs))

    # First RSI value at index `period` (after `period` changes from closes[0])
    out[period] = rsi_from(avg_gain, avg_loss)

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        out[i + 1] = rsi_from(avg_gain, avg_loss)
    return out


def select_timeframe(daily: list[Bar], timeframe: str) -> list[Bar]:
    tf = timeframe.upper()
    if tf == "D":
        return sorted(daily, key=lambda b: b.date)
    if tf == "W":
        return aggregate_weekly(daily)
    if tf == "M":
        return aggregate_monthly(daily)
    raise ValueError(f"unsupported timeframe: {timeframe}")
