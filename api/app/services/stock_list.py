from __future__ import annotations

import json
import re
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.indicators import above_ma, aggregate, sma
from app.domain.stock_list import SCREEN_OPTIONS, derive_screen, suggest_subcategory
from app.repositories.stock_list import StockListRepository
from app.schemas.stock_list import (
    ColumnCreateRequest,
    ColumnReorderRequest,
    ColumnUpdateRequest,
    ListPatchRequest,
    MaState,
    StockListColumnResponse,
    StockListResponse,
    StockListRow,
)

BUILTIN_COLUMNS: list[dict[str, object]] = [
    {"key": "symbol", "label": "Symbol", "type": "text", "builtin": True},
    {"key": "company", "label": "Company Name", "type": "text", "builtin": True},
    {"key": "industry", "label": "Industry", "type": "choice", "builtin": True},
    {"key": "subcategory", "label": "Subcategory", "type": "text", "builtin": True},
    {"key": "notes", "label": "Notes", "type": "text", "builtin": True},
    {"key": "ma_d", "label": "20 MA (D)", "type": "signal20", "builtin": True},
    {"key": "ma_w", "label": "20 MA (W)", "type": "signal20", "builtin": True},
    {"key": "ma_m", "label": "20 MA (M)", "type": "signal20", "builtin": True},
    {"key": "screen", "label": "Screen", "type": "choice", "builtin": True},
]

EDITABLE_FIELDS = {
    "subcategory",
    "notes",
    "screen",
    "ma_d_override",
    "ma_w_override",
    "ma_m_override",
}


