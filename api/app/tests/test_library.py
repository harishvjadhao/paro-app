from __future__ import annotations

import time
from pathlib import Path

import fitz
from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.domain.library import detect_kind, estimate_tokens, extract_pdf_pages
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


def _make_empty_pdf(path: Path) -> None:
    """PDF with blank pages (no extractable text) to force scanned/OCR path."""
    doc = fitz.open()
    doc.new_page()
    doc.new_page()
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


def test_domain_extract_and_detect() -> None:
    path = FIXTURES / "sample_text.pdf"
    _make_text_pdf(path)
    pages = extract_pdf_pages(str(path))
    assert len(pages) == 2
    assert "Chapter 1" in pages[0].chapter or "44" in pages[0].text
    assert detect_kind(pages) == "text"
    assert estimate_tokens(pages[0].text) > 10


def test_text_and_scanned_ingest_to_ready() -> None:
    _reset_tables()
    client = TestClient(app)

    text_pdf = FIXTURES / "ingest_text.pdf"
    _make_text_pdf(text_pdf)
    with text_pdf.open("rb") as handle:
        upload = client.post(
            "/library/books/upload",
            data={"kind": "text"},
            files={"file": ("Trading Trends.pdf", handle, "application/pdf")},
        )
    assert upload.status_code == 200, upload.text
    text_job = _wait_ready(client, upload.json()["job_id"])
    assert text_job["state"] == "ready"
    assert text_job["report"]["pages"] == 2
    assert text_job["report"]["tokens"] > 0
    assert text_job["report"]["ocr_confidence"] is None

    blank_pdf = FIXTURES / "ingest_scan.pdf"
    _make_empty_pdf(blank_pdf)
    with blank_pdf.open("rb") as handle:
        scan_upload = client.post(
            "/library/books/upload",
            data={"kind": "scanned"},
            files={"file": ("Scanned Classic.pdf", handle, "application/pdf")},
        )
    assert scan_upload.status_code == 200, scan_upload.text
    scan_job = _wait_ready(client, scan_upload.json()["job_id"])
    assert scan_job["state"] == "ready", scan_job
    assert scan_job["report"]["pages"] == 2
    assert scan_job["report"]["ocr_confidence"] is not None

    shelf = client.get("/library/books")
    assert shelf.status_code == 200
    assert len(shelf.json()) >= 2

    book_id = upload.json()["book_id"]
    detail = client.get(f"/library/books/{book_id}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "ready"
    assert detail.json()["toc"]

    pages = client.get(f"/library/books/{book_id}/pages")
    assert pages.status_code == 200
    assert len(pages.json()) == 2

    renamed = client.patch(f"/library/books/{book_id}", json={"title": "Renamed Book"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed Book"

    deleted = client.delete(f"/library/books/{book_id}")
    assert deleted.status_code == 200
    assert client.get(f"/library/books/{book_id}").status_code == 404


def test_reject_non_pdf() -> None:
    _reset_tables()
    client = TestClient(app)
    response = client.post(
        "/library/books/upload",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )
    assert response.status_code == 400
