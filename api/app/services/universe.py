from __future__ import annotations

from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import StockUniverse, UniverseUpload
from app.services.universe_csv import UniverseParseResult, parse_universe_csv


def load_universe_from_bytes(
    db: Session,
    content: bytes,
    filename: str,
    *,
    replace: bool,
    uploaded_by: int | None = None,
) -> tuple[UniverseUpload, UniverseParseResult]:
    parsed = parse_universe_csv(content)
    upload = UniverseUpload(
        filename=filename,
        total=parsed.total,
        duplicates=parsed.duplicates,
        invalid=parsed.invalid,
        uploaded_by=uploaded_by or settings.default_user_id,
    )
    db.add(upload)
    db.flush()

    if replace and parsed.rows:
        db.execute(delete(StockUniverse))
        for row in parsed.rows:
            db.add(
                StockUniverse(
                    symbol=row.symbol,
                    company=row.company,
                    industry=row.industry,
                    series=row.series,
                    isin=row.isin,
                    yahoo_symbol=row.yahoo_symbol,
                    active=True,
                    uploaded_batch_id=upload.id,
                )
            )
    elif not replace and parsed.rows:
        existing = {
            s.symbol: s
            for s in db.scalars(select(StockUniverse)).all()
        }
        for row in parsed.rows:
            if row.symbol in existing:
                stock = existing[row.symbol]
                stock.company = row.company
                stock.industry = row.industry
                stock.series = row.series
                stock.isin = row.isin
                stock.yahoo_symbol = row.yahoo_symbol
                stock.active = True
                stock.uploaded_batch_id = upload.id
            else:
                db.add(
                    StockUniverse(
                        symbol=row.symbol,
                        company=row.company,
                        industry=row.industry,
                        series=row.series,
                        isin=row.isin,
                        yahoo_symbol=row.yahoo_symbol,
                        active=True,
                        uploaded_batch_id=upload.id,
                    )
                )

    db.commit()
    db.refresh(upload)
    return upload, parsed


def seed_from_csv_path(db: Session, path: Path, *, replace: bool = True) -> UniverseUpload:
    content = path.read_bytes()
    upload, _ = load_universe_from_bytes(db, content, path.name, replace=replace)
    return upload


def list_universe(db: Session, *, active_only: bool = True) -> list[StockUniverse]:
    stmt = select(StockUniverse).order_by(StockUniverse.industry, StockUniverse.symbol)
    if active_only:
        stmt = stmt.where(StockUniverse.active.is_(True))
    return list(db.scalars(stmt).all())
