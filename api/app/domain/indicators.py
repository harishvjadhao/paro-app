from __future__ import annotations

from collections import OrderedDict
from collections.abc import Sequence
from math import sqrt
from statistics import fmean
from typing import Literal

Timeframe = Literal["D", "W", "M"]


def sma(values: Sequence[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError("period must be > 0")

    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out

    window_sum = sum(values[:period])
    out[period - 1] = window_sum / period
    for idx in range(period, len(values)):
        window_sum += values[idx]
        window_sum -= values[idx - period]
        out[idx] = window_sum / period
    return out


def above_ma(close: float, moving_average: float | None) -> bool:
    if moving_average is None:
        return False
    return close >= moving_average


def pct_vs_ma(close: float, moving_average: float | None) -> float:
    if moving_average in (None, 0.0):
        return 0.0
    return ((close - moving_average) / moving_average) * 100.0


def aggregate(
    daily: Sequence[dict[str, float | str]],
    timeframe: Timeframe,
) -> list[dict[str, float | str]]:
    if timeframe == "D":
        return list(daily)

    buckets: OrderedDict[str, list[dict[str, float | str]]] = OrderedDict()
    for row in daily:
        day = str(row["date"])
        key = day[:7] if timeframe == "M" else _week_key(day)
        buckets.setdefault(key, []).append(row)

    out: list[dict[str, float | str]] = []
    for rows in buckets.values():
        first = rows[0]
        last = rows[-1]
        high = max(float(x["h"]) for x in rows)
        low = min(float(x["l"]) for x in rows)
        volume = sum(float(x["v"]) for x in rows)
        out.append(
            {
                "date": str(last["date"]),
                "o": float(first["o"]),
                "h": high,
                "l": low,
                "c": float(last["c"]),
                "v": volume,
            }
        )
    return out


def bollinger(close_values: Sequence[float], period: int = 20, std_dev: float = 2.0) -> list[tuple[float | None, float | None, float | None]]:
    if period <= 1:
        raise ValueError("period must be > 1")

    out: list[tuple[float | None, float | None, float | None]] = []
    for idx in range(len(close_values)):
        if idx < period - 1:
            out.append((None, None, None))
            continue

        window = list(close_values[idx - period + 1 : idx + 1])
        mean = fmean(window)
        variance = sum((value - mean) ** 2 for value in window) / period
        sigma = sqrt(variance)
        upper = mean + (std_dev * sigma)
        lower = mean - (std_dev * sigma)
        out.append((upper, mean, lower))
    return out


def rsi_wilder(close_values: Sequence[float], period: int = 14) -> list[float | None]:
    if period <= 0:
        raise ValueError("period must be > 0")

    out: list[float | None] = [None] * len(close_values)
    if len(close_values) <= period:
        return out

    gains: list[float] = []
    losses: list[float] = []
    for idx in range(1, period + 1):
        delta = close_values[idx] - close_values[idx - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    out[period] = _rsi_from_averages(avg_gain, avg_loss)

    for idx in range(period + 1, len(close_values)):
        delta = close_values[idx] - close_values[idx - 1]
        gain = max(delta, 0.0)
        loss = max(-delta, 0.0)

        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        out[idx] = _rsi_from_averages(avg_gain, avg_loss)

    return out


def _week_key(day_yyyy_mm_dd: str) -> str:
    import datetime as dt

    parsed = dt.datetime.strptime(day_yyyy_mm_dd, "%Y-%m-%d").date()
    iso = parsed.isocalendar()
    return f"{iso.year:04d}-W{iso.week:02d}"


def _rsi_from_averages(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))
