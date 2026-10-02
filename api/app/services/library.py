from __future__ import annotations

import shutil
import time
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import PROJECT_ROOT, settings
from app.db import SessionLocal
from app.domain.chunking import chunk_pages
from app.domain.library import (
    SPINE_COLORS,
    detect_kind,
    estimate_tokens,
    extract_pdf_pages,
    infer_chapter,
    title_from_filename,
)
from app.models.library import Book, BookBookmark, BookChunk, BookHighlight, BookPage, IngestionJob
from app.providers.embeddings import get_embedding_provider, packing_bytes
from app.providers.ocr import get_ocr_provider, render_page_png
from app.repositories.library import LibraryRepository
from app.schemas.library import (
    BookBookmarkCreate,
    BookBookmarkResponse,
    BookDetailResponse,
    BookHighlightCreate,
    BookHighlightResponse,
    BookPageResponse,
    BookRenameRequest,
    BookSearchHit,
    BookShelfItem,
    BookUploadResponse,
    IngestionJobResponse,
    IngestionReport,
    ReadingProgressResponse,
    ReadingProgressUpdate,
    TocEntry,
)

MAX_UPLOAD_BYTES = int(getattr(settings, "library_max_upload_mb", 25) or 25) * 1024 * 1024


class LibraryService:
    def __init__(self, repo: LibraryRepository | None = None) -> None:
        self.repo = repo or LibraryRepository()

    def books_root(self) -> Path:
        root = Path(settings.data_dir).expanduser().resolve() / "books"
        root.mkdir(parents=True, exist_ok=True)
        return root

    def _storage_key_for(self, path: Path) -> str:
        resolved = path.resolve()
        try:
            return str(resolved.relative_to(PROJECT_ROOT.resolve())).replace("\\", "/")
        except ValueError:
            return str(resolved).replace("\\", "/")

    def _pdf_path(self, storage_key: str) -> Path:
        path = Path(storage_key)
        if path.is_absolute():
            return path
        return (PROJECT_ROOT / path).resolve()

    async def upload_book(
        self,
        db: Session,
        file: UploadFile,
        *,
        kind: str | None = None,
    ) -> BookUploadResponse:
        filename = (file.filename or "book.pdf").strip()
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")
        content_type = (file.content_type or "").lower()
        if content_type and content_type not in {"application/pdf", "application/x-pdf", "binary/octet-stream"}:
            raise HTTPException(status_code=400, detail="Invalid MIME type. Expected application/pdf.")

        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Empty PDF upload.")
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"PDF exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            )
        if not raw.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File does not look like a PDF.")

        forced_kind = kind if kind in {"text", "scanned"} else None
        existing = self.repo.list_books(db)
        spine = SPINE_COLORS[len(existing) % len(SPINE_COLORS)]

        book = Book(
            title=title_from_filename(filename),
            author="",
            subtitle="",
            tag="Book",
            spine_color=spine,
            kind=forced_kind or "auto",
            source_filename=filename,
            storage_key="",  # filled after id
            status="queued",
        )
        self.repo.create_book(db, book)
        book_dir = self.books_root() / str(book.id)
        book_dir.mkdir(parents=True, exist_ok=True)
        storage_path = book_dir / "source.pdf"
        storage_path.write_bytes(raw)
        book.storage_key = self._storage_key_for(storage_path)
        if forced_kind:
            book.kind = forced_kind

        job = IngestionJob(
            book_id=book.id,
            state="uploading",
            pct=5,
            stage_message="Uploading PDF…",
        )
        self.repo.create_job(db, job)
        db.commit()
        return BookUploadResponse(book_id=book.id, job_id=job.id)

    def run_ingestion(self, book_id: int, job_id: int) -> None:
        """Background entrypoint — opens its own DB session."""
        with SessionLocal() as db:
            book = self.repo.get_book(db, book_id)
            job = self.repo.get_job(db, job_id)
            if book is None or job is None:
                return
            try:
                self._ingest(db, book, job)
            except Exception as exc:  # noqa: BLE001
                book.status = "failed"
                job.state = "failed"
                job.error = str(exc)
                job.stage_message = "Ingestion failed"
                job.pct = 100
                job.finished_at = datetime.utcnow()
                db.commit()

    def _ingest(self, db: Session, book: Book, job: IngestionJob) -> None:
        pdf_path = self._pdf_path(book.storage_key)
        if not pdf_path.exists():
            raise FileNotFoundError(f"Stored PDF missing: {book.storage_key}")

        self._set_progress(db, book, job, state="parsing", pct=15, message="Detecting PDF kind…")
        pages = extract_pdf_pages(str(pdf_path))
        if not pages:
            raise ValueError("PDF has no pages.")

        kind = detect_kind(pages, forced=book.kind if book.kind in {"text", "scanned"} else None)
        book.kind = kind
        need_ocr = kind == "scanned"

        ocr_scores: list[float] = []
        if need_ocr:
            self._set_progress(db, book, job, state="ocr", pct=35, message="Running OCR on scanned pages…")
            ocr = get_ocr_provider()
            rebuilt: list[BookPage] = []
            current_chapter = "Introduction"
            for extracted in pages:
                png = render_page_png(str(pdf_path), extracted.page_index)
                text, conf = ocr.ocr_page_image(png, page_index=extracted.page_index)
                ocr_scores.append(conf)
                time.sleep(0.01)
                chapter = infer_chapter(text, current_chapter)
                if chapter:
                    current_chapter = chapter
                rebuilt.append(
                    BookPage(
                        book_id=book.id,
                        page_index=extracted.page_index,
                        chapter=current_chapter,
                        text=text,
                    )
                )
                pct = 35 + int((extracted.page_index + 1) / max(len(pages), 1) * 35)
                self._set_progress(
                    db,
                    book,
                    job,
                    state="ocr",
                    pct=min(pct, 70),
                    message=f"OCR page {extracted.page_index + 1}/{len(pages)}",
                )
            page_rows = rebuilt
            book.ocr_confidence = round(sum(ocr_scores) / len(ocr_scores), 1) if ocr_scores else None
        else:
            self._set_progress(db, book, job, state="parsing", pct=45, message="Extracting text pages…")
            page_rows = [
                BookPage(
                    book_id=book.id,
                    page_index=page.page_index,
                    chapter=page.chapter,
                    text=page.text,
                )
                for page in pages
            ]
            book.ocr_confidence = None

        self.repo.replace_pages(db, book.id, page_rows)
        db.flush()

        self._set_progress(db, book, job, state="embedding", pct=80, message="Chunking and embedding…")
        text_chunks = chunk_pages([(page.page_index, page.chapter, page.text) for page in page_rows])
        embedder = get_embedding_provider()
        vectors = embedder.embed([chunk.text for chunk in text_chunks]) if text_chunks else []
        chunk_rows: list[BookChunk] = []
        for index, chunk in enumerate(text_chunks):
            blob = packing_bytes(vectors[index]) if index < len(vectors) else None
            chunk_rows.append(
                BookChunk(
                    book_id=book.id,
                    page_index=chunk.page_index,
                    chapter=chunk.chapter,
                    ord=chunk.ord,
                    text=chunk.text,
                    char_start=chunk.char_start,
                    char_end=chunk.char_end,
                    token_count=chunk.token_count,
                    embedding=blob,
                )
            )
        self.repo.replace_chunks(db, book.id, chunk_rows)
        db.flush()

        full_text = "\n\n".join(page.text for page in page_rows)
        book.page_count = len(page_rows)
        book.token_count = estimate_tokens(full_text)
        book.chunk_count = len(chunk_rows)

        chapters = []
        seen = set()
        for page in page_rows:
            if page.chapter and page.chapter not in seen:
                seen.add(page.chapter)
                chapters.append(page.chapter)
        suggestions = [
            f"What is the main idea of {chapters[0]}?" if chapters else "What is this book about?",
            "Summarise the key takeaways.",
            f"What does the author say in {chapters[min(1, len(chapters)-1)]}?" if chapters else "List the important points.",
        ][:3]
        self.repo.replace_suggestions(db, book.id, suggestions)

        book.status = "ready"
        job.state = "ready"
        job.pct = 100
        job.stage_message = "Ready"
        job.error = None
        job.finished_at = datetime.utcnow()
        db.commit()

    def _set_progress(
        self,
        db: Session,
        book: Book,
        job: IngestionJob,
        *,
        state: str,
        pct: int,
        message: str,
    ) -> None:
        book.status = state if state != "uploading" else book.status
        if state in {"parsing", "ocr", "embedding", "queued"}:
            book.status = state
        job.state = state
        job.pct = pct
        job.stage_message = message
        db.commit()

    def get_job(self, db: Session, job_id: int) -> IngestionJobResponse:
        job = self.repo.get_job(db, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found")
        book = self.repo.get_book(db, job.book_id)
        report = None
        if book and job.state == "ready":
            report = IngestionReport(
                pages=book.page_count,
                chunks=book.chunk_count,
                tokens=book.token_count,
                ocr_confidence=book.ocr_confidence,
            )
        return IngestionJobResponse(
            id=job.id,
            book_id=job.book_id,
            state=job.state,
            pct=job.pct,
            stage=job.stage_message,
            error=job.error,
            report=report,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )

    def list_shelf(self, db: Session) -> list[BookShelfItem]:
        items: list[BookShelfItem] = []
        for book in self.repo.list_books(db):
            if book.status == "ready" and book.page_count > 0:
                progress_row = self.repo.get_progress(db, book.id)
                page_index = progress_row.page_index if progress_row else 0
                progress = int(round(((page_index + 1) / book.page_count) * 100))
            elif book.status == "failed":
                progress = 0
            else:
                job = self.repo.latest_job(db, book.id)
                progress = job.pct if job else 0
            items.append(
                BookShelfItem(
                    id=book.id,
                    title=book.title,
                    author=book.author,
                    subtitle=book.subtitle,
                    tag=book.tag,
                    spine_color=book.spine_color,
                    kind=book.kind,  # type: ignore[arg-type]
                    status=book.status,
                    page_count=book.page_count,
                    chunk_count=book.chunk_count,
                    token_count=book.token_count,
                    ocr_confidence=book.ocr_confidence,
                    created_at=book.created_at,
                    progress_pct=min(max(progress, 0), 100),
                )
            )
        return items

    def get_book(self, db: Session, book_id: int) -> BookDetailResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        pages = self.repo.list_pages(db, book_id)
        toc: list[TocEntry] = []
        seen: set[str] = set()
        for page in pages:
            if page.chapter and page.chapter not in seen:
                seen.add(page.chapter)
                toc.append(TocEntry(chapter=page.chapter, page_index=page.page_index))
        suggestions = [row.question for row in self.repo.list_suggestions(db, book_id)]
        report = None
        if book.status == "ready":
            report = IngestionReport(
                pages=book.page_count,
                chunks=book.chunk_count,
                tokens=book.token_count,
                ocr_confidence=book.ocr_confidence,
            )
        return BookDetailResponse(
            id=book.id,
            title=book.title,
            author=book.author,
            subtitle=book.subtitle,
            tag=book.tag,
            spine_color=book.spine_color,
            kind=book.kind,  # type: ignore[arg-type]
            status=book.status,
            page_count=book.page_count,
            chunk_count=book.chunk_count,
            token_count=book.token_count,
            ocr_confidence=book.ocr_confidence,
            source_filename=book.source_filename,
            created_at=book.created_at,
            toc=toc,
            suggestions=suggestions,
            report=report,
        )

    def rename_book(self, db: Session, book_id: int, payload: BookRenameRequest) -> BookDetailResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        book.title = payload.title.strip()
        db.commit()
        return self.get_book(db, book_id)

    def delete_book(self, db: Session, book_id: int) -> dict[str, bool]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        book_dir = self.books_root() / str(book_id)
        self.repo.delete_book(db, book)
        db.commit()
        if book_dir.exists():
            shutil.rmtree(book_dir, ignore_errors=True)
        return {"ok": True}

    def list_pages(
        self,
        db: Session,
        book_id: int,
        *,
        page_from: int | None = None,
        page_to: int | None = None,
    ) -> list[BookPageResponse]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        pages = self.repo.list_pages(db, book_id)
        items: list[BookPageResponse] = []
        for page in pages:
            if page_from is not None and page.page_index < page_from:
                continue
            if page_to is not None and page.page_index > page_to:
                continue
            items.append(BookPageResponse(page_index=page.page_index, chapter=page.chapter, text=page.text))
        return items

    def get_progress(self, db: Session, book_id: int) -> ReadingProgressResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        row = self.repo.get_progress(db, book_id)
        return ReadingProgressResponse(
            book_id=book_id,
            page_index=row.page_index if row else 0,
            updated_at=row.updated_at if row else None,
        )

    def set_progress(self, db: Session, book_id: int, payload: ReadingProgressUpdate) -> ReadingProgressResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        max_index = max(book.page_count - 1, 0)
        page_index = min(max(payload.page_index, 0), max_index)
        row = self.repo.upsert_progress(db, book_id, page_index)
        db.commit()
        return ReadingProgressResponse(book_id=book_id, page_index=row.page_index, updated_at=row.updated_at)

    def list_bookmarks(self, db: Session, book_id: int) -> list[BookBookmarkResponse]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        return [
            BookBookmarkResponse(
                id=row.id,
                book_id=row.book_id,
                page_index=row.page_index,
                label=row.label,
                created_at=row.created_at,
            )
            for row in self.repo.list_bookmarks(db, book_id)
        ]

    def add_bookmark(self, db: Session, book_id: int, payload: BookBookmarkCreate) -> BookBookmarkResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        existing = self.repo.get_bookmark_at_page(db, book_id, payload.page_index)
        if existing:
            return BookBookmarkResponse(
                id=existing.id,
                book_id=existing.book_id,
                page_index=existing.page_index,
                label=existing.label,
                created_at=existing.created_at,
            )
        label = payload.label.strip()
        if not label:
            pages = self.repo.list_pages(db, book_id)
            page = next((p for p in pages if p.page_index == payload.page_index), None)
            label = page.chapter if page and page.chapter else f"Page {payload.page_index + 1}"
        row = self.repo.create_bookmark(
            db,
            BookBookmark(book_id=book_id, page_index=payload.page_index, label=label),
        )
        db.commit()
        return BookBookmarkResponse(
            id=row.id,
            book_id=row.book_id,
            page_index=row.page_index,
            label=row.label,
            created_at=row.created_at,
        )

    def remove_bookmark(self, db: Session, book_id: int, bookmark_id: int) -> dict[str, bool]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        row = self.repo.get_bookmark(db, bookmark_id)
        if row is None or row.book_id != book_id:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        self.repo.delete_bookmark(db, row)
        db.commit()
        return {"ok": True}

    def toggle_bookmark(self, db: Session, book_id: int, page_index: int) -> dict:
        existing = self.repo.get_bookmark_at_page(db, book_id, page_index)
        if existing:
            self.repo.delete_bookmark(db, existing)
            db.commit()
            return {"bookmarked": False}
        created = self.add_bookmark(db, book_id, BookBookmarkCreate(page_index=page_index))
        return {"bookmarked": True, "bookmark": created}

    def list_highlights(self, db: Session, book_id: int) -> list[BookHighlightResponse]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        return [
            BookHighlightResponse(
                id=row.id,
                book_id=row.book_id,
                page_index=row.page_index,
                start_offset=row.start_offset,
                end_offset=row.end_offset,
                quote=row.quote,
                color=row.color,
                created_at=row.created_at,
            )
            for row in self.repo.list_highlights(db, book_id)
        ]

    def add_highlight(self, db: Session, book_id: int, payload: BookHighlightCreate) -> BookHighlightResponse:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        if payload.end_offset <= payload.start_offset:
            raise HTTPException(status_code=400, detail="end_offset must be greater than start_offset")
        quote = payload.quote.strip()
        if not quote:
            raise HTTPException(status_code=400, detail="Highlight quote is required")
        row = self.repo.create_highlight(
            db,
            BookHighlight(
                book_id=book_id,
                page_index=payload.page_index,
                start_offset=payload.start_offset,
                end_offset=payload.end_offset,
                quote=quote,
                color=payload.color or "#EA9D00",
            ),
        )
        db.commit()
        return BookHighlightResponse(
            id=row.id,
            book_id=row.book_id,
            page_index=row.page_index,
            start_offset=row.start_offset,
            end_offset=row.end_offset,
            quote=row.quote,
            color=row.color,
            created_at=row.created_at,
        )

    def remove_highlight(self, db: Session, book_id: int, highlight_id: int) -> dict[str, bool]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        row = self.repo.get_highlight(db, highlight_id)
        if row is None or row.book_id != book_id:
            raise HTTPException(status_code=404, detail="Highlight not found")
        self.repo.delete_highlight(db, row)
        db.commit()
        return {"ok": True}

    def search_book(self, db: Session, book_id: int, query: str, *, limit: int = 40) -> list[BookSearchHit]:
        book = self.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        needle = query.strip()
        if not needle:
            return []
        needle_lower = needle.lower()
        hits: list[BookSearchHit] = []
        for page in self.repo.list_pages(db, book_id):
            text = page.text or ""
            lower = text.lower()
            start = 0
            while True:
                idx = lower.find(needle_lower, start)
                if idx < 0:
                    break
                left = max(0, idx - 40)
                right = min(len(text), idx + len(needle) + 60)
                snippet = text[left:right].replace("\n", " ").strip()
                if left > 0:
                    snippet = "…" + snippet
                if right < len(text):
                    snippet = snippet + "…"
                hits.append(
                    BookSearchHit(
                        page_index=page.page_index,
                        chapter=page.chapter,
                        snippet=snippet,
                        match_offset=idx,
                    )
                )
                if len(hits) >= limit:
                    return hits
                start = idx + max(len(needle), 1)
        return hits

    def ensure_chunks(self, db: Session, book_id: int) -> list[BookChunk]:
        """Rebuild embeddings if a ready book somehow has no chunks (e.g. pre-S10c)."""
        existing = self.repo.list_chunks(db, book_id)
        if existing:
            return existing
        pages = self.repo.list_pages(db, book_id)
        text_chunks = chunk_pages([(page.page_index, page.chapter, page.text) for page in pages])
        embedder = get_embedding_provider()
        vectors = embedder.embed([chunk.text for chunk in text_chunks]) if text_chunks else []
        rows: list[BookChunk] = []
        for index, chunk in enumerate(text_chunks):
            rows.append(
                BookChunk(
                    book_id=book_id,
                    page_index=chunk.page_index,
                    chapter=chunk.chapter,
                    ord=chunk.ord,
                    text=chunk.text,
                    char_start=chunk.char_start,
                    char_end=chunk.char_end,
                    token_count=chunk.token_count,
                    embedding=packing_bytes(vectors[index]) if index < len(vectors) else None,
                )
            )
        self.repo.replace_chunks(db, book_id, rows)
        book = self.repo.get_book(db, book_id)
        if book is not None:
            book.chunk_count = len(rows)
        db.commit()
        return rows
