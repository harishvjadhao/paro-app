from datetime import date, datetime

from pydantic import BaseModel, Field


class UniverseStockOut(BaseModel):
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str
    active: bool

    model_config = {"from_attributes": True}


class UniverseUploadOut(BaseModel):
    id: int
    filename: str
    total: int
    duplicates: int
    invalid: int
    uploaded_at: datetime
    replaced: bool = False
    invalid_messages: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SyncRequest(BaseModel):
    mode: str = "Incremental"  # Full | Incremental


class SyncRunOut(BaseModel):
    id: int
    mode: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    processed: int
    updated: int
    failed: int
    error: str | None = None

    model_config = {"from_attributes": True}


class SyncRunItemOut(BaseModel):
    id: int
    run_id: int
    symbol: str
    status: str
    rows_written: int
    window_start: date | None
    window_end: date | None
    message: str | None

    model_config = {"from_attributes": True}


class SyncRunDetailOut(SyncRunOut):
    items: list[SyncRunItemOut] = Field(default_factory=list)
