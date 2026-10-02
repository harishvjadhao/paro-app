from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.highlights import HIGHLIGHT_PALETTE, color_for_label
from app.main import app
from app.models import Base
from app.models.highlights import ChartHighlight
from app.models.journal import Trade
from app.models.stock_list import StockListColumn, StockMeta
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.models.workspace import StockComment, StockState

SAMPLE_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha One,Finance,AAA,EQ,INE000A00001
"""


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(ChartHighlight).delete()
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


def _seed_bars(symbol: str, *, days: int = 60) -> date:
    with SessionLocal() as db:
        end = date.today()
        start = end - timedelta(days=days - 1)
        for index in range(days):
            close = 100 + index * 0.5
            db.add(
                PriceBar(
                    symbol=symbol,
                    date=start + timedelta(days=index),
                    o=close - 0.2,
                    h=close + 0.4,
                    l=close - 0.5,
                    c=close,
                    v=1000 + index,
                )
            )
        db.commit()
        return end


def test_color_for_label_reuses_existing() -> None:
    existing = [("Results Day", HIGHLIGHT_PALETTE[0]), ("Breakout", HIGHLIGHT_PALETTE[1])]
    assert color_for_label("results day", existing) == HIGHLIGHT_PALETTE[0]
    assert color_for_label("Review", existing) == HIGHLIGHT_PALETTE[2]


def test_highlights_crud_and_candle_markers() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    end = _seed_bars("AAA")
    target = end - timedelta(days=3)

    created = client.post(
        "/highlights",
        json={"label": "Results Day", "date_from": target.isoformat()},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["color"] == HIGHLIGHT_PALETTE[0]
    assert body["date_to"] == target.isoformat()
    assert body["reused_color"] is False
    highlight_id = body["id"]

    reused = client.post(
        "/highlights",
        json={"label": "results day", "date_from": (target - timedelta(days=5)).isoformat()},
    )
    assert reused.status_code == 200
    assert reused.json()["color"] == HIGHLIGHT_PALETTE[0]
    assert reused.json()["reused_color"] is True

    listed = client.get("/highlights")
    assert listed.status_code == 200
    assert len(listed.json()) >= 2

    candles = client.get("/stocks/AAA/candles", params={"timeframe": "D", "bars": 44, "indicators": "ma44"})
    assert candles.status_code == 200
    markers = candles.json()["markers"]
    highlight_markers = [marker for marker in markers if marker["kind"] == "highlight"]
    assert any(marker["date"] == target.isoformat() and marker["label"] == "Results Day" for marker in highlight_markers)

    deleted = client.delete(f"/highlights/{highlight_id}")
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True
