from __future__ import annotations

from datetime import date

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session

from app.models.highlights import ChartHighlight


class HighlightsRepository:
    def list_all(self, db: Session) -> list[ChartHighlight]:
        statement = select(ChartHighlight).order_by(desc(ChartHighlight.date_from), desc(ChartHighlight.id))
        return list(db.scalars(statement))

    def list_for_symbol_window(
        self,
        db: Session,
        *,
        symbol: str,
        window_start: date,
        window_end: date,
    ) -> list[ChartHighlight]:
        sym = symbol.upper()
        statement = (
            select(ChartHighlight)
            .where(
                and_(
                    ChartHighlight.date_from <= window_end,
                    ChartHighlight.date_to >= window_start,
                    or_(ChartHighlight.symbol.is_(None), ChartHighlight.symbol == "", ChartHighlight.symbol == sym),
                )
            )
            .order_by(ChartHighlight.date_from.asc(), ChartHighlight.id.asc())
        )
        return list(db.scalars(statement))

    def get(self, db: Session, highlight_id: int) -> ChartHighlight | None:
        return db.get(ChartHighlight, highlight_id)

    def create(self, db: Session, row: ChartHighlight) -> ChartHighlight:
        db.add(row)
        db.flush()
        db.refresh(row)
        return row

    def delete(self, db: Session, row: ChartHighlight) -> None:
        db.delete(row)

    def label_color_pairs(self, db: Session) -> list[tuple[str, str]]:
        rows = self.list_all(db)
        return [(row.label, row.color) for row in rows]
