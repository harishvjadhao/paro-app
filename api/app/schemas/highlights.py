from datetime import date

from pydantic import BaseModel, Field


class HighlightCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    date_from: date
    date_to: date | None = None
    symbol: str | None = None
    color: str | None = None


class HighlightUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    date_from: date | None = None
    date_to: date | None = None
    symbol: str | None = None
    color: str | None = None
    clear_symbol: bool = False


class HighlightResponse(BaseModel):
    id: int
    label: str
    color: str
    symbol: str | None
    date_from: date
    date_to: date
    reused_color: bool = False
