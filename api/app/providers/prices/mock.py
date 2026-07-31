"""Deterministic mock OHLCV for offline/dev (no Yahoo)."""

from __future__ import annotations

import hashlib
from datetime import date, timedelta

from app.providers.prices.base import OhlcvBar


def _seed(symbol: str) -> float:
    h = hashlib.md5(symbol.encode()).hexdigest()
    return 50.0 + (int(h[:6], 16) % 4500) / 10.0


class MockPriceProvider:
    """Generates synthetic weekday bars; `FAIL_SYMBOL` in yahoo_symbol forces failure."""

    FAIL_MARKER = "FAIL"

    def fetch_daily(self, yahoo_symbol: str, start: date, end: date) -> list[OhlcvBar]:
        if self.FAIL_MARKER in yahoo_symbol.upper():
            raise RuntimeError(f"mock forced failure for {yahoo_symbol}")

        price = _seed(yahoo_symbol)
        bars: list[OhlcvBar] = []
        d = start
        while d <= end:
            if d.weekday() < 5:  # Mon–Fri
                drift = ((d.toordinal() % 17) - 8) * 0.15
                o = round(price, 2)
                c = round(price + drift, 2)
                h = round(max(o, c) + 1.2, 2)
                l = round(min(o, c) - 1.1, 2)
                vol = float(100_000 + (d.toordinal() % 50) * 1000)
                bars.append(OhlcvBar(date=d, open=o, high=h, low=l, close=c, volume=vol))
                price = max(5.0, c)
            d += timedelta(days=1)
        return bars
