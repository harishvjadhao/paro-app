from __future__ import annotations

import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parents[3] / "data" / "paro_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["AI_FORCE_STUB"] = "true"
os.environ["SCHEDULER_ENABLED"] = "false"


def pytest_sessionstart() -> None:
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


def pytest_sessionfinish() -> None:
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except PermissionError:
            # Windows can keep a short-lived lock after SQLAlchemy shutdown.
            pass
