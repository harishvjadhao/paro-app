from __future__ import annotations

from dataclasses import asdict

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.universe import UniverseRepository
from app.schemas.universe import UniverseStatusResponse, UniverseUploadResponse
from app.services.universe_csv import ParsedUniverseRow, parse_universe_csv


class UniverseService:
    def __init__(self, repository: UniverseRepository | None = None) -> None:
        self.repository = repository or UniverseRepository()

    def list_universe(self, db: Session):
        return self.repository.list_universe(db)

    def get_status(self, db: Session) -> UniverseStatusResponse:
        rows = self.repository.list_universe(db)
        latest = self.repository.latest_upload(db)
        return UniverseStatusResponse(
            active_stocks=len(rows),
            last_upload_at=latest.created_at if latest else None,
        )

    def clear_universe(self, db: Session) -> int:
        deleted = self.repository.clear_universe(db)
        self.repository.delete_all_upload_records(db)
        db.commit()
        return deleted

    def upload_universe(
        self,
        db: Session,
        *,
        filename: str,
        mode: str,
        confirm: bool,
        content: bytes,
    ) -> UniverseUploadResponse:
        if mode not in {"append", "replace"}:
            raise HTTPException(status_code=400, detail="Invalid mode. Use append or replace.")

        if mode == "replace" and not confirm:
            raise HTTPException(
                status_code=400,
                detail="Replace is destructive. Please confirm=true to continue.",
            )

        try:
            parsed = parse_universe_csv(content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        rows_by_symbol: dict[str, ParsedUniverseRow] = {}
        duplicate_in_file = 0
        for row in parsed.rows:
            if row.symbol in rows_by_symbol:
                duplicate_in_file += 1
                continue
            rows_by_symbol[row.symbol] = row

        existing_symbols = set() if mode == "replace" else self.repository.get_symbols_set(db)

        if mode == "replace":
            self.repository.clear_universe(db)

        insert_rows: list[dict[str, object]] = []
        duplicate_existing = 0
        for row in rows_by_symbol.values():
            if row.symbol in existing_symbols:
                duplicate_existing += 1
                continue
            insert_rows.append(asdict(row) | {"active": True})

        self.repository.add_many(db, insert_rows)
        upload = self.repository.create_upload_record(
            db,
            filename=filename,
            total=parsed.total,
            dup=duplicate_in_file + duplicate_existing,
            invalid=parsed.invalid,
            mode=mode,
        )
        db.commit()

        preview = [asdict(row) for row in list(rows_by_symbol.values())[:4]]
        return UniverseUploadResponse(
            total=upload.total,
            dup=upload.dup,
            invalid=upload.invalid,
            mode=mode,
            preview=preview,
            created_at=upload.created_at,
        )
