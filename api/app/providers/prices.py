from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import requests
import urllib3
import yfinance as yf

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


class YFinanceProvider(PriceProvider):
    def fetch_quote(self, symbol: str) -> Quote:
        symbol_ns = f"{symbol}.NS"

        quote = self._fetch_yfinance(symbol_ns)
        if quote is None:
            quote = self._fetch_yahoo_chart(symbol_ns)
        if quote is None:
            quote = self._fetch_stooq(symbol)
        if quote is None:
            raise RuntimeError(f"Unable to fetch quote for {symbol}")

        return quote

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
