from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.stock_list import (
    ColumnCreateRequest,
    ColumnReorderRequest,
    ColumnUpdateRequest,
    ListPatchRequest,
    StockListColumnResponse,
    StockListResponse,
    StockListRow,
)
from app.services.stock_list import StockListService

router = APIRouter(tags=["stock-list"])
service = StockListService()


@router.get("/list", response_model=StockListResponse)
def get_stock_list(db: Session = Depends(get_db)) -> StockListResponse:
    return service.get_list(db)


@router.get("/list/columns", response_model=list[StockListColumnResponse])
def get_stock_list_columns(db: Session = Depends(get_db)) -> list[StockListColumnResponse]:
    return service.list_columns(db)


@router.post("/list/columns", response_model=StockListColumnResponse)
def create_stock_list_column(payload: ColumnCreateRequest, db: Session = Depends(get_db)) -> StockListColumnResponse:
    return service.create_column(db, payload)


@router.patch("/list/columns/reorder", response_model=list[StockListColumnResponse])
def reorder_stock_list_columns(payload: ColumnReorderRequest, db: Session = Depends(get_db)) -> list[StockListColumnResponse]:
    return service.reorder_columns(db, payload)


@router.patch("/list/columns/{column_id}", response_model=StockListColumnResponse)
def update_stock_list_column(
    column_id: int,
    payload: ColumnUpdateRequest,
    db: Session = Depends(get_db),
) -> StockListColumnResponse:
    return service.update_column(db, column_id, payload)


@router.delete("/list/columns/{column_id}")
def delete_stock_list_column(column_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.delete_column(db, column_id)


@router.patch("/list/{symbol}", response_model=StockListRow)
def patch_stock_list_row(symbol: str, payload: ListPatchRequest, db: Session = Depends(get_db)) -> StockListRow:
    return service.patch_row(db, symbol, payload)
