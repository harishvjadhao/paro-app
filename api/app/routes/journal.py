from datetime import date

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.journal import (
    ChargeBreakdownResponse,
    ChargesPreviewRequest,
    ImportResponse,
    JournalAnalyticsResponse,
    PositionsResponse,
    TradeCreateRequest,
    TradeListResponse,
    TradeResponse,
    TradeUpdateRequest,
)
from app.services.journal import JournalService

router = APIRouter(tags=["journal"])
service = JournalService()


@router.get("/journal/trades", response_model=TradeListResponse)
def list_trades(
    q: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> TradeListResponse:
    return service.list_trades(db, q=q, segment=segment, tag=tag, date_from=date_from, date_to=date_to)


@router.post("/journal/trades", response_model=TradeResponse)
def create_trade(payload: TradeCreateRequest, db: Session = Depends(get_db)) -> TradeResponse:
    return service.create_trade(db, payload)


@router.patch("/journal/trades/{trade_id}", response_model=TradeResponse)
def update_trade(trade_id: int, payload: TradeUpdateRequest, db: Session = Depends(get_db)) -> TradeResponse:
    return service.update_trade(db, trade_id, payload)


@router.delete("/journal/trades/{trade_id}")
def delete_trade(trade_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.delete_trade(db, trade_id)


@router.post("/journal/charges/preview", response_model=ChargeBreakdownResponse)
def preview_charges(payload: ChargesPreviewRequest) -> ChargeBreakdownResponse:
    return service.preview_charges(payload)


@router.get("/journal/analytics", response_model=JournalAnalyticsResponse)
def journal_analytics(db: Session = Depends(get_db)) -> JournalAnalyticsResponse:
    return service.analytics(db)


@router.get("/journal/positions", response_model=PositionsResponse)
def journal_positions(db: Session = Depends(get_db)) -> PositionsResponse:
    return service.positions(db)


@router.get("/journal/export")
def export_journal(db: Session = Depends(get_db)) -> PlainTextResponse:
    csv_text = service.export_csv(db)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="paro-journal.csv"'},
    )


@router.post("/journal/import", response_model=ImportResponse)
async def import_journal(file: UploadFile = File(...), db: Session = Depends(get_db)) -> ImportResponse:
    return await service.import_csv(db, file)
