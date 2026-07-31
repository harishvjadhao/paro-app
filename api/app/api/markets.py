from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.services import highlights as hl_service
from app.services import journal as journal_service
from app.services import sectors as sectors_service

router = APIRouter(tags=["sectors", "journal", "highlights"])


@router.get("/sectors")
def get_sectors(db: Session = Depends(get_db)) -> list[dict]:
    return sectors_service.list_sectors(db)


@router.get("/sectors/rotation")
def get_rotation(db: Session = Depends(get_db)) -> list[dict]:
    return sectors_service.rotation_points(db)


@router.get("/sectors/{name}")
def get_sector(name: str, db: Session = Depends(get_db)) -> dict:
    return sectors_service.breadth_for_sector(db, name)


@router.get("/trends/weekly")
def weekly_trends(db: Session = Depends(get_db)) -> dict:
    return sectors_service.weekly_breadth_matrix(db)


@router.get("/trends/weekly/{sector}/{week_index}")
def weekly_drill(sector: str, week_index: int, db: Session = Depends(get_db)) -> dict:
    try:
        return sectors_service.weekly_drill(db, sector, week_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class TradeIn(BaseModel):
    symbol: str
    segment: str
    qty: int
    buy_price: float
    sell_price: float | None = None
    entry_date: str
    exit_date: str | None = None
    note: str = ""
    tags: list[str] = Field(default_factory=list)


class TradePatch(BaseModel):
    symbol: str | None = None
    segment: str | None = None
    qty: int | None = None
    buy_price: float | None = None
    sell_price: float | None = None
    entry_date: str | None = None
    exit_date: str | None = None
    note: str | None = None
    tags: list[str] | None = None


@router.get("/journal/trades")
def get_trades(
    open_only: bool = False,
    symbol: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    return journal_service.list_trades(db, open_only=open_only, symbol=symbol, tag=tag)


@router.post("/journal/trades")
def post_trade(body: TradeIn, db: Session = Depends(get_db)) -> dict:
    t = journal_service.create_trade(db, body.model_dump())
    return journal_service.trade_to_dict(db, t)


@router.patch("/journal/trades/{trade_id}")
def patch_trade(trade_id: int, body: TradePatch, db: Session = Depends(get_db)) -> dict:
    t = journal_service.update_trade(db, trade_id, body.model_dump(exclude_unset=True))
    if not t:
        raise HTTPException(status_code=404, detail="trade not found")
    return journal_service.trade_to_dict(db, t)


@router.delete("/journal/trades/{trade_id}")
def delete_trade(trade_id: int, db: Session = Depends(get_db)) -> dict:
    if not journal_service.delete_trade(db, trade_id):
        raise HTTPException(status_code=404, detail="trade not found")
    return {"ok": True}


@router.get("/journal/analytics")
def get_analytics(db: Session = Depends(get_db)) -> dict:
    return journal_service.analytics(db)


@router.get("/journal/export")
def export_journal(db: Session = Depends(get_db)) -> PlainTextResponse:
    return PlainTextResponse(journal_service.export_csv(db), media_type="text/csv")


@router.post("/journal/import")
async def import_journal(file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict:
    content = (await file.read()).decode("utf-8-sig")
    n = journal_service.import_csv(db, content)
    return {"imported": n}


class HighlightIn(BaseModel):
    date: date
    label: str
    color: str | None = None


@router.get("/highlights")
def get_highlights(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [
        {"id": h.id, "date": h.date.isoformat(), "label": h.label, "color": h.color}
        for h in hl_service.list_highlights(db)
    ]


@router.post("/highlights")
def post_highlight(body: HighlightIn, db: Session = Depends(get_db)) -> dict:
    h = hl_service.upsert_highlight(db, body.date, body.label, body.color)
    return {"id": h.id, "date": h.date.isoformat(), "label": h.label, "color": h.color}


@router.delete("/highlights/{highlight_id}")
def delete_highlight(highlight_id: int, db: Session = Depends(get_db)) -> dict:
    if not hl_service.delete_highlight(db, highlight_id):
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@router.get("/settings")
def get_settings() -> dict:
    from app.config import settings as cfg

    return {
        "default_user_id": cfg.default_user_id,
        "tz": cfg.tz,
        "price_provider": cfg.price_provider,
    }
