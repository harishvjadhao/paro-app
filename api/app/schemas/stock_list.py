from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ScreenLabel = Literal["Strong buy", "Buy", "Watch", "Avoid", "On hold"]
ColumnType = Literal["text", "number", "choice", "date", "boolean", "signal20"]


class MaState(BaseModel):
    above: bool
    overridden: bool
    ma20: float | None = None
    close: float | None = None


class StockListRow(BaseModel):
    symbol: str
    company: str
    industry: str
    subcategory: str
    notes: str
    screen: ScreenLabel
    screen_auto: ScreenLabel
    screen_overridden: bool
    ma_d: MaState
    ma_w: MaState
    ma_m: MaState
    ma_m_label: str
    custom: dict[str, Any] = Field(default_factory=dict)


class StockListResponse(BaseModel):
    rows: list[StockListRow]
    columns: list["StockListColumnResponse"]
    screen_options: list[ScreenLabel]


class ListPatchRequest(BaseModel):
    field: str
    value: str | bool | int | float | None = None


class StockListColumnResponse(BaseModel):
    id: int
    key: str
    label: str
    type: ColumnType
    options: list[str] = Field(default_factory=list)
    position: int
    hidden: bool
    builtin: bool = False


class ColumnCreateRequest(BaseModel):
    label: str
    type: ColumnType = "text"
    options: list[str] = Field(default_factory=list)


class ColumnUpdateRequest(BaseModel):
    label: str | None = None
    type: ColumnType | None = None
    options: list[str] | None = None
    position: int | None = None
    hidden: bool | None = None


class ColumnReorderRequest(BaseModel):
    keys: list[str]
