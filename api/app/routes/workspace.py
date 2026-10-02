from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.workspace import (
    CandleResponse,
    CommentCreateRequest,
    CommentUpdateRequest,
    ReorderRequest,
    StockCommentResponse,
    StockDetailResponse,
    StockListItem,
    ToggleStateResponse,
)
from app.services.workspace import WorkspaceService

router = APIRouter(tags=["workspace"])
service = WorkspaceService()


@router.get("/stocks", response_model=list[StockListItem])
def list_stocks(
    filter: str = Query("all"),
    q: str = Query(""),
    db: Session = Depends(get_db),
) -> list[StockListItem]:
    return service.list_stocks(db, filter_key=filter, q=q)


@router.get("/stocks/{symbol}", response_model=StockDetailResponse)
def stock_detail(symbol: str, db: Session = Depends(get_db)) -> StockDetailResponse:
    return service.stock_detail(db, symbol)


@router.get("/stocks/{symbol}/candles", response_model=CandleResponse)
def stock_candles(
    symbol: str,
    timeframe: str = Query("D"),
    bars: int = Query(44),
    indicators: str = Query("ma44"),
    db: Session = Depends(get_db),
) -> CandleResponse:
    return service.candles(db, symbol, timeframe, bars, indicators)


@router.post("/stocks/{symbol}/favorite", response_model=ToggleStateResponse)
def toggle_favorite(symbol: str, db: Session = Depends(get_db)) -> ToggleStateResponse:
    return service.toggle_favorite(db, symbol)


@router.post("/stocks/{symbol}/watch", response_model=ToggleStateResponse)
def toggle_watch(symbol: str, db: Session = Depends(get_db)) -> ToggleStateResponse:
    return service.toggle_watchlist(db, symbol)


@router.post("/stocks/{symbol}/comments", response_model=StockCommentResponse)
def add_comment(symbol: str, payload: CommentCreateRequest, db: Session = Depends(get_db)) -> StockCommentResponse:
    return service.add_comment(db, symbol, payload.body)


@router.patch("/stocks/{symbol}/comments/{comment_id}", response_model=StockCommentResponse)
def update_comment(
    symbol: str,
    comment_id: int,
    payload: CommentUpdateRequest,
    db: Session = Depends(get_db),
) -> StockCommentResponse:
    return service.update_comment(db, symbol, comment_id, payload.body)


@router.delete("/stocks/{symbol}/comments/{comment_id}")
def delete_comment(symbol: str, comment_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.delete_comment(db, symbol, comment_id)


@router.patch("/stocks/order")
def reorder_stocks(payload: ReorderRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    return service.reorder_group(db, payload.industry, payload.symbols)
