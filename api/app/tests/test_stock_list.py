from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.stock_list import derive_screen
from app.main import app
from app.models import Base
from app.models.stock_list import StockListColumn, StockMeta
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


def _seed_bars(symbol: str, *, days: int = 80, start: float = 100.0) -> None:
    with SessionLocal() as db:
        base = date.today() - timedelta(days=days)
        for index in range(days):
            close = start + index * 0.5
            db.add(
                PriceBar(
                    symbol=symbol,
                    date=base + timedelta(days=index),
                    o=close - 0.2,
                    h=close + 0.4,
                    l=close - 0.5,
                    c=close,
                    v=1000 + index,
                )
            )
        db.commit()


def test_derive_screen() -> None:
    assert derive_screen(above_d=True, above_w=True, above_m=True) == "Strong buy"
    assert derive_screen(above_d=True, above_w=True, above_m=False) == "Buy"
    assert derive_screen(above_d=True, above_w=False, above_m=False) == "Watch"
    assert derive_screen(above_d=False, above_w=False, above_m=False) == "Avoid"


def test_stock_list_rows_patch_and_columns() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_bars("AAA")
    _seed_bars("BBB", start=50.0)
    _seed_bars("CCC", start=20.0)

    listed = client.get("/list")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload["rows"]) == 3
    assert payload["rows"][0]["symbol"]
    assert "ma_d" in payload["rows"][0]
    assert "screen" in payload["rows"][0]
    assert any(col["key"] == "notes" for col in payload["columns"])

    patched = client.patch("/list/AAA", json={"field": "notes", "value": "Watching breakout"})
    assert patched.status_code == 200
    assert patched.json()["notes"] == "Watching breakout"

    override = client.patch("/list/AAA", json={"field": "ma_d_override", "value": False})
    assert override.status_code == 200
    assert override.json()["ma_d"]["above"] is False
    assert override.json()["ma_d"]["overridden"] is True

    cleared = client.patch("/list/AAA", json={"field": "ma_d_override", "value": None})
    assert cleared.status_code == 200
    assert cleared.json()["ma_d"]["overridden"] is False

    created = client.post("/list/columns", json={"label": "Thesis", "type": "text"})
    assert created.status_code == 200
    column_id = created.json()["id"]
    assert created.json()["key"].startswith("c_")

    custom = client.patch("/list/AAA", json={"field": f"custom:{created.json()['key']}", "value": "Core holding"})
    assert custom.status_code == 200
    assert custom.json()["custom"][created.json()["key"]] == "Core holding"

    hidden = client.patch(f"/list/columns/{column_id}", json={"hidden": True})
    assert hidden.status_code == 200
    assert hidden.json()["hidden"] is True

    deleted = client.delete(f"/list/columns/{column_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
