from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.config import settings
from app.db import SessionLocal, engine
from app.models import Base
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.main import app
from app.routes.sync import sync_service

SYNC_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha One,Finance,AAA,EQ,INE000A00001
Beta Two,Finance,BBB,EQ,INE000B00002
Gamma Three,IT,CCC,EQ,INE000C00003
Delta Four,Energy,DDD,EQ,INE000D00004
"""


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(SyncRunItem).delete()
        db.query(SyncRun).delete()
        db.query(PriceBar).delete()
        db.query(StockUniverse).delete()
        db.query(UniverseUpload).delete()
        db.commit()



def _wait_for_latest_run(client: TestClient) -> dict[str, object]:
    for _ in range(100):
        runs = client.get("/admin/sync/runs")
        payload = runs.json()
        if payload and payload[0]["status"] != "running":
            return payload[0]
        time.sleep(0.05)
    raise AssertionError("Sync run did not finish in time")



def test_sync_partial_and_retry_failed() -> None:
    _reset_tables()
    settings.sync_force_fail_symbols = "AAA,BBB,CCC"

    client = TestClient(app)
    seed = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("sync.csv", SYNC_CSV, "text/csv")},
    )
    assert seed.status_code == 200

    start = client.post("/admin/sync", json={"mode": "full", "scope": "universe"})
    assert start.status_code == 200

    run = _wait_for_latest_run(client)
    assert run["status"] == "partial"
    assert run["failed"] == 3
    assert run["processed"] == 4

    detail = client.get(f"/admin/sync/runs/{run['id']}")
    assert detail.status_code == 200
    items = detail.json()["items"]
    assert any(item["status"] == "fail" for item in items)

    retry = client.post(f"/admin/sync/runs/{run['id']}/retry-failed")
    assert retry.status_code == 200

    retried = _wait_for_latest_run(client)
    assert retried["mode"] == "full"
    assert retried["scope"] == "universe"

    settings.sync_force_fail_symbols = ""



def test_sync_lock_returns_409() -> None:
    _reset_tables()
    settings.sync_force_fail_symbols = ""

    client = TestClient(app)

    with sync_service._lock:
        sync_service._running = True

    try:
        response = client.post("/admin/sync", json={"mode": "incremental", "scope": "universe"})
        assert response.status_code == 409
        assert "already in progress" in response.json()["error"]["message"]
    finally:
        with sync_service._lock:
            sync_service._running = False


def test_stale_running_run_is_auto_recovered() -> None:
    _reset_tables()
    settings.sync_force_fail_symbols = ""

    client = TestClient(app)
    seed = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("sync.csv", SYNC_CSV, "text/csv")},
    )
    assert seed.status_code == 200

    with SessionLocal() as db:
        run_id = sync_service.start_run(db, mode="full", scope="universe")

    with sync_service._lock:
        sync_service._running = False

    status = client.get("/admin/sync/status")
    assert status.status_code == 200
    payload = status.json()
    assert payload["id"] == run_id
    assert payload["status"] == "partial"
    assert payload["error"] == "Sync run was interrupted and auto-recovered."
