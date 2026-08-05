from pathlib import Path

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.main import app
from app.models import Base
from app.models.universe import StockUniverse

SAMPLE_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha Bank,Finance,ABANK,EQ,INE000A01010
Beta Motors,Auto,BMOT,EQ,INE000B01020
Gamma Energy,Power,GENR,EQ,INE000C01030
Delta Tech,IT,DTEC,EQ,INE000D01040
"""

MISSING_COLUMN_CSV = """Company Name,Industry,Symbol,Series
Alpha Bank,Finance,ABANK,EQ
"""



def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(StockUniverse).delete()
        db.commit()



def test_upload_universe_append_success() -> None:
    _reset_tables()

    client = TestClient(app)
    response = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 4
    assert payload["dup"] == 0
    assert payload["invalid"] == 0
    assert len(payload["preview"]) == 4

    universe = client.get("/universe")
    assert universe.status_code == 200
    assert len(universe.json()) == 4



def test_missing_required_column_rejected_with_exact_message() -> None:
    _reset_tables()

    client = TestClient(app)
    response = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("bad.csv", MISSING_COLUMN_CSV, "text/csv")},
    )

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Missing required column(s): ISIN Code. No changes were applied."

    universe = client.get("/universe")
    assert universe.status_code == 200
    assert len(universe.json()) == 0



def test_replace_requires_confirmation() -> None:
    _reset_tables()

    client = TestClient(app)
    seed_response = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )
    assert seed_response.status_code == 200

    reject = client.post(
        "/admin/universe/upload",
        data={"mode": "replace"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )
    assert reject.status_code == 400

    universe_after_reject = client.get("/universe")
    assert len(universe_after_reject.json()) == 4

    accept = client.post(
        "/admin/universe/upload",
        data={"mode": "replace", "confirm": "true"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )
    assert accept.status_code == 200

    universe_after_accept = client.get("/universe")
    assert len(universe_after_accept.json()) == 4
