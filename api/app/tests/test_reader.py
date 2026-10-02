from __future__ import annotations

import time
from pathlib import Path

import fitz
from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.main import app
from app.models import Base
from app.models.highlights import ChartHighlight
from app.models.journal import Trade
from app.models.library import (
    Book,
    BookBookmark,
    BookChunk,
    BookHighlight,
    BookPage,
    BookSuggestion,
    IngestionJob,
    ReadingProgress,
)
from app.models.stock_list import StockListColumn, StockMeta
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.models.workspace import StockComment, StockState

FIXTURES = Path(__file__).resolve().parent / "_fixtures"
FIXTURES.mkdir(exist_ok=True)


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(BookChunk).delete()
        db.query(BookHighlight).delete()
        db.query(BookBookmark).delete()
        db.query(ReadingProgress).delete()
        db.query(BookSuggestion).delete()
        db.query(BookPage).delete()
        db.query(IngestionJob).delete()
        db.query(Book).delete()
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


def _make_text_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "Chapter 1 · The 44-Day Line\n\n"
        "Most traders drown in indicators. This book asks you to master one line first.\n"
        "When price sits above the line and the line is rising, you are a buyer.",
    )
    page2 = doc.new_page()
    page2.insert_text(
        (72, 72),
        "Chapter 2 · Sizing\n\nYour edge is small and statistical. Size so that no single trade can end your season.",
    )
    doc.save(path)
    doc.close()


def _wait_ready(client: TestClient, job_id: int, *, timeout: float = 20.0) -> dict:
    deadline = time.time() + timeout
    last: dict = {}
    while time.time() < deadline:
        response = client.get(f"/library/jobs/{job_id}")
        assert response.status_code == 200
        last = response.json()
        if last["state"] in {"ready", "failed"}:
            return last
        time.sleep(0.15)
    raise AssertionError(f"Job {job_id} did not finish: {last}")


def _ingest_book(client: TestClient) -> int:
    path = FIXTURES / "reader_book.pdf"
    _make_text_pdf(path)
    with path.open("rb") as handle:
        upload = client.post(
            "/library/books/upload",
            data={"kind": "text"},
            files={"file": ("Reader Book.pdf", handle, "application/pdf")},
        )
    assert upload.status_code == 200, upload.text
    job = _wait_ready(client, upload.json()["job_id"])
    assert job["state"] == "ready", job
    return upload.json()["book_id"]


def test_progress_bookmarks_highlights_survive_reload() -> None:
    _reset_tables()
    client = TestClient(app)
    book_id = _ingest_book(client)

    progress = client.put(f"/library/books/{book_id}/progress", json={"page_index": 1})
    assert progress.status_code == 200
    assert progress.json()["page_index"] == 1

    reloaded = client.get(f"/library/books/{book_id}/progress")
    assert reloaded.status_code == 200
    assert reloaded.json()["page_index"] == 1

    bookmark = client.post(f"/library/books/{book_id}/bookmarks", json={"page_index": 0})
    assert bookmark.status_code == 200
    bookmark_id = bookmark.json()["id"]

    bookmarks = client.get(f"/library/books/{book_id}/bookmarks")
    assert bookmarks.status_code == 200
    assert len(bookmarks.json()) == 1
    assert bookmarks.json()[0]["page_index"] == 0

    toggle_off = client.post(f"/library/books/{book_id}/bookmarks/toggle?page_index=0")
    assert toggle_off.status_code == 200
    assert toggle_off.json()["bookmarked"] is False
    assert client.get(f"/library/books/{book_id}/bookmarks").json() == []

    toggle_on = client.post(f"/library/books/{book_id}/bookmarks/toggle?page_index=1")
    assert toggle_on.status_code == 200
    assert toggle_on.json()["bookmarked"] is True

    highlight = client.post(
        f"/library/books/{book_id}/highlights",
        json={
            "page_index": 0,
            "start_offset": 0,
            "end_offset": 12,
            "quote": "Chapter 1 ·",
            "color": "#EA9D00",
        },
    )
    assert highlight.status_code == 200, highlight.text
    highlight_id = highlight.json()["id"]

    exported = client.get(f"/library/books/{book_id}/highlights")
    assert exported.status_code == 200
    assert len(exported.json()) == 1
    assert exported.json()[0]["quote"] == "Chapter 1 ·"

    search = client.get(f"/library/books/{book_id}/search", params={"q": "indicators"})
    assert search.status_code == 200
    assert len(search.json()) >= 1
    assert search.json()[0]["page_index"] == 0

    shelf = client.get("/library/books")
    assert shelf.status_code == 200
    item = next(row for row in shelf.json() if row["id"] == book_id)
    assert item["progress_pct"] == 100  # page 1 of 2 → 100%

    assert client.delete(f"/library/books/{book_id}/highlights/{highlight_id}").status_code == 200
    assert client.get(f"/library/books/{book_id}/highlights").json() == []

    # Cascade on book delete
    assert client.delete(f"/library/books/{book_id}").status_code == 200
    assert client.get(f"/library/books/{book_id}/progress").status_code == 404
    # bookmark_id from earlier toggle may have changed; ensure tables empty
    with SessionLocal() as db:
        assert db.query(ReadingProgress).count() == 0
        assert db.query(BookBookmark).count() == 0
        assert db.query(BookHighlight).count() == 0
        _ = bookmark_id  # silence unused after toggle cycle
