from __future__ import annotations

from pydantic import BaseModel, Field


class TrendWeek(BaseModel):
    index: int
    label: str
    end_date: str


class TrendCell(BaseModel):
    week_index: int
    pct: float
    avg_above: float
    total: int


class TrendSectorRow(BaseModel):
    name: str
    total: int
    cells: list[TrendCell]
    avg: float


class WeeklyTrendsResponse(BaseModel):
    weeks: list[TrendWeek]
    sectors: list[TrendSectorRow]
    summary: str


class TrendDrillStock(BaseModel):
    symbol: str
    company: str
    pct_vs_ma44: float
    above_ma44: bool
    week_above_share: float
    flipped: bool = False


class TrendDrillResponse(BaseModel):
    sector: str
    week_index: int
    week_label: str
    end_date: str
    pct: float
    avg_above: float
    total: int
    above_count: int
    stocks: list[TrendDrillStock] = Field(default_factory=list)
