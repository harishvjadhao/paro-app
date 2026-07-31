"""PDF ingestion pipeline (runs in worker or inline)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import fitz  # PyMuPDF
from sqlalchemy.orm import Session

from app.models.books import EMBED_DIM, Book, BookChunk, BookPage, BookSuggestion, IngestionJob
from app.providers.ai import get_embeddings_provider, get_vision_provider
from app.providers.storage import get_storage
from app.services.chunking import approx_tokens, chunk_page_text


def _pad_embedding(vec: list[float]) -> list[float]:
    if len(vec) >= EMBED_DIM:
        return vec[:EMBED_DIM]
    return vec + [0.0] * (EMBED_DIM - len(vec))


def _set_job(db: Session, job: IngestionJob, state: str, pct: int, msg: str) -> None:
    job.state = state
    job.pct = pct
    job.stage_message = msg
    db.commit()


def detect_kind(doc: fitz.Document) -> str:
    sample = min(3, doc.page_count)
    chars = 0
    for i in range(sample):
        chars += len(doc.load_page(i).get_text("text") or "")
    return "text" if chars > 80 * sample else "scanned"


def process_ingestion(db: Session, book_id: int, job_id: int) -> None:
    book = db.get(Book, book_id)
    job = db.get(IngestionJob, job_id)
    if not book or not job:
        return
    storage = get_storage()
    try:
        _set_job(db, job, "parsing", 10, "Loading PDF")
        pdf_bytes = storage.get(book.storage_key)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        kind = book.kind if book.kind in ("text", "scanned") else detect_kind(doc)
        book.kind = kind
        book.status = "ocr" if kind == "scanned" else "parsing"
        db.commit()

        pages_data: list[tuple[int, str, str]] = []
        confidences: list[float] = []
        vision = get_vision_provider()
        for i in range(doc.page_count):
            page = doc.load_page(i)
            text = (page.get_text("text") or "").strip()
            chapter = ""
            if text:
                first = text.split("\n", 1)[0].strip()
                if len(first) < 80:
                    chapter = first
            if kind == "scanned" or len(text) < 20:
                _set_job(db, job, "ocr", 20 + int(60 * i / max(doc.page_count, 1)), f"OCR page {i+1}")
                pix = page.get_pixmap(dpi=144)
                ocr = vision.ocr_image(pix.tobytes("png"))
                if ocr:
                    text = ocr
                    confidences.append(0.7)
                else:
                    confidences.append(0.0)
            pages_data.append((i, chapter, text))
            _set_job(
                db,
                job,
                "parsing" if kind == "text" else "ocr",
                20 + int(50 * (i + 1) / max(doc.page_count, 1)),
                f"Page {i+1}/{doc.page_count}",
            )

        # persist pages
        for page_index, chapter, text in pages_data:
            db.add(BookPage(book_id=book.id, page_index=page_index, chapter=chapter, text=text))
        db.commit()

        _set_job(db, job, "embedding", 75, "Chunking + embedding")
        embedder = get_embeddings_provider()
        all_chunks = []
        for page_index, chapter, text in pages_data:
            for ch in chunk_page_text(text, page_index=page_index, chapter=chapter):
                all_chunks.append(ch)

        embeddings = embedder.embed([c.text for c in all_chunks]) if all_chunks else []
        token_count = 0
        for i, ch in enumerate(all_chunks):
            vec = _pad_embedding(embeddings[i] if i < len(embeddings) else [0.0])
            db.add(
                BookChunk(
                    book_id=book.id,
                    page_index=ch.page_index,
                    chapter=ch.chapter,
                    ord=ch.ord,
                    text=ch.text,
                    char_start=ch.char_start,
                    char_end=ch.char_end,
                    embedding=vec,
                )
            )
            token_count += approx_tokens(ch.text)
        db.commit()

        # suggestions
        chapters = [c for _, c, _ in pages_data if c]
        qs = []
        if chapters:
            qs.append(f"What is the main idea of {chapters[0]}?")
        qs.append("Summarize the key takeaways from this book.")
        qs.append("Which passages discuss risk or discipline?")
        for q in qs[:3]:
            db.add(BookSuggestion(book_id=book.id, question=q))

        book.page_count = len(pages_data)
        book.chunk_count = len(all_chunks)
        book.token_count = token_count
        book.ocr_confidence = (
            sum(confidences) / len(confidences) if confidences and kind == "scanned" else None
        )
        book.status = "ready"
        job.state = "ready"
        job.pct = 100
        job.stage_message = "Ready"
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        book.status = "failed"
        job.state = "failed"
        job.error = str(exc)[:1000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
