from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime
from statistics import fmean

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.domain.zerodha import unrealized_pnl, zerodha_charges
from app.models.journal import Trade
from app.repositories.journal import JournalRepository
from app.schemas.journal import (
    ChargeBreakdownResponse,
    ChargesPreviewRequest,
    EquityPoint,
    ImportResponse,
    JournalAnalyticsResponse,
    JournalSummary,
    PositionItem,
    PositionsResponse,
    SegmentStat,
    SymbolStat,
    TradeCreateRequest,
    TradeListResponse,
    TradeResponse,
    TradeUpdateRequest,
)


class JournalService:
    def __init__(self, repo: JournalRepository | None = None) -> None:
        self.repo = repo or JournalRepository()

    def list_trades(
        self,
        db: Session,
        *,
        q: str | None = None,
        segment: str | None = None,
        tag: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> TradeListResponse:
        rows = self.repo.list_trades(db, q=q, segment=segment, tag=tag, date_from=date_from, date_to=date_to)
        items = [self._to_response(db, row) for row in rows]
        return TradeListResponse(items=items, summary=self._summary(db, items))

    def create_trade(self, db: Session, payload: TradeCreateRequest) -> TradeResponse:
        trade = Trade(
            user_id=1,
            symbol=payload.symbol.strip().upper(),
            segment=payload.segment,
            side=payload.side,
            qty=float(payload.qty),
            entry_price=float(payload.entry_price),
            entry_date=payload.entry_date,
            exit_price=float(payload.exit_price) if payload.exit_price is not None else None,
            exit_date=payload.exit_date if payload.exit_price is not None else None,
            tags=self._dump_tags(payload.tags),
            notes=(payload.notes or "").strip(),
        )
        self._validate_trade(trade)
        self.repo.create_trade(db, trade)
        db.commit()
        db.refresh(trade)
        return self._to_response(db, trade)

    def update_trade(self, db: Session, trade_id: int, payload: TradeUpdateRequest) -> TradeResponse:
        trade = self.repo.get_trade(db, trade_id)
        if trade is None:
            raise HTTPException(status_code=404, detail="Trade not found")

        data = payload.model_dump(exclude_unset=True)
        clear_exit = bool(data.pop("clear_exit", False))
        if "symbol" in data and data["symbol"] is not None:
            trade.symbol = str(data["symbol"]).strip().upper()
        if "segment" in data and data["segment"] is not None:
            trade.segment = data["segment"]
        if "side" in data and data["side"] is not None:
            trade.side = data["side"]
        if "qty" in data and data["qty"] is not None:
            trade.qty = float(data["qty"])
        if "entry_price" in data and data["entry_price"] is not None:
            trade.entry_price = float(data["entry_price"])
        if "entry_date" in data and data["entry_date"] is not None:
            trade.entry_date = data["entry_date"]
        if "tags" in data and data["tags"] is not None:
            trade.tags = self._dump_tags(data["tags"])
        if "notes" in data and data["notes"] is not None:
            trade.notes = str(data["notes"]).strip()

        if clear_exit:
            trade.exit_price = None
            trade.exit_date = None
        else:
            if "exit_price" in data:
                trade.exit_price = float(data["exit_price"]) if data["exit_price"] is not None else None
            if "exit_date" in data:
                trade.exit_date = data["exit_date"]
            if trade.exit_price is None:
                trade.exit_date = None

        self._validate_trade(trade)
        db.commit()
        db.refresh(trade)
        return self._to_response(db, trade)

    def delete_trade(self, db: Session, trade_id: int) -> dict[str, bool]:
        trade = self.repo.get_trade(db, trade_id)
        if trade is None:
            raise HTTPException(status_code=404, detail="Trade not found")
        self.repo.delete_trade(db, trade)
        db.commit()
        return {"ok": True}

    def preview_charges(self, payload: ChargesPreviewRequest) -> ChargeBreakdownResponse:
        charges = zerodha_charges(payload.segment, payload.qty, payload.entry_price, payload.exit_price)
        return ChargeBreakdownResponse(**charges.as_dict())

    def analytics(self, db: Session) -> JournalAnalyticsResponse:
        rows = self.repo.list_trades(db)
        closed = [row for row in rows if row.exit_price is not None]
        closed_sorted = sorted(
            closed,
            key=lambda row: (row.exit_date or row.entry_date, row.id),
        )

        nets: list[float] = []
        equity: list[EquityPoint] = []
        cumulative = 0.0
        by_seg: dict[str, dict[str, float]] = {}
        by_sym: dict[str, dict[str, float]] = {}

        for row in closed_sorted:
            charges = zerodha_charges(row.segment, row.qty, row.entry_price, row.exit_price)  # type: ignore[arg-type]
            nets.append(charges.net)
            cumulative += charges.net
            equity.append(
                EquityPoint(
                    date=row.exit_date or row.entry_date,
                    trade_id=row.id,
                    symbol=row.symbol,
                    net=charges.net,
                    cumulative=cumulative,
                )
            )
            seg = by_seg.setdefault(row.segment, {"count": 0, "net": 0.0, "charges": 0.0})
            seg["count"] += 1
            seg["net"] += charges.net
            seg["charges"] += charges.total
            sym = by_sym.setdefault(row.symbol, {"count": 0, "net": 0.0})
            sym["count"] += 1
            sym["net"] += charges.net

        wins = [value for value in nets if value > 0]
        losses = [value for value in nets if value < 0]
        avg_win = fmean(wins) if wins else None
        avg_loss = fmean(losses) if losses else None
        win_rate = (len(wins) / len(nets)) if nets else 0.0
        expectancy = (win_rate * (avg_win or 0.0)) + ((1 - win_rate) * (avg_loss or 0.0)) if nets else None

        return JournalAnalyticsResponse(
            closed_count=len(nets),
            avg_win=avg_win,
            avg_loss=avg_loss,
            expectancy=expectancy,
            largest_win=max(nets) if nets else None,
            largest_loss=min(nets) if nets else None,
            equity_curve=equity,
            by_segment=[
                SegmentStat(segment=name, count=int(stats["count"]), net=stats["net"], charges=stats["charges"])  # type: ignore[arg-type]
                for name, stats in sorted(by_seg.items())
            ],
            by_symbol=[
                SymbolStat(symbol=name, count=int(stats["count"]), net=stats["net"])
                for name, stats in sorted(by_sym.items(), key=lambda item: item[1]["net"], reverse=True)
            ],
        )

    def positions(self, db: Session) -> PositionsResponse:
        open_rows = self.repo.list_open(db)
        items: list[PositionItem] = []
        total = 0.0
        for row in open_rows:
            last_close = self.repo.latest_close(db, row.symbol)
            unrealized = unrealized_pnl(row.qty, row.entry_price, last_close)
            if unrealized is not None:
                total += unrealized
            items.append(
                PositionItem(
                    id=row.id,
                    symbol=row.symbol,
                    segment=row.segment,  # type: ignore[arg-type]
                    qty=row.qty,
                    entry_price=row.entry_price,
                    entry_date=row.entry_date,
                    tags=self._load_tags(row.tags),
                    notes=row.notes,
                    last_close=last_close,
                    unrealized=unrealized,
                )
            )
        return PositionsResponse(items=items, total_unrealized=total)

    def export_csv(self, db: Session) -> str:
        rows = self.repo.list_trades(db)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["entryDate", "exitDate", "symbol", "segment", "qty", "buy", "sell", "tags", "note"])
        for row in reversed(rows):
            writer.writerow(
                [
                    row.entry_date.isoformat(),
                    row.exit_date.isoformat() if row.exit_date else "",
                    row.symbol,
                    row.segment,
                    row.qty,
                    row.entry_price,
                    "" if row.exit_price is None else row.exit_price,
                    "|".join(self._load_tags(row.tags)),
                    row.notes,
                ]
            )
        return buffer.getvalue()

    async def import_csv(self, db: Session, file: UploadFile) -> ImportResponse:
        raw = (await file.read()).decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(raw))
        rows = [row for row in reader if any(cell.strip() for cell in row)]
        if not rows:
            raise HTTPException(status_code=400, detail="CSV is empty")

        head = [cell.strip().lower() for cell in rows[0]]

        def ix(*keys: str) -> int:
            for key in keys:
                for index, cell in enumerate(head):
                    if key in cell:
                        return index
            return -1

        i_entry = ix("entry", "date")
        i_exit = ix("exit")
        i_symbol = ix("symbol")
        i_segment = ix("segment")
        i_qty = ix("qty")
        i_buy = ix("buy", "entry_price")
        i_sell = ix("sell", "exit_price")
        i_tags = ix("tag")
        i_note = ix("note")

        imported = 0
        skipped = 0
        created: list[TradeResponse] = []
        today = date.today()

        for line in rows[1:]:
            def cell(index: int) -> str:
                if index < 0 or index >= len(line):
                    return ""
                return line[index].strip()

            symbol = cell(i_symbol).upper()
            qty_raw = cell(i_qty)
            buy_raw = cell(i_buy)
            if not symbol or not qty_raw or not buy_raw:
                skipped += 1
                continue
            try:
                qty = float(qty_raw)
                buy = float(buy_raw)
            except ValueError:
                skipped += 1
                continue
            if qty <= 0 or buy <= 0:
                skipped += 1
                continue

            sell_raw = cell(i_sell)
            sell = float(sell_raw) if sell_raw else None
            segment = "Intraday" if "intra" in cell(i_segment).lower() else "Delivery"
            entry_raw = cell(i_entry) or today.isoformat()
            exit_raw = cell(i_exit)
            tags = [part.strip() for part in cell(i_tags).split("|") if part.strip()]
            notes = cell(i_note)

            try:
                entry_date = date.fromisoformat(entry_raw[:10])
            except ValueError:
                entry_date = today
            exit_date = None
            if sell is not None:
                try:
                    exit_date = date.fromisoformat(exit_raw[:10]) if exit_raw else entry_date
                except ValueError:
                    exit_date = entry_date

            trade = Trade(
                user_id=1,
                symbol=symbol,
                segment=segment,
                side="long",
                qty=qty,
                entry_price=buy,
                entry_date=entry_date,
                exit_price=sell,
                exit_date=exit_date,
                tags=self._dump_tags(tags),
                notes=notes,
            )
            self.repo.create_trade(db, trade)
            created.append(self._to_response(db, trade))
            imported += 1

        db.commit()
        return ImportResponse(imported=imported, skipped=skipped, items=created)

    def _summary(self, db: Session, items: list[TradeResponse]) -> JournalSummary:
        closed = [item for item in items if not item.is_open]
        open_items = [item for item in items if item.is_open]
        realized = sum(item.charges.net for item in closed)
        charges = sum(item.charges.total for item in closed)
        unrealized = 0.0
        for item in open_items:
            if item.unrealized is not None:
                unrealized += item.unrealized
            else:
                # refresh from live close when list was filtered
                last = self.repo.latest_close(db, item.symbol)
                value = unrealized_pnl(item.qty, item.entry_price, last)
                if value is not None:
                    unrealized += value
        wins = [item for item in closed if item.charges.net > 0]
        win_rate = (len(wins) / len(closed) * 100.0) if closed else None
        return JournalSummary(
            trade_count=len(items),
            open_count=len(open_items),
            realized_net=realized,
            unrealized=unrealized,
            total_charges=charges,
            win_rate=win_rate,
        )

    def _to_response(self, db: Session, row: Trade) -> TradeResponse:
        is_open = row.exit_price is None
        charges = zerodha_charges(
            row.segment,  # type: ignore[arg-type]
            row.qty,
            row.entry_price,
            None if is_open else row.exit_price,
        )
        last_close = self.repo.latest_close(db, row.symbol) if is_open else None
        unrealized = unrealized_pnl(row.qty, row.entry_price, last_close) if is_open else None
        return TradeResponse(
            id=row.id,
            user_id=row.user_id,
            symbol=row.symbol,
            segment=row.segment,  # type: ignore[arg-type]
            side=row.side,  # type: ignore[arg-type]
            qty=row.qty,
            entry_price=row.entry_price,
            entry_date=row.entry_date,
            exit_price=row.exit_price,
            exit_date=row.exit_date,
            tags=self._load_tags(row.tags),
            notes=row.notes,
            created_at=row.created_at if isinstance(row.created_at, datetime) else datetime.utcnow(),
            is_open=is_open,
            charges=ChargeBreakdownResponse(**charges.as_dict()),
            last_close=last_close,
            unrealized=unrealized,
        )

    def _validate_trade(self, trade: Trade) -> None:
        if not trade.symbol:
            raise HTTPException(status_code=400, detail="Symbol is required")
        if trade.segment not in {"Delivery", "Intraday"}:
            raise HTTPException(status_code=400, detail="Segment must be Delivery or Intraday")
        if trade.qty <= 0 or trade.entry_price <= 0:
            raise HTTPException(status_code=400, detail="Quantity and entry price must be > 0")
        if trade.exit_price is not None and trade.exit_price <= 0:
            raise HTTPException(status_code=400, detail="Exit price must be > 0 when set")
        if trade.exit_price is not None and trade.exit_date is None:
            trade.exit_date = trade.entry_date
        if trade.exit_price is None:
            trade.exit_date = None

    @staticmethod
    def _dump_tags(tags: list[str]) -> str:
        cleaned = [tag.strip() for tag in tags if tag and tag.strip()]
        return json.dumps(cleaned)

    @staticmethod
    def _load_tags(raw: str) -> list[str]:
        try:
            parsed = json.loads(raw or "[]")
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except json.JSONDecodeError:
            pass
        return [part.strip() for part in (raw or "").split("|") if part.strip()]
