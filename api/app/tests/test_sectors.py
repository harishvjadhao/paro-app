from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.sectors import breadth_pct, rotation_coordinates, weekly_breadth_series
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


def _seed_bars(symbol: str, *, days: int = 90, start: float = 100.0, step: float = 0.8) -> None:
    with SessionLocal() as db:
        base = date.today() - timedelta(days=days)
        for index in range(days):
            close = start + index * step
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


def test_sector_domain_math() -> None:
    assert breadth_pct([True, True, False, False]) == 50.0
    cells = weekly_breadth_series(
        [
            [False] * 20 + [True] * 20,
            [False] * 10 + [True] * 30,
        ],
        week_days=5,
        weeks=8,
    )
    assert len(cells) == 8
    x, y = rotation_coordinates([10, 20, 30, 40, 50, 60, 70, 80])
    assert x == 45.0
    assert y == round(80 - ((40 + 50 + 60 + 70) / 4), 2)


def test_sectors_list_detail_compare() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_bars("AAA", start=100.0, step=1.0)
    _seed_bars("BBB", start=80.0, step=0.5)
    _seed_bars("CCC", start=40.0, step=-0.2)

    listed = client.get("/sectors")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload["sectors"]) >= 2
    finance = next(item for item in payload["sectors"] if item["name"] == "Finance")
    assert finance["total"] == 2

    detail = client.get("/sectors/Finance")
    assert detail.status_code == 200
    body = detail.json()
    assert body["name"] == "Finance"
    assert len(body["constituents"]) == 2
    assert len(body["weekly_trend"]) == 8
    assert body["leader"]["symbol"] in {"AAA", "BBB"}

    stocks = client.get("/stocks", params={"filter": "all", "q": ""})
    assert stocks.status_code == 200
    finance_stocks = [row for row in stocks.json() if row["industry"] == "Finance"]
    above_from_stocks = sum(1 for row in finance_stocks if row["above_ma44"])
    assert body["above"] == above_from_stocks

    compared = client.get("/sectors/compare", params={"a": "Finance", "b": "IT"})
    assert compared.status_code == 200
    assert compared.json()["a"] == "Finance"
    assert any(item["name"] == "Finance" for item in compared.json()["sectors"])
