from __future__ import annotations

import csv
import io
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import JournalTrade, PriceBar
from app.services.charges import zerodha_charges


def _last_close(db: Session, symbol: str) -> float | None:
    return db.scalar(
        select(PriceBar.close)
        .where(PriceBar.symbol == symbol.upper())
        .order_by(PriceBar.date.desc())
        .limit(1)
    )


def trade_to_dict(db: Session, t: JournalTrade) -> dict:
    close = _last_close(db, t.symbol) if t.sell_price is None else None
    ch = zerodha_charges(
        segment=t.segment,
        qty=t.qty,
        buy=t.buy_price,
        sell=t.sell_price,
        last_close=float(close) if close is not None else None,
    )
    return {
        "id": t.id,
        "symbol": t.symbol,
        "segment": t.segment,
        "qty": t.qty,
        "buy_price": t.buy_price,
        "sell_price": t.sell_price,
        "entry_date": t.entry_date.isoformat(),
        "exit_date": t.exit_date.isoformat() if t.exit_date else None,
        "note": t.note,
        "tags": t.tags or [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "charges": {
            "brokerage": ch.brokerage,
            "stt": ch.stt,
            "txn": ch.txn,
            "sebi": ch.sebi,
            "stamp": ch.stamp,
            "gst": ch.gst,
            "dp": ch.dp,
            "total": ch.total,
            "gross": ch.gross,
            "net": ch.net,
            "unrealized": ch.unrealized,
        },
    }


def list_trades(
    db: Session,
    *,
    open_only: bool = False,
    symbol: str | None = None,
    tag: str | None = None,
) -> list[dict]:
    stmt = select(JournalTrade).where(JournalTrade.user_id == settings.default_user_id)
    if open_only:
        stmt = stmt.where(JournalTrade.sell_price.is_(None))
    if symbol:
        stmt = stmt.where(JournalTrade.symbol == symbol.upper())
    rows = list(db.scalars(stmt.order_by(JournalTrade.entry_date.desc())).all())
    out = [trade_to_dict(db, t) for t in rows]
    if tag:
        out = [t for t in out if tag in (t.get("tags") or [])]
    return out


def create_trade(db: Session, data: dict) -> JournalTrade:
    t = JournalTrade(
        user_id=settings.default_user_id,
        symbol=data["symbol"].upper(),
        segment=data["segment"],
        qty=int(data["qty"]),
        buy_price=float(data["buy_price"]),
        sell_price=float(data["sell_price"]) if data.get("sell_price") is not None else None,
        entry_date=date.fromisoformat(data["entry_date"]),
        exit_date=date.fromisoformat(data["exit_date"]) if data.get("exit_date") else None,
        note=data.get("note") or "",
        tags=data.get("tags") or [],
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update_trade(db: Session, trade_id: int, data: dict) -> JournalTrade | None:
    t = db.get(JournalTrade, trade_id)
    if not t or t.user_id != settings.default_user_id:
        return None
    for key in ("segment", "qty", "buy_price", "sell_price", "note", "tags"):
        if key in data and data[key] is not None:
            setattr(t, key if key != "buy_price" else "buy_price", data[key])
    if "symbol" in data and data["symbol"]:
        t.symbol = data["symbol"].upper()
    if "entry_date" in data and data["entry_date"]:
        t.entry_date = date.fromisoformat(data["entry_date"])
    if "exit_date" in data:
        t.exit_date = date.fromisoformat(data["exit_date"]) if data["exit_date"] else None
    if "qty" in data:
        t.qty = int(data["qty"])
    if "buy_price" in data:
        t.buy_price = float(data["buy_price"])
    if "sell_price" in data:
        t.sell_price = float(data["sell_price"]) if data["sell_price"] is not None else None
    db.commit()
    db.refresh(t)
    return t


def delete_trade(db: Session, trade_id: int) -> bool:
    t = db.get(JournalTrade, trade_id)
    if not t or t.user_id != settings.default_user_id:
        return False
    db.delete(t)
    db.commit()
    return True


def analytics(db: Session) -> dict:
    trades = list_trades(db)
    closed = [t for t in trades if t["sell_price"] is not None]
    equity = []
    running = 0.0
    for t in sorted(closed, key=lambda x: x["exit_date"] or x["entry_date"]):
        running += t["charges"]["net"]
        equity.append({"date": t["exit_date"] or t["entry_date"], "equity": round(running, 2)})
    by_segment: dict[str, float] = {}
    by_symbol: dict[str, float] = {}
    for t in closed:
        by_segment[t["segment"]] = by_segment.get(t["segment"], 0.0) + t["charges"]["net"]
        by_symbol[t["symbol"]] = by_symbol.get(t["symbol"], 0.0) + t["charges"]["net"]
    return {
        "equity_curve": equity,
        "by_segment": by_segment,
        "by_symbol": by_symbol,
        "open_count": sum(1 for t in trades if t["sell_price"] is None),
        "closed_count": len(closed),
    }


def export_csv(db: Session) -> str:
    trades = list_trades(db)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        ["entryDate", "exitDate", "symbol", "segment", "qty", "buy", "sell", "tags", "note"]
    )
    for t in trades:
        w.writerow(
            [
                t["entry_date"],
                t["exit_date"] or "",
                t["symbol"],
                t["segment"],
                t["qty"],
                t["buy_price"],
                t["sell_price"] if t["sell_price"] is not None else "",
                "|".join(t["tags"] or []),
                t["note"],
            ]
        )
    return buf.getvalue()


def import_csv(db: Session, content: str) -> int:
    reader = csv.DictReader(io.StringIO(content))
    n = 0
    for row in reader:
        sell = row.get("sell") or row.get("sell_price") or ""
        create_trade(
            db,
            {
                "symbol": row.get("symbol") or "",
                "segment": row.get("segment") or "Delivery",
                "qty": int(row.get("qty") or 0),
                "buy_price": float(row.get("buy") or row.get("buy_price") or 0),
                "sell_price": float(sell) if sell not in ("", None) else None,
                "entry_date": row.get("entryDate") or row.get("entry_date"),
                "exit_date": (row.get("exitDate") or row.get("exit_date") or None) or None,
                "tags": [t for t in (row.get("tags") or "").split("|") if t],
                "note": row.get("note") or "",
            },
        )
        n += 1
    return n
