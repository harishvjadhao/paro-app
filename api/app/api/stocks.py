from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.stocks import CandlesResponse, IndustryGroup, StockDetail
from app.services import stocks as stocks_service

router = APIRouter(tags=["stocks"])


@router.get("/stocks", response_model=list[IndustryGroup])
def get_stocks(
    filter: str = Query("all", pattern="^(all|ma|fav|watch)$"),
    q: str = "",
    db: Session = Depends(get_db),
) -> list[IndustryGroup]:
    raw = stocks_service.list_stocks(db, filter_mode=filter, q=q)
    return [IndustryGroup.model_validate(g) for g in raw]


@router.get("/stocks/{symbol}", response_model=StockDetail)
def get_stock(symbol: str, db: Session = Depends(get_db)) -> StockDetail:
    detail = stocks_service.stock_detail(db, symbol)
    if not detail:
        raise HTTPException(status_code=404, detail="symbol not found")
    return StockDetail.model_validate(detail)


@router.get("/stocks/{symbol}/candles", response_model=CandlesResponse)
def get_candles(
    symbol: str,
    timeframe: str = Query("D", pattern="^(D|W|M|d|w|m)$"),
    bars: int = Query(44, ge=10, le=500),
    indicators: str = Query("ma44"),
    db: Session = Depends(get_db),
) -> CandlesResponse:
    inds = [p.strip() for p in indicators.split(",") if p.strip()]
    payload = stocks_service.candles_for_symbol(
        db, symbol, timeframe=timeframe.upper(), bars=bars, indicators=inds
    )
    if payload is None:
        raise HTTPException(status_code=404, detail="symbol not found")
    return CandlesResponse.model_validate(payload)
