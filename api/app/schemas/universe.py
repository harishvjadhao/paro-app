from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class UniverseStock(BaseModel):
    id: int
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UniverseUploadPreviewRow(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str


class UniverseUploadResponse(BaseModel):
    total: int
    dup: int
    invalid: int
    mode: Literal["append", "replace"]
    preview: list[UniverseUploadPreviewRow]
    created_at: datetime
