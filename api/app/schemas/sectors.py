from __future__ import annotations

from pydantic import BaseModel, Field


class SectorSummary(BaseModel):
    name: str
    total: int
    above: int
    breadth: float
    avg_pct_vs_ma: float
    avg8: float
    momentum: float
    rotation_x: float
    rotation_y: float


class SectorConstituent(BaseModel):
    symbol: str
    company: str
    close: float
    ma44: float | None
    pct_vs_ma44: float
    above_ma44: bool
    sparkline: list[float] = Field(default_factory=list)


class WeeklyBreadthPoint(BaseModel):
    label: str
    pct: float
    avg_above: float


class SectorDetail(BaseModel):
    name: str
    total: int
    above: int
    below: int
    breadth: float
    avg_pct_vs_ma: float
    advancers: int
    decliners: int
    avg8: float
    momentum: float
    leader: SectorConstituent | None = None
    laggard: SectorConstituent | None = None
    constituents: list[SectorConstituent]
    weekly_trend: list[WeeklyBreadthPoint]
    rotation_x: float
    rotation_y: float


class SectorCompareSeries(BaseModel):
    name: str
    color: str
    points: list[WeeklyBreadthPoint]
    selected: bool = False


class SectorCompareResponse(BaseModel):
    sectors: list[SectorCompareSeries]
    a: str | None = None
    b: str | None = None


class SectorListResponse(BaseModel):
    sectors: list[SectorSummary]
