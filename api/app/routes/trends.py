from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.trends import TrendDrillResponse, WeeklyTrendsResponse
from app.services.trends import TrendsService

router = APIRouter(tags=["trends"])
service = TrendsService()


@router.get("/trends/weekly", response_model=WeeklyTrendsResponse)
def weekly_trends(db: Session = Depends(get_db)) -> WeeklyTrendsResponse:
    return service.weekly_matrix(db)


@router.get("/trends/weekly/{sector}/{week_index}", response_model=TrendDrillResponse)
def weekly_trend_drill(sector: str, week_index: int, db: Session = Depends(get_db)) -> TrendDrillResponse:
    return service.weekly_drill(db, sector, week_index)
