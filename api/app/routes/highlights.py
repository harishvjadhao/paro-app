from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.highlights import HighlightCreateRequest, HighlightResponse, HighlightUpdateRequest
from app.services.highlights import HighlightsService

router = APIRouter(tags=["highlights"])
service = HighlightsService()


@router.get("/highlights", response_model=list[HighlightResponse])
def list_highlights(db: Session = Depends(get_db)) -> list[HighlightResponse]:
    return service.list_highlights(db)


@router.post("/highlights", response_model=HighlightResponse)
def create_highlight(payload: HighlightCreateRequest, db: Session = Depends(get_db)) -> HighlightResponse:
    return service.create_highlight(db, payload)


@router.patch("/highlights/{highlight_id}", response_model=HighlightResponse)
def update_highlight(
    highlight_id: int,
    payload: HighlightUpdateRequest,
    db: Session = Depends(get_db),
) -> HighlightResponse:
    return service.update_highlight(db, highlight_id, payload)


@router.delete("/highlights/{highlight_id}")
def delete_highlight(highlight_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.delete_highlight(db, highlight_id)
