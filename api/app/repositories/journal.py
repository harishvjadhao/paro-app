from __future__ import annotations

from datetime import date

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.journal import Trade
from app.models.sync import PriceBar


class JournalRepository:
    def list_trades(
        self,
        db: Session,
        *,
        user_id: int = 1,
        q: str | None = None,
        segment: str | None = None,
        tag: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[Trade]:
        statement = select(Trade).where(Trade.user_id == user_id).order_by(desc(Trade.entry_date), desc(Trade.id))
        rows = list(db.scalars(statement))

        needle = (q or "").strip().upper()
        tag_needle = (tag or "").strip().lower()
        filtered: list[Trade] = []
        for row in rows:
            if segment and segment != "All" and row.segment != segment:
                continue
            if date_from and row.entry_date < date_from:
                continue
            if date_to and row.entry_date > date_to:
                continue
            if needle:
                hay = f"{row.symbol} {row.tags} {row.notes}".upper()
                if needle not in hay:
                    continue
            if tag_needle:
                tags_blob = row.tags.lower()
                if tag_needle not in tags_blob:
                    continue
            filtered.append(row)
        return filtered

    def get_trade(self, db: Session, trade_id: int, *, user_id: int = 1) -> Trade | None:
        statement = select(Trade).where(and_(Trade.id == trade_id, Trade.user_id == user_id))
        return db.scalar(statement)

    def create_trade(self, db: Session, trade: Trade) -> Trade:
        db.add(trade)
        db.flush()
        db.refresh(trade)
        return trade

    def delete_trade(self, db: Session, trade: Trade) -> None:
        db.delete(trade)

    def list_open(self, db: Session, *, user_id: int = 1) -> list[Trade]:
        statement = (
            select(Trade)
            .where(and_(Trade.user_id == user_id, Trade.exit_price.is_(None)))
            .order_by(desc(Trade.entry_date), desc(Trade.id))
        )
        return list(db.scalars(statement))

    def latest_close(self, db: Session, symbol: str) -> float | None:
        statement = (
            select(PriceBar.c)
            .where(PriceBar.symbol == symbol.upper())
            .order_by(desc(PriceBar.date))
            .limit(1)
        )
        value = db.scalar(statement)
        return float(value) if value is not None else None