class StockListService:
    def __init__(self, repo: StockListRepository | None = None) -> None:
        self.repo = repo or StockListRepository()

    def get_list(self, db: Session) -> StockListResponse:
        universe = self.repo.list_universe(db)
        meta_map = self.repo.list_meta(db)
        month_label = self._month_label()
        rows: list[StockListRow] = []

        for stock in universe:
            meta = meta_map.get(stock.symbol)
            bars = self.repo.list_daily_bars(db, stock.symbol, limit=500)
            daily_rows = [
                {
                    "date": item.date.isoformat(),
                    "o": float(item.o),
                    "h": float(item.h),
                    "l": float(item.l),
                    "c": float(item.c),
                    "v": float(item.v),
                }
                for item in bars
            ]

            ma_d = self._ma_state(daily_rows, "D", meta.ma_d_override if meta else None)
            ma_w = self._ma_state(daily_rows, "W", meta.ma_w_override if meta else None)
            ma_m = self._ma_state(daily_rows, "M", meta.ma_m_override if meta else None)

            auto_screen = derive_screen(above_d=ma_d.above, above_w=ma_w.above, above_m=ma_m.above)
            screen_overridden = bool(meta and meta.screen)
            screen = meta.screen if screen_overridden and meta and meta.screen in SCREEN_OPTIONS else auto_screen

            subcategory = meta.subcategory if meta and meta.subcategory else suggest_subcategory(stock.industry, stock.symbol)
            notes = meta.notes if meta else ""
            custom = self.repo.read_custom_values(meta)

            rows.append(
                StockListRow(
                    symbol=stock.symbol,
                    company=stock.company,
                    industry=stock.industry,
                    subcategory=subcategory,
                    notes=notes,
                    screen=screen,  # type: ignore[arg-type]
                    screen_auto=auto_screen,
                    screen_overridden=screen_overridden,
                    ma_d=ma_d,
                    ma_w=ma_w,
                    ma_m=ma_m,
                    ma_m_label=month_label,
                    custom=custom,
                )
            )

        return StockListResponse(
            rows=rows,
            columns=self.list_columns(db, month_label=month_label),
            screen_options=list(SCREEN_OPTIONS),
        )

    def patch_row(self, db: Session, symbol: str, payload: ListPatchRequest) -> StockListRow:
        stock = self.repo.get_universe_symbol(db, symbol)
        if stock is None:
            raise HTTPException(status_code=404, detail="Stock not found in universe")

        meta = self.repo.get_or_create_meta(db, symbol)
        field = payload.field.strip()

        if field in EDITABLE_FIELDS:
            self._apply_builtin_field(meta, field, payload.value)
        elif field.startswith("custom:"):
            key = field.split(":", 1)[1]
            column = self.repo.get_column_by_key(db, key)
            if column is None:
                raise HTTPException(status_code=404, detail="Custom column not found")
            values = self.repo.read_custom_values(meta)
            if payload.value is None:
                values.pop(key, None)
            else:
                values[key] = payload.value
            self.repo.write_custom_values(meta, values)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported field: {field}")

        db.add(meta)
        db.commit()
        refreshed = self.get_list(db)
        for row in refreshed.rows:
            if row.symbol == symbol.upper():
                return row
        raise HTTPException(status_code=404, detail="Updated row not found")

    def list_columns(self, db: Session, *, month_label: str | None = None) -> list[StockListColumnResponse]:
        label = month_label or self._month_label()
        custom = self.repo.list_columns(db)
        industries = sorted({stock.industry for stock in self.repo.list_universe(db)})

        builtin: list[StockListColumnResponse] = []
        for index, item in enumerate(BUILTIN_COLUMNS):
            key = str(item["key"])
            column_label = str(item["label"])
            if key == "ma_m":
                column_label = f"20 MA ({label} M)"
            options: list[str] = []
            if key == "industry":
                options = industries
            if key == "screen":
                options = list(SCREEN_OPTIONS)
            builtin.append(
                StockListColumnResponse(
                    id=-(index + 1),
                    key=key,
                    label=column_label,
                    type=str(item["type"]),  # type: ignore[arg-type]
                    options=options,
                    position=index,
                    hidden=False,
                    builtin=True,
                )
            )

        custom_payload = [
            StockListColumnResponse(
                id=column.id,
                key=column.key,
                label=column.label,
                type=column.type,  # type: ignore[arg-type]
                options=self._parse_options(column.options_json),
                position=column.position + len(BUILTIN_COLUMNS),
                hidden=bool(column.hidden),
                builtin=False,
            )
            for column in custom
        ]
        return builtin + custom_payload

    def create_column(self, db: Session, payload: ColumnCreateRequest) -> StockListColumnResponse:
        label = payload.label.strip()
        if not label:
            raise HTTPException(status_code=400, detail="Column label is required")

        key = self._slug_key(label)
        existing = self.repo.get_column_by_key(db, key)
        if existing is not None or any(item["key"] == key for item in BUILTIN_COLUMNS):
            key = f"{key}_{len(self.repo.list_columns(db)) + 1}"

        position = len(self.repo.list_columns(db))
        options = payload.options if payload.type == "choice" else []
        column = self.repo.add_column(
            db,
            key=key,
            label=label,
            type_name=payload.type,
            options_json=json.dumps(options),
            position=position,
        )
        db.commit()
        db.refresh(column)
        return StockListColumnResponse(
            id=column.id,
            key=column.key,
            label=column.label,
            type=column.type,  # type: ignore[arg-type]
            options=options,
            position=column.position + len(BUILTIN_COLUMNS),
            hidden=False,
            builtin=False,
        )

    def update_column(self, db: Session, column_id: int, payload: ColumnUpdateRequest) -> StockListColumnResponse:
        column = self.repo.get_column(db, column_id)
        if column is None:
            raise HTTPException(status_code=404, detail="Column not found")

        if payload.label is not None:
            cleaned = payload.label.strip()
            if not cleaned:
                raise HTTPException(status_code=400, detail="Column label is required")
            column.label = cleaned
        if payload.type is not None:
            column.type = payload.type
        if payload.options is not None:
            column.options_json = json.dumps(payload.options)
        if payload.position is not None:
            column.position = payload.position
        if payload.hidden is not None:
            column.hidden = 1 if payload.hidden else 0

        db.add(column)
        db.commit()
        db.refresh(column)
        return StockListColumnResponse(
            id=column.id,
            key=column.key,
            label=column.label,
            type=column.type,  # type: ignore[arg-type]
            options=self._parse_options(column.options_json),
            position=column.position + len(BUILTIN_COLUMNS),
            hidden=bool(column.hidden),
            builtin=False,
        )

    def delete_column(self, db: Session, column_id: int) -> dict[str, bool]:
        column = self.repo.get_column(db, column_id)
        if column is None:
            raise HTTPException(status_code=404, detail="Column not found")
        self.repo.delete_column(db, column)
        db.commit()
        return {"deleted": True}

    def reorder_columns(self, db: Session, payload: ColumnReorderRequest) -> list[StockListColumnResponse]:
        custom = {column.key: column for column in self.repo.list_columns(db)}
        custom_keys = [key for key in payload.keys if key in custom]
        for index, key in enumerate(custom_keys):
            column = custom[key]
            column.position = index
            db.add(column)
        db.commit()
        return self.list_columns(db)

    def _apply_builtin_field(self, meta, field: str, value: object) -> None:
        if field == "subcategory":
            meta.subcategory = "" if value is None else str(value)
            return
        if field == "notes":
            meta.notes = "" if value is None else str(value)
            return
        if field == "screen":
            if value is None or value == "":
                meta.screen = None
                return
            text = str(value)
            if text not in SCREEN_OPTIONS:
                raise HTTPException(status_code=400, detail="Invalid screen value")
            meta.screen = text
            return
        if field in {"ma_d_override", "ma_w_override", "ma_m_override"}:
            if value is None:
                setattr(meta, field, None)
                return
            if isinstance(value, bool):
                setattr(meta, field, 1 if value else 0)
                return
            if isinstance(value, str) and value.lower() in {"above", "below", "true", "false", "1", "0"}:
                setattr(meta, field, 1 if value.lower() in {"above", "true", "1"} else 0)
                return
            raise HTTPException(status_code=400, detail="MA override must be boolean or null")
        raise HTTPException(status_code=400, detail=f"Unsupported field: {field}")

    def _ma_state(self, daily_rows: list[dict[str, float | str]], timeframe: str, override: int | None) -> MaState:
        tf_rows = aggregate(daily_rows, timeframe) if timeframe in {"W", "M"} else daily_rows
        closes = [float(item["c"]) for item in tf_rows]
        ma_values = sma(closes, 20)
        close = closes[-1] if closes else None
        ma20 = ma_values[-1] if ma_values else None
        computed = above_ma(close or 0.0, ma20) if close is not None else False
        if override is None:
            return MaState(above=computed, overridden=False, ma20=round(ma20, 2) if ma20 is not None else None, close=round(close, 2) if close is not None else None)
        return MaState(
            above=bool(override),
            overridden=True,
            ma20=round(ma20, 2) if ma20 is not None else None,
            close=round(close, 2) if close is not None else None,
        )

    @staticmethod
    def _month_label() -> str:
        now = datetime.now()
        return f"{now.strftime('%b')} '{now.strftime('%y')}"

    @staticmethod
    def _parse_options(raw: str) -> list[str]:
        try:
            payload = json.loads(raw or "[]")
        except json.JSONDecodeError:
            return []
        if not isinstance(payload, list):
            return []
        return [str(item) for item in payload]

    @staticmethod
    def _slug_key(label: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", label.strip().lower()).strip("_")
        return f"c_{slug or 'col'}"
