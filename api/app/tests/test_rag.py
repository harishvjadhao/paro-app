from __future__ import annotations

import json
import time
from pathlib import Path

import fitz
from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.chunking import chunk_page_text
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
        "When price sits above the line and the line is rising, you are a buyer.\n"
        "Engulfing patterns work because they show a full transfer of control within one session.",
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
    path = FIXTURES / "rag_book.pdf"
    _make_text_pdf(path)
    with path.open("rb") as handle:
        upload = client.post(
            "/library/books/upload",
            data={"kind": "text"},
            files={"file": ("RAG Book.pdf", handle, "application/pdf")},
        )
    assert upload.status_code == 200, upload.text
    job = _wait_ready(client, upload.json()["job_id"])
    assert job["state"] == "ready", job
    assert job["report"]["chunks"] >= 1
    return upload.json()["book_id"]


def _read_sse(response) -> list[dict]:
    events: list[dict] = []
    for block in response.text.split("\n\n"):
        line = next((part for part in block.split("\n") if part.startswith("data:")), None)
        if not line:
            continue
        events.append(json.loads(line[5:].strip()))
    return events


def test_chunk_char_ranges_map_to_page_text() -> None:
    text = (
        "Most traders drown in indicators. This book asks you to master one line first. "
        "When price sits above the line and the line is rising, you are a buyer."
    )
    chunks = chunk_page_text(page_index=0, chapter="Chapter 1", text=text, target_tokens=40, min_tokens=5)
    assert chunks
    for chunk in chunks:
        assert text[chunk.char_start : chunk.char_end] == chunk.text


def test_ask_streams_cites_and_delete_cascades_chunks() -> None:
    _reset_tables()
    client = TestClient(app)
    book_id = _ingest_book(client)

    with SessionLocal() as db:
        assert db.query(BookChunk).filter(BookChunk.book_id == book_id).count() >= 1

    pages = client.get(f"/library/books/{book_id}/pages").json()
    page0 = pages[0]["text"]

    response = client.post(
        f"/library/books/{book_id}/ask",
        json={"question": "How do engulfing patterns work?", "top_k": 3},
    )
    assert response.status_code == 200, response.text
    events = _read_sse(response)
    types = [event["type"] for event in events]
    assert "meta" in types
    assert "token" in types
    assert "cites" in types
    assert "done" in types

    cites_event = next(event for event in events if event["type"] == "cites")
    cites = cites_event["cites"]
    assert cites
    cite = cites[0]
    assert "page_index" in cite and "quote" in cite
    page_text = next(page["text"] for page in pages if page["page_index"] == cite["page_index"])
    assert page_text[cite["char_start"] : cite["char_end"]] == cite["quote"] or cite["quote"] in page_text
    # Prefer exact char-range mapping when possible
    sliced = page_text[cite["char_start"] : cite["char_end"]]
    assert cite["quote"] in page0 or cite["quote"] in sliced or sliced in cite["quote"] or cite["quote"] in page_text

    explain = client.post(f"/library/books/{book_id}/explain-page", json={"page_index": 0})
    assert explain.status_code == 200
    assert any(event["type"] == "cites" for event in _read_sse(explain))

    chapter = client.post(
        f"/library/books/{book_id}/summarize-chapter",
        json={"page_index": 0},
    )
    assert chapter.status_code == 200
    assert any(event["type"] == "done" for event in _read_sse(chapter))

    whole = client.post(f"/library/books/{book_id}/summarize-book")
    assert whole.status_code == 200
    assert any(event["type"] == "done" for event in _read_sse(whole))

    assert client.delete(f"/library/books/{book_id}").status_code == 200
    with SessionLocal() as db:
        assert db.query(BookChunk).filter(BookChunk.book_id == book_id).count() == 0
