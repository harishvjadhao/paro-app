from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.sectors import SectorCompareResponse, SectorDetail, SectorListResponse
from app.services.sectors import SectorService

router = APIRouter(tags=["sectors"])
service = SectorService()


@router.get("/sectors", response_model=SectorListResponse)
def list_sectors(db: Session = Depends(get_db)) -> SectorListResponse:
    return service.list_sectors(db)


@router.get("/sectors/compare", response_model=SectorCompareResponse)
def compare_sectors(
    a: str | None = Query(None),
    b: str | None = Query(None),
    db: Session = Depends(get_db),
) -> SectorCompareResponse:
    return service.compare(db, a=a, b=b)


@router.get("/sectors/{sector}", response_model=SectorDetail)
def sector_detail(sector: str, db: Session = Depends(get_db)) -> SectorDetail:
    return service.sector_detail(db, sector)
