from __future__ import annotations

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.main import app
from app.models import Base
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.models.workspace import StockComment, StockState

SAMPLE_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha One,Finance,AAA,EQ,INE000A00001
Beta Two,Finance,BBB,EQ,INE000B00002
Gamma Three,IT,CCC,EQ,INE000C00003
"""


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
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


def test_workspace_list_detail_and_candles() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)

    rows = client.get("/stocks", params={"filter": "all", "q": ""})
    assert rows.status_code == 200
    payload = rows.json()
    assert len(payload) >= 3
    assert payload[0]["symbol"]

    detail = client.get(f"/stocks/{payload[0]['symbol']}")
    assert detail.status_code == 200
    assert detail.json()["company"]

    candles = client.get(f"/stocks/{payload[0]['symbol']}/candles", params={"timeframe": "D", "bars": 44, "indicators": "ma44,bb,rsi"})
    assert candles.status_code == 200
    candle_payload = candles.json()
    assert len(candle_payload["bars"]) <= 44
    assert "markers" in candle_payload
    assert isinstance(candle_payload["markers"], list)

    comment = client.post(f"/stocks/{payload[0]['symbol']}/comments", json={"body": "Chart marker note"})
    assert comment.status_code == 200
    marked = client.get(f"/stocks/{payload[0]['symbol']}/candles", params={"timeframe": "D", "bars": 44, "indicators": "ma44"})
    assert marked.status_code == 200
    assert any(item["kind"] == "comment" for item in marked.json()["markers"])
    weekly = client.get(f"/stocks/{payload[0]['symbol']}/candles", params={"timeframe": "W", "bars": 44, "indicators": "ma44"})
    assert weekly.status_code == 200
    assert weekly.json()["markers"] == []


def test_workspace_toggle_and_comments() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)

    fav = client.post("/stocks/AAA/favorite")
    assert fav.status_code == 200
    assert fav.json()["is_favorite"] is True

    watch = client.post("/stocks/AAA/watch")
    assert watch.status_code == 200
    assert watch.json()["is_watchlist"] is True

    created = client.post("/stocks/AAA/comments", json={"body": "Breakout setup near MA44"})
    assert created.status_code == 200
    comment_id = created.json()["id"]

    updated = client.patch(f"/stocks/AAA/comments/{comment_id}", json={"body": "Breakout confirmed"})
    assert updated.status_code == 200
    assert "confirmed" in updated.json()["body"]

    detail = client.get("/stocks/AAA")
    assert detail.status_code == 200
    assert len(detail.json()["comments"]) == 1

    deleted = client.delete(f"/stocks/AAA/comments/{comment_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
