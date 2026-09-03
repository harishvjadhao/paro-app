from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.sectors import stock_week_above_share, weekly_breadth_series
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


def test_weekly_aggregation_spot_check() -> None:
    matrix = [
        [False] * 20 + [True] * 20,
        [True] * 40,
    ]
    cells = weekly_breadth_series(matrix, week_days=5, weeks=8)
    assert len(cells) == 8
    # Last week: both stocks fully above across 5 days => 100%
    assert cells[-1]["pct"] == 100.0
    share = stock_week_above_share(matrix[0], 7, week_days=5, weeks=8)
    assert share == 1.0


def test_trends_matrix_and_drill() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_bars("AAA", start=100.0, step=1.0)
    _seed_bars("BBB", start=90.0, step=0.7)
    _seed_bars("CCC", start=50.0, step=-0.1)

    matrix = client.get("/trends/weekly")
    assert matrix.status_code == 200
    payload = matrix.json()
    assert len(payload["weeks"]) == 8
    assert len(payload["sectors"]) >= 2
    finance = next(row for row in payload["sectors"] if row["name"] == "Finance")
    assert len(finance["cells"]) == 8
    assert finance["total"] == 2

    drill = client.get("/trends/weekly/Finance/7")
    assert drill.status_code == 200
    body = drill.json()
    assert body["sector"] == "Finance"
    assert body["week_index"] == 7
    assert len(body["stocks"]) == 2
    assert body["total"] == 2
