from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import SyncRun, SyncRunItem
from app.providers.prices import get_price_provider
from app.schemas.universe import (
    SyncRequest,
    SyncRunDetailOut,
    SyncRunItemOut,
    SyncRunOut,
    UniverseStockOut,
    UniverseUploadOut,
)
from app.services import sync as sync_service
from app.services import universe as universe_service

router = APIRouter(tags=["universe", "admin"])


@router.get("/universe", response_model=list[UniverseStockOut])
def get_universe(db: Session = Depends(get_db)) -> list[UniverseStockOut]:
    return [UniverseStockOut.model_validate(s) for s in universe_service.list_universe(db)]


@router.post("/admin/universe/upload", response_model=UniverseUploadOut)
async def upload_universe(
    file: UploadFile = File(...),
    replace: bool = Form(False),
    confirm_replace: bool = Form(False),
    db: Session = Depends(get_db),
) -> UniverseUploadOut:
    if replace and not confirm_replace:
        raise HTTPException(
            status_code=400,
            detail="Replacing the universe is destructive; set confirm_replace=true",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty file")
    upload, parsed = universe_service.load_universe_from_bytes(
        db,
        content,
        file.filename or "universe.csv",
        replace=replace,
        uploaded_by=settings.default_user_id,
    )
    out = UniverseUploadOut.model_validate(upload)
    out.replaced = replace
    out.invalid_messages = parsed.invalid_messages[:20]
    return out


@router.post("/admin/sync", response_model=SyncRunOut)
def admin_sync(body: SyncRequest, db: Session = Depends(get_db)) -> SyncRunOut:
    provider = get_price_provider()
    run = sync_service.run_sync(db, provider, mode=body.mode)
    return SyncRunOut.model_validate(run)


@router.post("/admin/sync/{symbol}", response_model=SyncRunOut)
def admin_sync_symbol(symbol: str, db: Session = Depends(get_db)) -> SyncRunOut:
    provider = get_price_provider()
    run = sync_service.run_sync(db, provider, mode="Incremental", symbols=[symbol])
    return SyncRunOut.model_validate(run)


@router.get("/admin/sync/runs", response_model=list[SyncRunOut])
def list_sync_runs(db: Session = Depends(get_db), limit: int = 50) -> list[SyncRunOut]:
    rows = db.scalars(select(SyncRun).order_by(SyncRun.id.desc()).limit(limit)).all()
    return [SyncRunOut.model_validate(r) for r in rows]


@router.get("/admin/sync/runs/{run_id}", response_model=SyncRunDetailOut)
def get_sync_run(run_id: int, db: Session = Depends(get_db)) -> SyncRunDetailOut:
    run = db.get(SyncRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    items = db.scalars(
        select(SyncRunItem).where(SyncRunItem.run_id == run_id).order_by(SyncRunItem.symbol)
    ).all()
    out = SyncRunDetailOut.model_validate(run)
    out.items = [SyncRunItemOut.model_validate(i) for i in items]
    return out


@router.post("/admin/sync/runs/{run_id}/retry-failed", response_model=SyncRunOut)
def retry_failed(run_id: int, db: Session = Depends(get_db)) -> SyncRunOut:
    run = db.get(SyncRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    provider = get_price_provider()
    new_run = sync_service.retry_failed(db, provider, run_id)
    return SyncRunOut.model_validate(new_run)
