from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.highlights import color_for_label
from app.models.highlights import ChartHighlight
from app.repositories.highlights import HighlightsRepository
from app.schemas.highlights import HighlightCreateRequest, HighlightResponse, HighlightUpdateRequest


class HighlightsService:
    def __init__(self, repo: HighlightsRepository | None = None) -> None:
        self.repo = repo or HighlightsRepository()

    def list_highlights(self, db: Session) -> list[HighlightResponse]:
        return [self._to_response(row) for row in self.repo.list_all(db)]

    def create_highlight(self, db: Session, payload: HighlightCreateRequest) -> HighlightResponse:
        label = payload.label.strip() or "Highlight"
        date_from = payload.date_from
        date_to = payload.date_to or payload.date_from
        if date_to < date_from:
            raise HTTPException(status_code=400, detail="date_to must be on or after date_from")

        symbol = payload.symbol.strip().upper() if payload.symbol and payload.symbol.strip() else None
        pairs = self.repo.label_color_pairs(db)
        reused = any(existing.lower() == label.lower() for existing, _color in pairs)
        color = (payload.color or "").strip() or color_for_label(label, pairs)

        row = ChartHighlight(
            label=label,
            color=color,
            symbol=symbol,
            date_from=date_from,
            date_to=date_to,
        )
        self.repo.create(db, row)
        db.commit()
        db.refresh(row)
        return self._to_response(row, reused_color=reused)

    def update_highlight(self, db: Session, highlight_id: int, payload: HighlightUpdateRequest) -> HighlightResponse:
        row = self.repo.get(db, highlight_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Highlight not found")

        data = payload.model_dump(exclude_unset=True)
        clear_symbol = bool(data.pop("clear_symbol", False))
        if "label" in data and data["label"] is not None:
            row.label = str(data["label"]).strip() or row.label
        if "date_from" in data and data["date_from"] is not None:
            row.date_from = data["date_from"]
        if "date_to" in data and data["date_to"] is not None:
            row.date_to = data["date_to"]
        if clear_symbol:
            row.symbol = None
        elif "symbol" in data:
            value = data["symbol"]
            row.symbol = value.strip().upper() if isinstance(value, str) and value.strip() else None
        if "color" in data and data["color"]:
            row.color = str(data["color"]).strip()
        else:
            # keep label→color consistency when label changes
            pairs = [(item.label, item.color) for item in self.repo.list_all(db) if item.id != row.id]
            row.color = color_for_label(row.label, pairs)

        if row.date_to < row.date_from:
            raise HTTPException(status_code=400, detail="date_to must be on or after date_from")

        db.commit()
        db.refresh(row)
        return self._to_response(row)

    def delete_highlight(self, db: Session, highlight_id: int) -> dict[str, bool]:
        row = self.repo.get(db, highlight_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Highlight not found")
        self.repo.delete(db, row)
        db.commit()
        return {"ok": True}

    def _to_response(self, row: ChartHighlight, *, reused_color: bool = False) -> HighlightResponse:
        return HighlightResponse(
            id=row.id,
            label=row.label,
            color=row.color,
            symbol=row.symbol,
            date_from=row.date_from,
            date_to=row.date_to,
            reused_color=reused_color,
        )
