from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SyncStartRequest(BaseModel):
    mode: Literal["full", "incremental"]
    scope: Literal["universe", "watchlist"]


class SyncRunItemResponse(BaseModel):
    id: int
    run_id: int
    symbol: str
    status: str
    rows: int
    window: str
    message: str


class SyncRunResponse(BaseModel):
    id: int
    mode: str
    scope: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    processed: int
    updated: int
    failed: int
    total: int
    error: str | None


class SyncRunDetailResponse(BaseModel):
    run: SyncRunResponse
    items: list[SyncRunItemResponse]
