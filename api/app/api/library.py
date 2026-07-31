"""Library + RAG API."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.books import (
    Book,
    BookBookmark,
    BookChunk,
    BookHighlight,
    BookPage,
    BookSuggestion,
    IngestionJob,
    ReadingProgress,
)
from app.providers.ai import get_chat_provider, get_embeddings_provider
from app.providers.storage import get_storage
from app.services.chunking import quote_for_citation
from app.services.ingest import process_ingestion

router = APIRouter(prefix="/library", tags=["library"])

MAX_PDF_BYTES = 40 * 1024 * 1024


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class PageIn(BaseModel):
    page_index: int


class ChapterIn(BaseModel):
    chapter: str | None = None
    page_index: int | None = None


class ProgressIn(BaseModel):
    page_index: int


class HighlightIn(BaseModel):
    page_index: int
    text: str
    note: str | None = None


class RenameIn(BaseModel):
    title: str


def _enqueue(book_id: int, job_id: int) -> None:
    """Push job id to Redis list; worker consumes. Falls back to inline if Redis down."""
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        r.lpush("paro:ingest", f"{book_id}:{job_id}")
    except Exception:
        # Inline process for offline/dev without Redis
        from app.db import SessionLocal

        db = SessionLocal()
        try:
            process_ingestion(db, book_id, job_id)
        finally:
            db.close()


@router.post("/books/upload")
async def upload_book(
    file: UploadFile = File(...),
    kind: str | None = Form(None),
    db: Session = Depends(get_db),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF required")
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="file too large")
    if data[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="invalid PDF magic")

    title = Path(file.filename).stem
    storage = get_storage()
    key = f"books/{title}-{len(data)}.pdf"
    storage.put(key, data)

    book = Book(
        title=title,
        source_filename=file.filename,
        storage_key=key,
        kind=kind or "text",
        status="queued",
    )
    db.add(book)
    db.flush()
    job = IngestionJob(book_id=book.id, state="queued", pct=0, stage_message="Queued")
    db.add(job)
    db.commit()
    db.refresh(book)
    db.refresh(job)
    _enqueue(book.id, job.id)
    return {"book_id": book.id, "job_id": job.id}


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)) -> dict:
    job = db.get(IngestionJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    book = db.get(Book, job.book_id)
    report = None
    if book and job.state == "ready":
        report = {
            "pages": book.page_count,
            "chunks": book.chunk_count,
            "tokens": book.token_count,
            "ocr_confidence": book.ocr_confidence,
        }
    return {
        "id": job.id,
        "book_id": job.book_id,
        "state": job.state,
        "pct": job.pct,
        "stage": job.stage_message,
        "error": job.error,
        "report": report,
    }


@router.get("/books")
def list_books(db: Session = Depends(get_db)) -> list[dict]:
    books = db.scalars(select(Book).order_by(Book.created_at.desc())).all()
    out = []
    for b in books:
        prog = db.scalar(
            select(ReadingProgress).where(
                ReadingProgress.book_id == b.id,
                ReadingProgress.user_id == settings.default_user_id,
            )
        )
        pct = 0
        if b.page_count and prog:
            pct = int((prog.page_index + 1) / b.page_count * 100)
        out.append(
            {
                "id": b.id,
                "title": b.title,
                "author": b.author,
                "tag": b.tag,
                "kind": b.kind,
                "status": b.status,
                "page_count": b.page_count,
                "chunk_count": b.chunk_count,
                "spine_color": b.spine_color,
                "progress_pct": pct,
            }
        )
    return out


@router.get("/books/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db)) -> dict:
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=404, detail="not found")
    pages = db.scalars(
        select(BookPage).where(BookPage.book_id == book_id).order_by(BookPage.page_index)
    ).all()
    toc = []
    seen = set()
    for p in pages:
        if p.chapter and p.chapter not in seen:
            seen.add(p.chapter)
            toc.append({"chapter": p.chapter, "page_index": p.page_index})
    suggestions = [
        s.question
        for s in db.scalars(select(BookSuggestion).where(BookSuggestion.book_id == book_id)).all()
    ]
    return {
        "id": b.id,
        "title": b.title,
        "author": b.author,
        "subtitle": b.subtitle,
        "tag": b.tag,
        "kind": b.kind,
        "status": b.status,
        "page_count": b.page_count,
        "chunk_count": b.chunk_count,
        "token_count": b.token_count,
        "ocr_confidence": b.ocr_confidence,
        "toc": toc,
        "suggestions": suggestions,
    }


@router.patch("/books/{book_id}")
def rename_book(book_id: int, body: RenameIn, db: Session = Depends(get_db)) -> dict:
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=404, detail="not found")
    b.title = body.title.strip()
    db.commit()
    return {"id": b.id, "title": b.title}


@router.delete("/books/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)) -> dict:
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=404, detail="not found")
    key = b.storage_key
    db.delete(b)
    db.commit()
    try:
        get_storage().delete(key)
    except Exception:
        pass
    return {"ok": True}


@router.get("/books/{book_id}/pages")
def get_pages(
    book_id: int,
    from_: int = 0,
    to: int = 5,
    db: Session = Depends(get_db),
) -> list[dict]:
    pages = db.scalars(
        select(BookPage)
        .where(
            BookPage.book_id == book_id,
            BookPage.page_index >= from_,
            BookPage.page_index <= to,
        )
        .order_by(BookPage.page_index)
    ).all()
    return [
        {"page_index": p.page_index, "chapter": p.chapter, "text": p.text} for p in pages
    ]


@router.get("/books/{book_id}/search")
def search_book(book_id: int, q: str, db: Session = Depends(get_db)) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    pages = db.scalars(select(BookPage).where(BookPage.book_id == book_id)).all()
    hits = []
    for p in pages:
        idx = p.text.lower().find(q.lower())
        if idx >= 0:
            snippet = p.text[max(0, idx - 40) : idx + len(q) + 40]
            hits.append(
                {
                    "page_index": p.page_index,
                    "chapter": p.chapter,
                    "snippet": snippet,
                }
            )
    return hits[:50]


@router.get("/books/{book_id}/progress")
def get_progress(book_id: int, db: Session = Depends(get_db)) -> dict:
    p = db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == settings.default_user_id,
        )
    )
    return {"page_index": p.page_index if p else 0}


@router.put("/books/{book_id}/progress")
def put_progress(book_id: int, body: ProgressIn, db: Session = Depends(get_db)) -> dict:
    p = db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == settings.default_user_id,
        )
    )
    if not p:
        p = ReadingProgress(
            user_id=settings.default_user_id, book_id=book_id, page_index=body.page_index
        )
        db.add(p)
    else:
        p.page_index = body.page_index
    db.commit()
    return {"page_index": p.page_index}


@router.get("/books/{book_id}/bookmarks")
def list_bookmarks(book_id: int, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(BookBookmark).where(
            BookBookmark.book_id == book_id,
            BookBookmark.user_id == settings.default_user_id,
        )
    ).all()
    return [{"id": r.id, "page_index": r.page_index} for r in rows]


@router.post("/books/{book_id}/bookmarks")
def add_bookmark(book_id: int, body: ProgressIn, db: Session = Depends(get_db)) -> dict:
    b = BookBookmark(
        user_id=settings.default_user_id, book_id=book_id, page_index=body.page_index
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "page_index": b.page_index}


@router.delete("/books/{book_id}/bookmarks/{bookmark_id}")
def del_bookmark(book_id: int, bookmark_id: int, db: Session = Depends(get_db)) -> dict:
    b = db.get(BookBookmark, bookmark_id)
    if not b or b.book_id != book_id:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(b)
    db.commit()
    return {"ok": True}


@router.get("/books/{book_id}/highlights")
def list_highlights(book_id: int, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(BookHighlight)
        .where(
            BookHighlight.book_id == book_id,
            BookHighlight.user_id == settings.default_user_id,
        )
        .order_by(BookHighlight.page_index, BookHighlight.id)
    ).all()
    return [
        {
            "id": r.id,
            "page_index": r.page_index,
            "text": r.text,
            "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/books/{book_id}/highlights")
def add_highlight(book_id: int, body: HighlightIn, db: Session = Depends(get_db)) -> dict:
    h = BookHighlight(
        user_id=settings.default_user_id,
        book_id=book_id,
        page_index=body.page_index,
        text=body.text,
        note=body.note,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "page_index": h.page_index, "text": h.text, "note": h.note}


@router.delete("/books/{book_id}/highlights/{hid}")
def del_highlight(book_id: int, hid: int, db: Session = Depends(get_db)) -> dict:
    h = db.get(BookHighlight, hid)
    if not h or h.book_id != book_id:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(h)
    db.commit()
    return {"ok": True}


def _retrieve(db: Session, book_id: int, question: str, k: int = 5) -> list[BookChunk]:
    embedder = get_embeddings_provider()
    qvec = embedder.embed([question])[0]
    # pad
    from app.models.books import EMBED_DIM
    from app.services.ingest import _pad_embedding

    qvec = _pad_embedding(qvec)
    # cosine distance via pgvector if available; fallback python
    try:
        rows = db.execute(
            text(
                """
                SELECT id FROM book_chunks
                WHERE book_id = :bid AND embedding IS NOT NULL
                ORDER BY embedding <=> :vec
                LIMIT :k
                """
            ),
            {"bid": book_id, "vec": str(qvec), "k": k},
        ).fetchall()
        ids = [r[0] for r in rows]
        if ids:
            chunks = db.scalars(select(BookChunk).where(BookChunk.id.in_(ids))).all()
            return list(chunks)
    except Exception:
        pass
    chunks = list(db.scalars(select(BookChunk).where(BookChunk.book_id == book_id)).all())
    return chunks[:k]


def _cites_from_chunks(db: Session, chunks: list[BookChunk]) -> list[dict]:
    cites = []
    seen = set()
    for ch in chunks:
        if ch.page_index in seen:
            continue
        seen.add(ch.page_index)
        page = db.scalar(
            select(BookPage).where(
                BookPage.book_id == ch.book_id, BookPage.page_index == ch.page_index
            )
        )
        quote = quote_for_citation(page.text if page else ch.text, ch.char_start, ch.char_end)
        cites.append(
            {
                "page_index": ch.page_index,
                "chapter": ch.chapter,
                "quote": quote,
                "char_start": ch.char_start,
                "char_end": ch.char_end,
            }
        )
    return cites


def _sse_answer(db: Session, book_id: int, question: str, system_extra: str = "") -> StreamingResponse:
    chunks = _retrieve(db, book_id, question)
    cites = _cites_from_chunks(db, chunks)
    context = "\n\n".join(
        f"[p.{c.page_index}] {c.text}" for c in chunks
    ) or "No passages found."
    messages = [
        {
            "role": "system",
            "content": (
                "Answer using only the book passages. Cite pages as p.N. "
                "If nothing direct, say you could not find a direct passage but the closest is this. "
                + system_extra
            ),
        },
        {"role": "user", "content": f"PASSAGES:\n{context}\n\nQUESTION:\n{question}"},
    ]
    chat = get_chat_provider()

    def gen():
        yield f"data: {json.dumps({'cites': cites, 'retrieving': False})}\n\n"
        for token in chat.stream_chat(messages):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True, 'cites': cites})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/books/{book_id}/ask")
def ask_book(book_id: int, body: AskIn, db: Session = Depends(get_db)) -> StreamingResponse:
    if not db.get(Book, book_id):
        raise HTTPException(status_code=404, detail="not found")
    return _sse_answer(db, book_id, body.question)


@router.post("/books/{book_id}/explain-page")
def explain_page(book_id: int, body: PageIn, db: Session = Depends(get_db)) -> StreamingResponse:
    return _sse_answer(
        db, book_id, f"Explain page {body.page_index}", system_extra="Focus on that page."
    )


@router.post("/books/{book_id}/summarize-chapter")
def summarize_chapter(
    book_id: int, body: ChapterIn, db: Session = Depends(get_db)
) -> StreamingResponse:
    chap = body.chapter or ""
    return _sse_answer(db, book_id, f"Summarize chapter {chap or body.page_index}")


@router.post("/books/{book_id}/summarize-book")
def summarize_book(book_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    return _sse_answer(db, book_id, "Summarize the whole book by chapters.")
