from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.universe import StockUniverse, UniverseUpload


class UniverseRepository:
    def list_universe(self, db: Session) -> list[StockUniverse]:
        statement = select(StockUniverse).order_by(StockUniverse.symbol.asc())
        return list(db.scalars(statement))

    def get_symbols_set(self, db: Session) -> set[str]:
        statement = select(StockUniverse.symbol)
        return set(db.scalars(statement))

    def clear_universe(self, db: Session) -> int:
        result = db.execute(delete(StockUniverse))
        return result.rowcount or 0

    def add_many(self, db: Session, rows: list[dict[str, object]]) -> None:
        if not rows:
            return
        db.bulk_insert_mappings(StockUniverse, rows)

    def create_upload_record(
        self,
        db: Session,
        filename: str,
        total: int,
        dup: int,
        invalid: int,
        mode: str,
    ) -> UniverseUpload:
        record = UniverseUpload(
            filename=filename,
            total=total,
            dup=dup,
            invalid=invalid,
            mode=mode,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    def delete_all_upload_records(self, db: Session) -> None:
        db.execute(delete(UniverseUpload))

