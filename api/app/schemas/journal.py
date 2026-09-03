from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Segment = Literal["Delivery", "Intraday"]
Side = Literal["long", "short"]


class ChargeBreakdownResponse(BaseModel):
    buy_val: float
    sell_val: float
    turnover: float
    brokerage: float
    stt: float
    txn: float
    sebi: float
    stamp: float
    gst: float
    dp: float
    total: float
    gross: float
    net: float


class TradeCreateRequest(BaseModel):
    symbol: str
    segment: Segment = "Delivery"
    side: Side = "long"
    qty: float = Field(gt=0)
    entry_price: float = Field(gt=0)
    entry_date: date
    exit_price: float | None = None
    exit_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str = ""


class TradeUpdateRequest(BaseModel):
    symbol: str | None = None
    segment: Segment | None = None
    side: Side | None = None
    qty: float | None = Field(default=None, gt=0)
    entry_price: float | None = Field(default=None, gt=0)
    entry_date: date | None = None
    exit_price: float | None = None
    exit_date: date | None = None
    clear_exit: bool = False
    tags: list[str] | None = None
    notes: str | None = None


class TradeResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    segment: Segment
    side: Side
    qty: float
    entry_price: float
    entry_date: date
    exit_price: float | None
    exit_date: date | None
    tags: list[str]
    notes: str
    created_at: datetime
    is_open: bool
    charges: ChargeBreakdownResponse
    last_close: float | None = None
    unrealized: float | None = None


class ChargesPreviewRequest(BaseModel):
    segment: Segment = "Delivery"
    qty: float = Field(gt=0)
    entry_price: float = Field(gt=0)
    exit_price: float | None = None


class JournalSummary(BaseModel):
    trade_count: int
    open_count: int
    realized_net: float
    unrealized: float
    total_charges: float
    win_rate: float | None


class EquityPoint(BaseModel):
    date: date
    trade_id: int
    symbol: str
    net: float
    cumulative: float


class SegmentStat(BaseModel):
    segment: Segment
    count: int
    net: float
    charges: float


class SymbolStat(BaseModel):
    symbol: str
    count: int
    net: float


class JournalAnalyticsResponse(BaseModel):
    closed_count: int
    avg_win: float | None
    avg_loss: float | None
    expectancy: float | None
    largest_win: float | None
    largest_loss: float | None
    equity_curve: list[EquityPoint]
    by_segment: list[SegmentStat]
    by_symbol: list[SymbolStat]


class PositionItem(BaseModel):
    id: int
    symbol: str
    segment: Segment
    qty: float
    entry_price: float
    entry_date: date
    tags: list[str]
    notes: str
    last_close: float | None
    unrealized: float | None


class PositionsResponse(BaseModel):
    items: list[PositionItem]
    total_unrealized: float


class TradeListResponse(BaseModel):
    items: list[TradeResponse]
    summary: JournalSummary


class ImportResponse(BaseModel):
    imported: int
    skipped: int
    items: list[TradeResponse]
