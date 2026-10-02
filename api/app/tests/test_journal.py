from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.zerodha import DELIVERY_DP_CHARGE, zerodha_charges
from app.main import app
from app.models import Base
from app.models.journal import Trade
from app.models.stock_list import StockListColumn, StockMeta
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.models.workspace import StockComment, StockState

SAMPLE_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha One,Finance,AAA,EQ,INE000A00001
Beta Two,Finance,BBB,EQ,INE000B00002
"""


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(Trade).delete()
        db.query(StockListColumn).delete()
        db.query(StockMeta).delete()
        db.query(StockComment).delete()
        db.query(StockState).delete()
        db.query(SyncRunItem).delete()
        db.query(SyncRun).delete()
        db.query(PriceBar).delete()
        db.query(StockUniverse).delete()
        db.query(UniverseUpload).delete()
        db.commit()


def _seed_universe(client: TestClient) -> None:
    response = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )
    assert response.status_code == 200


def _seed_close(symbol: str, close: float) -> None:
    with SessionLocal() as db:
        db.add(
            PriceBar(
                symbol=symbol,
                date=date.today(),
                o=close - 1,
                h=close + 1,
                l=close - 2,
                c=close,
                v=1000,
            )
        )
        db.commit()


def test_zerodha_delivery_components() -> None:
    charges = zerodha_charges("Delivery", qty=10, buy=100, sell=110)
    assert charges.buy_val == 1000
    assert charges.sell_val == 1100
    assert charges.turnover == 2100
    assert charges.brokerage == 0
    assert charges.stt == pytest.approx(2.1)
    assert charges.txn == pytest.approx(2100 * 0.0000297)
    assert charges.sebi == pytest.approx(2100 * 0.000001)
    assert charges.stamp == pytest.approx(0.15)
    assert charges.dp == DELIVERY_DP_CHARGE
    assert charges.gst == pytest.approx((charges.brokerage + charges.txn + charges.sebi) * 0.18)
    assert charges.gross == 100
    assert charges.total == pytest.approx(
        charges.brokerage + charges.stt + charges.txn + charges.sebi + charges.stamp + charges.gst + charges.dp
    )
    assert charges.net == pytest.approx(charges.gross - charges.total)


def test_zerodha_intraday_components() -> None:
    charges = zerodha_charges("Intraday", qty=10, buy=100, sell=110)
    assert charges.brokerage == pytest.approx(0.3 + 0.33)
    assert charges.stt == pytest.approx(0.275)
    assert charges.stamp == pytest.approx(0.03)
    assert charges.dp == 0
    assert charges.gross == 100
    assert charges.net == pytest.approx(charges.gross - charges.total)


def test_zerodha_open_trade_zero_charges() -> None:
    charges = zerodha_charges("Delivery", qty=5, buy=200, sell=None)
    assert charges.total == 0
    assert charges.net == 0


def test_journal_crud_positions_analytics_csv_roundtrip() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_close("AAA", 105.0)

    create = client.post(
        "/journal/trades",
        json={
            "symbol": "aaa",
            "segment": "Delivery",
            "qty": 10,
            "entry_price": 100,
            "entry_date": (date.today() - timedelta(days=5)).isoformat(),
            "exit_price": 110,
            "exit_date": (date.today() - timedelta(days=1)).isoformat(),
            "tags": ["swing", "breakout"],
            "notes": "first trade",
        },
    )
    assert create.status_code == 200, create.text
    closed = create.json()
    assert closed["symbol"] == "AAA"
    assert closed["is_open"] is False
    assert closed["charges"]["dp"] == DELIVERY_DP_CHARGE
    assert closed["charges"]["net"] == pytest.approx(zerodha_charges("Delivery", 10, 100, 110).net)

    open_trade = client.post(
        "/journal/trades",
        json={
            "symbol": "BBB",
            "segment": "Intraday",
            "qty": 5,
            "entry_price": 50,
            "entry_date": date.today().isoformat(),
            "tags": ["scalp"],
            "notes": "open",
        },
    )
    assert open_trade.status_code == 200
    open_body = open_trade.json()
    assert open_body["is_open"] is True
    assert open_body["charges"]["total"] == 0

    _seed_close("BBB", 55.0)
    positions = client.get("/journal/positions")
    assert positions.status_code == 200
    pos = positions.json()
    assert pos["items"][0]["symbol"] == "BBB"
    assert pos["items"][0]["unrealized"] == pytest.approx(25.0)
    assert pos["total_unrealized"] == pytest.approx(25.0)

    analytics = client.get("/journal/analytics")
    assert analytics.status_code == 200
    analytics_body = analytics.json()
    assert analytics_body["closed_count"] == 1
    assert len(analytics_body["equity_curve"]) == 1
    assert analytics_body["by_segment"][0]["segment"] == "Delivery"

    listed = client.get("/journal/trades", params={"q": "AAA"})
    assert listed.status_code == 200
    assert listed.json()["summary"]["trade_count"] == 1

    export = client.get("/journal/export")
    assert export.status_code == 200
    assert "entryDate,exitDate,symbol" in export.text
    assert "AAA" in export.text

    with SessionLocal() as db:
        db.query(Trade).delete()
        db.commit()

    imported = client.post(
        "/journal/import",
        files={"file": ("paro-journal.csv", export.text.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["imported"] >= 1

    preview = client.post(
        "/journal/charges/preview",
        json={"segment": "Delivery", "qty": 10, "entry_price": 100, "exit_price": 110},
    )
    assert preview.status_code == 200
    assert preview.json()["dp"] == DELIVERY_DP_CHARGE

    trade_id = client.get("/journal/trades").json()["items"][0]["id"]
    patched = client.patch(f"/journal/trades/{trade_id}", json={"notes": "updated"})
    assert patched.status_code == 200
    assert patched.json()["notes"] == "updated"

    deleted = client.delete(f"/journal/trades/{trade_id}")
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True
