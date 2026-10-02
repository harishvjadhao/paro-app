from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.sync import SyncRunDetailResponse, SyncRunResponse, SyncStartRequest
from app.services.sync import SyncService

router = APIRouter(tags=["sync"])
sync_service = SyncService()


@router.post("/admin/sync", response_model=SyncRunResponse)
def start_sync(
    payload: SyncStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncRunResponse:
    run_id = sync_service.start_run(db, mode=payload.mode, scope=payload.scope)
    background_tasks.add_task(sync_service.execute_run, run_id, payload.mode, payload.scope, None)
    return sync_service.status(db)


@router.post("/admin/sync/{symbol}", response_model=SyncRunResponse)
def sync_one(
    symbol: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncRunResponse:
    run_id = sync_service.start_run(db, mode="incremental", scope="single")
    background_tasks.add_task(sync_service.execute_run, run_id, "incremental", "single", [symbol.upper()])
    return sync_service.status(db)


@router.get("/admin/sync/status", response_model=SyncRunResponse)
def sync_status(db: Session = Depends(get_db)) -> SyncRunResponse:
    return sync_service.status(db)


@router.get("/admin/sync/runs", response_model=list[SyncRunResponse])
def list_sync_runs(db: Session = Depends(get_db)) -> list[SyncRunResponse]:
    return sync_service.list_runs(db)


@router.get("/admin/sync/runs/{run_id}", response_model=SyncRunDetailResponse)
def get_sync_run(run_id: int, db: Session = Depends(get_db)) -> SyncRunDetailResponse:
    return sync_service.run_detail(db, run_id)


@router.post("/admin/sync/runs/{run_id}/retry-failed", response_model=SyncRunResponse)
def retry_failed(
    run_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SyncRunResponse:
    new_run_id, symbols, mode, scope = sync_service.retry_failed(db, run_id)
    background_tasks.add_task(sync_service.execute_run, new_run_id, mode, scope, symbols)
    return sync_service.status(db)
