"""yfinance daily OHLCV provider."""

from __future__ import annotations

import time
from datetime import date, timedelta

import yfinance as yf

from app.providers.prices.base import OhlcvBar


class YFinancePriceProvider:
    def __init__(self, max_retries: int = 3, backoff_sec: float = 1.5) -> None:
        self.max_retries = max_retries
        self.backoff_sec = backoff_sec

    def fetch_daily(self, yahoo_symbol: str, start: date, end: date) -> list[OhlcvBar]:
        # yfinance end is exclusive
        end_excl = end + timedelta(days=1)
        last_err: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                ticker = yf.Ticker(yahoo_symbol)
                df = ticker.history(
                    start=start.isoformat(),
                    end=end_excl.isoformat(),
                    auto_adjust=False,
                    actions=False,
                )
                if df is None or df.empty:
                    return []
                bars: list[OhlcvBar] = []
                for idx, row in df.iterrows():
                    d = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
                    bars.append(
                        OhlcvBar(
                            date=d,
                            open=float(row["Open"]),
                            high=float(row["High"]),
                            low=float(row["Low"]),
                            close=float(row["Close"]),
                            volume=float(row.get("Volume") or 0),
                        )
                    )
                return bars
            except Exception as exc:  # noqa: BLE001 — provider boundary
                last_err = exc
                time.sleep(self.backoff_sec * (attempt + 1))
        raise RuntimeError(f"yfinance failed for {yahoo_symbol}: {last_err}")
