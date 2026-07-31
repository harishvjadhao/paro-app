"""Shared indicator math — Phase 2 expands; Phase 1 caches ma44 on sync."""

from __future__ import annotations


def ma44(closes: list[float]) -> float | None:
    if len(closes) < 44:
        return None
    window = closes[-44:]
    return sum(window) / 44.0


def above_ma(close: float, ma: float) -> bool:
    return close >= ma


def pct_vs_ma(close: float, ma: float) -> float:
    if ma == 0:
        return 0.0
    return (close - ma) / ma * 100.0
