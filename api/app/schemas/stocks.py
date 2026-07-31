from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class StockListItem(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    close: float | None = None
    ma44: float | None = None
    above: bool | None = None
    pct_vs_ma: float | None = None
    as_of: str | None = None
    favorite: bool = False
    watchlist: bool = False
    industry_sort_order: int = 0


class IndustryGroup(BaseModel):
    industry: str
    stocks: list[StockListItem]


class StockDetail(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    close: float | None = None
    ma44: float | None = None
    above: bool | None = None
    pct_vs_ma: float | None = None
    as_of: str | None = None


class CandleBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class BollingerOut(BaseModel):
    mid: list[float | None]
    up: list[float | None]
    lo: list[float | None]


class CandlesResponse(BaseModel):
    symbol: str
    timeframe: str
    bars: list[CandleBar]
    ma44: list[float | None] = Field(default_factory=list)
    bb: BollingerOut | None = None
    rsi: list[float | None] | None = None
    highlights: list[dict[str, Any]] = Field(default_factory=list)
    comments: list[dict[str, Any]] = Field(default_factory=list)
