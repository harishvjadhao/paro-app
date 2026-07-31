from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChartHighlight

# Reuse color for same label
_PALETTE = ["#3C2CDA", "#E11D48", "#059669", "#D97706", "#7C3AED", "#0891B2"]


def list_highlights(db: Session) -> list[ChartHighlight]:
    return list(db.scalars(select(ChartHighlight).order_by(ChartHighlight.date)).all())


def upsert_highlight(db: Session, d: date, label: str, color: str | None = None) -> ChartHighlight:
    existing_label = db.scalar(select(ChartHighlight).where(ChartHighlight.label == label).limit(1))
    if color is None:
        color = existing_label.color if existing_label else _PALETTE[hash(label) % len(_PALETTE)]
    elif existing_label and existing_label.color != color:
        # enforce same label ⇒ same color
        color = existing_label.color
        for h in db.scalars(select(ChartHighlight).where(ChartHighlight.label == label)).all():
            h.color = color

    row = ChartHighlight(date=d, label=label, color=color)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_highlight(db: Session, highlight_id: int) -> bool:
    h = db.get(ChartHighlight, highlight_id)
    if not h:
        return False
    db.delete(h)
    db.commit()
    return True
