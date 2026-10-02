from __future__ import annotations

from datetime import date

from sqlalchemy import and_, delete, desc, select
from sqlalchemy.orm import Session

from app.models.sync import PriceBar
from app.models.universe import StockUniverse
from app.models.workspace import StockComment, StockState


class WorkspaceRepository:
    def list_universe(self, db: Session) -> list[StockUniverse]:
        statement = select(StockUniverse).where(StockUniverse.active == True).order_by(StockUniverse.industry.asc(), StockUniverse.symbol.asc())
        return list(db.scalars(statement))

    def get_universe_symbol(self, db: Session, symbol: str) -> StockUniverse | None:
        statement = select(StockUniverse).where(StockUniverse.symbol == symbol.upper())
        return db.scalar(statement)

    def list_states(self, db: Session, *, user_id: int = 1) -> list[StockState]:
        statement = select(StockState).where(StockState.user_id == user_id)
        return list(db.scalars(statement))

    def get_or_create_state(self, db: Session, symbol: str, *, user_id: int = 1) -> StockState:
        statement = select(StockState).where(and_(StockState.user_id == user_id, StockState.symbol == symbol.upper()))
        state = db.scalar(statement)
        if state is not None:
            return state

        state = StockState(user_id=user_id, symbol=symbol.upper())
        db.add(state)
        db.flush()
        db.refresh(state)
        return state

    def list_daily_bars(self, db: Session, symbol: str, limit: int = 400) -> list[PriceBar]:
        statement = (
            select(PriceBar)
            .where(PriceBar.symbol == symbol.upper())
            .order_by(desc(PriceBar.date))
            .limit(limit)
        )
        rows = list(db.scalars(statement))
        rows.reverse()
        return rows

    def upsert_bar_rows(self, db: Session, symbol: str, bars: list[dict[str, float | date]]) -> int:
        written = 0
        for row in bars:
            day = row["date"]
            existing = db.scalar(select(PriceBar).where(and_(PriceBar.symbol == symbol.upper(), PriceBar.date == day)))
            if existing is None:
                db.add(
                    PriceBar(
                        symbol=symbol.upper(),
                        date=day,
                        o=float(row["o"]),
                        h=float(row["h"]),
                        l=float(row["l"]),
                        c=float(row["c"]),
                        v=float(row["v"]),
                    )
                )
                written += 1
                continue

            changed = False
            for key in ("o", "h", "l", "c", "v"):
                value = float(row[key])
                if getattr(existing, key) != value:
                    setattr(existing, key, value)
                    changed = True
            if changed:
                written += 1
        return written

    def list_comments(self, db: Session, symbol: str, *, user_id: int = 1) -> list[StockComment]:
        statement = (
            select(StockComment)
            .where(and_(StockComment.user_id == user_id, StockComment.symbol == symbol.upper()))
            .order_by(desc(StockComment.created_at))
        )
        return list(db.scalars(statement))

    def add_comment(self, db: Session, symbol: str, body: str, *, user_id: int = 1) -> StockComment:
        comment = StockComment(user_id=user_id, symbol=symbol.upper(), body=body)
        db.add(comment)
        db.flush()
        db.refresh(comment)
        return comment

    def update_comment(self, db: Session, comment_id: int, body: str, *, user_id: int = 1) -> StockComment | None:
        comment = db.get(StockComment, comment_id)
        if comment is None or comment.user_id != user_id:
            return None
        comment.body = body
        db.add(comment)
        return comment

    def delete_comment(self, db: Session, comment_id: int, *, user_id: int = 1) -> bool:
        comment = db.get(StockComment, comment_id)
        if comment is None or comment.user_id != user_id:
            return False
        db.delete(comment)
        return True

    def set_group_order(self, db: Session, industry: str, symbols: list[str], *, user_id: int = 1) -> None:
        cleaned = [symbol.upper() for symbol in symbols]
        existing_states = {state.symbol: state for state in self.list_states(db, user_id=user_id)}

        for idx, symbol in enumerate(cleaned):
            state = existing_states.get(symbol)
            if state is None:
                state = StockState(user_id=user_id, symbol=symbol)
                db.add(state)
            state.order_index = idx
            db.add(state)

    def clear_comments_for_symbol(self, db: Session, symbol: str, *, user_id: int = 1) -> int:
        result = db.execute(delete(StockComment).where(and_(StockComment.user_id == user_id, StockComment.symbol == symbol.upper())))
        return result.rowcount or 0
