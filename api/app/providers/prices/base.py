from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(frozen=True)
class OhlcvBar:
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float


class PriceProvider(Protocol):
    """Swappable market-data provider (yfinance, mock, …)."""

    def fetch_daily(
        self,
        yahoo_symbol: str,
        start: date,
        end: date,
    ) -> list[OhlcvBar]:
        """Return daily bars in [start, end] inclusive. May raise on hard failure."""
        ...
