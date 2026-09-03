from __future__ import annotations

import json

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.stock_list import StockListColumn, StockMeta
from app.models.sync import PriceBar
from app.models.universe import StockUniverse
from sqlalchemy import desc


class StockListRepository:
    def list_universe(self, db: Session) -> list[StockUniverse]:
        statement = select(StockUniverse).where(StockUniverse.active == True).order_by(StockUniverse.industry.asc(), StockUniverse.symbol.asc())
        return list(db.scalars(statement))

    def get_universe_symbol(self, db: Session, symbol: str) -> StockUniverse | None:
        return db.scalar(select(StockUniverse).where(StockUniverse.symbol == symbol.upper()))

    def list_meta(self, db: Session) -> dict[str, StockMeta]:
        rows = list(db.scalars(select(StockMeta)))
        return {row.symbol: row for row in rows}

    def get_or_create_meta(self, db: Session, symbol: str) -> StockMeta:
        meta = db.get(StockMeta, symbol.upper())
        if meta is not None:
            return meta
        meta = StockMeta(symbol=symbol.upper())
        db.add(meta)
        db.flush()
        db.refresh(meta)
        return meta

    def list_daily_bars(self, db: Session, symbol: str, limit: int = 500) -> list[PriceBar]:
        statement = (
            select(PriceBar)
            .where(PriceBar.symbol == symbol.upper())
            .order_by(desc(PriceBar.date))
            .limit(limit)
        )
        rows = list(db.scalars(statement))
        rows.reverse()
        return rows

    def list_columns(self, db: Session, *, user_id: int = 1) -> list[StockListColumn]:
        statement = (
            select(StockListColumn)
            .where(StockListColumn.user_id == user_id)
            .order_by(StockListColumn.position.asc(), StockListColumn.id.asc())
        )
        return list(db.scalars(statement))

    def get_column(self, db: Session, column_id: int, *, user_id: int = 1) -> StockListColumn | None:
        column = db.get(StockListColumn, column_id)
        if column is None or column.user_id != user_id:
            return None
        return column

    def get_column_by_key(self, db: Session, key: str, *, user_id: int = 1) -> StockListColumn | None:
        statement = select(StockListColumn).where(and_(StockListColumn.user_id == user_id, StockListColumn.key == key))
        return db.scalar(statement)

    def add_column(
        self,
        db: Session,
        *,
        key: str,
        label: str,
        type_name: str,
        options_json: str,
        position: int,
        user_id: int = 1,
    ) -> StockListColumn:
        column = StockListColumn(
            key=key,
            label=label,
            type=type_name,
            options_json=options_json,
            position=position,
            hidden=0,
            user_id=user_id,
        )
        db.add(column)
        db.flush()
        db.refresh(column)
        return column

    def delete_column(self, db: Session, column: StockListColumn) -> None:
        db.delete(column)

    @staticmethod
    def read_custom_values(meta: StockMeta | None) -> dict[str, object]:
        if meta is None or not meta.custom_values:
            return {}
        try:
            payload = json.loads(meta.custom_values)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def write_custom_values(meta: StockMeta, values: dict[str, object]) -> None:
        meta.custom_values = json.dumps(values)
