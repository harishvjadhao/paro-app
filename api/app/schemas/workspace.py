from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class StockListItem(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    close: float
    ma44: float | None
    pct_vs_ma44: float
    above_ma44: bool
    is_favorite: bool
    is_watchlist: bool
    last_sync: str


class StockDetailResponse(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    close: float
    ma44: float | None
    pct_vs_ma44: float
    above_ma44: bool
    is_favorite: bool
    is_watchlist: bool
    last_sync: str
    comments: list["StockCommentResponse"]


class CandleItem(BaseModel):
    date: str
    o: float
    h: float
    l: float
    c: float
    v: float
    ma44: float | None
    bb_upper: float | None
    bb_mid: float | None
    bb_lower: float | None
    rsi14: float | None


class ChartMarker(BaseModel):
    date: str
    kind: Literal["comment", "highlight"]
    id: int | None = None
    label: str | None = None
    color: str | None = None


class CandleResponse(BaseModel):
    symbol: str
    timeframe: Literal["D", "W", "M"]
    bars: list[CandleItem]
    markers: list[ChartMarker] = []


class ToggleStateResponse(BaseModel):
    symbol: str
    is_favorite: bool
    is_watchlist: bool


class CommentCreateRequest(BaseModel):
    body: str


class CommentUpdateRequest(BaseModel):
    body: str


class StockCommentResponse(BaseModel):
    id: int
    symbol: str
    body: str
    created_at: datetime
    updated_at: datetime


class ReorderRequest(BaseModel):
    industry: str
    symbols: list[str]
