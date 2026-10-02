from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.universe import UniverseStatusResponse, UniverseStock, UniverseUploadResponse
from app.services.universe import UniverseService

router = APIRouter(tags=["universe"])
service = UniverseService()


@router.get("/universe", response_model=list[UniverseStock])
def list_universe(db: Session = Depends(get_db)) -> list[UniverseStock]:
    rows = service.list_universe(db)
    return [UniverseStock.model_validate(row, from_attributes=True) for row in rows]


@router.get("/admin/universe/status", response_model=UniverseStatusResponse)
def universe_status(db: Session = Depends(get_db)) -> UniverseStatusResponse:
    return service.get_status(db)


@router.delete("/admin/universe")
def clear_universe(db: Session = Depends(get_db)) -> dict[str, int]:
    deleted = service.clear_universe(db)
    return {"deleted": deleted}


@router.post("/admin/universe/upload", response_model=UniverseUploadResponse)
async def upload_universe(
    file: UploadFile = File(...),
    mode: str = Form("append"),
    confirm: bool = Form(False),
    db: Session = Depends(get_db),
) -> UniverseUploadResponse:
    content = await file.read()
    return service.upload_universe(
        db,
        filename=file.filename or "upload.csv",
        mode=mode,
        confirm=confirm,
        content=content,
    )
