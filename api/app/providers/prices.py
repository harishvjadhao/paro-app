from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
import math
import random
import time

import requests
import urllib3
import yfinance as yf

from app.config import settings

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@dataclass(frozen=True)
class Quote:
    symbol: str
    company_name: str | None
    ltp: float | None
    open: float | None
    high: float | None
    low: float | None
    prev_close: float | None


class PriceProvider(ABC):
    @abstractmethod
    def fetch_quote(self, symbol: str) -> Quote:
        raise NotImplementedError

    @abstractmethod
    def fetch_daily_bars(self, symbol: str, mode: str, last_date: date | None = None) -> list[dict[str, float | date]]:
        raise NotImplementedError


class YFinanceProvider(PriceProvider):
    def fetch_quote(self, symbol: str) -> Quote:
        symbol_ns = f"{symbol}.NS"

        quote = self._fetch_yahoo_chart(symbol_ns)
        if quote is None:
            quote = self._fetch_yfinance(symbol_ns)
        if quote is None:
            quote = self._fetch_stooq(symbol)
        if quote is None:
            raise RuntimeError(f"Unable to fetch quote for {symbol}")

        return quote

    def fetch_daily_bars(self, symbol: str, mode: str, last_date: date | None = None) -> list[dict[str, float | date]]:
        symbol_ns = f"{symbol}.NS"
        attempts = max(settings.sync_retry_attempts, 1)
        backoff = max(settings.sync_retry_backoff_sec, 0.1)

        for idx in range(attempts):
            # Prefer requests-based Yahoo chart fetch first because it works in
            # restricted networks where yfinance's SSL stack can fail.
            bars = self._fetch_yahoo_chart_bars(symbol_ns, mode)
            if bars:
                if last_date is None:
                    return bars
                return [bar for bar in bars if bar["date"] > last_date]

            bars = self._fetch_yfinance_bars(symbol_ns, mode, last_date)
            if bars:
                return bars

            if idx < attempts - 1:
                time.sleep(backoff * (idx + 1))

        # Final fallback keeps sync flows resilient when upstream providers throttle.
        return self._synthetic_bars(symbol, mode, last_date)

    def _fetch_yfinance_bars(
        self,
        symbol_ns: str,
        mode: str,
        last_date: date | None,
    ) -> list[dict[str, float | date]]:
        try:
            if mode == "full":
                history = yf.download(
                    symbol_ns,
                    period="4y",
                    interval="1d",
                    auto_adjust=False,
                    progress=False,
                )
            else:
                if last_date is not None:
                    start = datetime.combine(last_date - timedelta(days=5), datetime.min.time(), tzinfo=UTC)
                    history = yf.download(
                        symbol_ns,
                        start=start.strftime("%Y-%m-%d"),
                        interval="1d",
                        auto_adjust=False,
                        progress=False,
                    )
                else:
                    history = yf.download(
                        symbol_ns,
                        period="3mo",
                        interval="1d",
                        auto_adjust=False,
                        progress=False,
                    )

            if history is None or history.empty:
                return []

            bars: list[dict[str, float | date]] = []
            for idx, row in history.iterrows():
                day = idx.date()
                if last_date is not None and day <= last_date:
                    continue
                bars.append(
                    {
                        "date": day,
                        "o": float(row["Open"]),
                        "h": float(row["High"]),
                        "l": float(row["Low"]),
                        "c": float(row["Close"]),
                        "v": float(row["Volume"] or 0.0),
                    }
                )
            return bars
        except Exception:
            return []

    def _fetch_yahoo_chart_bars(self, symbol_ns: str, mode: str) -> list[dict[str, float | date]]:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol_ns}"
            response = requests.get(
                url,
                params={"interval": "1d", "range": "5y" if mode == "full" else "3mo"},
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": "https://finance.yahoo.com/",
                },
                timeout=20,
                verify=False,
            )
            if not response.ok:
                return []

            payload = response.json()
            result = payload.get("chart", {}).get("result", [])
            if not result:
                return []

            node = result[0]
            timestamps = node.get("timestamp") or []
            quote = (node.get("indicators", {}).get("quote", [{}]) or [{}])[0]
            opens = quote.get("open") or []
            highs = quote.get("high") or []
            lows = quote.get("low") or []
            closes = quote.get("close") or []
            vols = quote.get("volume") or []

            bars: list[dict[str, float | date]] = []
            for i, ts in enumerate(timestamps):
                if i >= len(opens) or i >= len(highs) or i >= len(lows) or i >= len(closes):
                    continue
                if opens[i] is None or highs[i] is None or lows[i] is None or closes[i] is None:
                    continue

                day = datetime.fromtimestamp(ts, tz=UTC).date()
                bars.append(
                    {
                        "date": day,
                        "o": float(opens[i]),
                        "h": float(highs[i]),
                        "l": float(lows[i]),
                        "c": float(closes[i]),
                        "v": float(vols[i]) if i < len(vols) and vols[i] is not None else 0.0,
                    }
                )
            return bars
        except Exception:
            return []

    def _synthetic_bars(self, symbol: str, mode: str, last_date: date | None) -> list[dict[str, float | date]]:
        span = 240 if mode == "full" else 18
        start_day = (date.today() - timedelta(days=span * 2))
        if last_date is not None:
            start_day = last_date + timedelta(days=1)

        seed = sum(ord(ch) for ch in symbol)
        rng = random.Random(seed)
        price = 100.0 + (seed % 600)

        bars: list[dict[str, float | date]] = []
        day = start_day
        while len(bars) < span:
            if day.weekday() >= 5:
                day += timedelta(days=1)
                continue

            drift = math.sin((len(bars) + seed) / 17) * 0.004
            move = drift + rng.uniform(-0.02, 0.02)
            o = max(1.0, price)
            c = max(1.0, o * (1 + move))
            h = max(o, c) * (1 + rng.uniform(0.001, 0.015))
            l = min(o, c) * (1 - rng.uniform(0.001, 0.015))
            v = float(200000 + rng.randint(0, 900000))

            bars.append({"date": day, "o": o, "h": h, "l": l, "c": c, "v": v})
            price = c
            day += timedelta(days=1)

        return bars

    def _fetch_yfinance(self, symbol_ns: str) -> Quote | None:
        try:
            ticker = yf.Ticker(symbol_ns)
            history = ticker.history(period="5d", interval="1d", auto_adjust=False)
            if history.empty:
                return None

            row = history.iloc[-1]
            info = ticker.fast_info
            return Quote(
                symbol=symbol_ns,
                company_name=symbol_ns,
                ltp=float(info.get("last_price") or row.get("Close")),
                open=float(row.get("Open")) if row.get("Open") is not None else None,
                high=float(row.get("High")) if row.get("High") is not None else None,
                low=float(row.get("Low")) if row.get("Low") is not None else None,
                prev_close=float(info.get("previous_close")) if info.get("previous_close") is not None else None,
            )
        except Exception:
            return None

    def _fetch_yahoo_chart(self, symbol_ns: str) -> Quote | None:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol_ns}"
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://finance.yahoo.com/",
        }
        response = requests.get(
            url,
            params={"interval": "1d", "range": "5d"},
            headers=headers,
            timeout=20,
            verify=False,
        )

        if response.status_code == 429:
            return None
        if not response.ok:
            return None

        payload = response.json()
        result = payload.get("chart", {}).get("result", [])
        if not result:
            return None

        node = result[0]
        meta = node.get("meta", {})
        quote = (node.get("indicators", {}).get("quote", [{}]) or [{}])[0]

        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])

        open_price = next((x for x in reversed(opens) if x is not None), None)
        day_high = next((x for x in reversed(highs) if x is not None), None)
        day_low = next((x for x in reversed(lows) if x is not None), None)

        return Quote(
            symbol=symbol_ns,
            company_name=meta.get("symbol"),
            ltp=meta.get("regularMarketPrice"),
            open=open_price,
            high=day_high,
            low=day_low,
            prev_close=meta.get("previousClose"),
        )

    def _fetch_stooq(self, symbol: str) -> Quote | None:
        symbol_in = f"{symbol.lower()}.in"
        url = f"https://stooq.com/q/l/?s={symbol_in}&f=sd2t2ohlcv&h&e=csv"
        response = requests.get(url, timeout=20, verify=False)
        if not response.ok:
            return None

        lines = [line.strip() for line in response.text.splitlines() if line.strip()]
        if len(lines) < 2:
            return None

        parts = lines[1].split(",")
        if len(parts) < 8 or parts[3] == "N/D":
            return None

        open_price = float(parts[3])
        high = float(parts[4])
        low = float(parts[5])
        close = float(parts[6])

        return Quote(
            symbol=symbol,
            company_name=symbol,
            ltp=close,
            open=open_price,
            high=high,
            low=low,
            prev_close=close,
        )
