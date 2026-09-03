from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

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

DEFAULT_USER_ID = 1


class LibraryRepository:
    def list_books(self, db: Session) -> list[Book]:
        statement = select(Book).order_by(desc(Book.created_at), desc(Book.id))
        return list(db.scalars(statement))

    def get_book(self, db: Session, book_id: int) -> Book | None:
        return db.get(Book, book_id)

    def create_book(self, db: Session, book: Book) -> Book:
        db.add(book)
        db.flush()
        db.refresh(book)
        return book

    def delete_book(self, db: Session, book: Book) -> None:
        db.delete(book)

    def create_job(self, db: Session, job: IngestionJob) -> IngestionJob:
        db.add(job)
        db.flush()
        db.refresh(job)
        return job

    def get_job(self, db: Session, job_id: int) -> IngestionJob | None:
        return db.get(IngestionJob, job_id)

    def latest_job(self, db: Session, book_id: int) -> IngestionJob | None:
        statement = (
            select(IngestionJob)
            .where(IngestionJob.book_id == book_id)
            .order_by(desc(IngestionJob.id))
            .limit(1)
        )
        return db.scalar(statement)

    def replace_pages(self, db: Session, book_id: int, pages: list[BookPage]) -> None:
        db.execute(delete(BookPage).where(BookPage.book_id == book_id))
        for page in pages:
            db.add(page)

    def list_pages(self, db: Session, book_id: int) -> list[BookPage]:
        statement = (
            select(BookPage)
            .where(BookPage.book_id == book_id)
            .order_by(BookPage.page_index.asc())
        )
        return list(db.scalars(statement))

    def replace_suggestions(self, db: Session, book_id: int, questions: list[str]) -> None:
        db.execute(delete(BookSuggestion).where(BookSuggestion.book_id == book_id))
        for question in questions:
            db.add(BookSuggestion(book_id=book_id, question=question))

    def list_suggestions(self, db: Session, book_id: int) -> list[BookSuggestion]:
        statement = select(BookSuggestion).where(BookSuggestion.book_id == book_id).order_by(BookSuggestion.id.asc())
        return list(db.scalars(statement))

    def get_progress(self, db: Session, book_id: int, *, user_id: int = DEFAULT_USER_ID) -> ReadingProgress | None:
        statement = select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.user_id == user_id,
        )
        return db.scalar(statement)

    def upsert_progress(
        self,
        db: Session,
        book_id: int,
        page_index: int,
        *,
        user_id: int = DEFAULT_USER_ID,
    ) -> ReadingProgress:
        row = self.get_progress(db, book_id, user_id=user_id)
        if row is None:
            row = ReadingProgress(user_id=user_id, book_id=book_id, page_index=page_index)
            db.add(row)
        else:
            row.page_index = page_index
            row.updated_at = datetime.utcnow()
        db.flush()
        db.refresh(row)
        return row

    def list_bookmarks(self, db: Session, book_id: int, *, user_id: int = DEFAULT_USER_ID) -> list[BookBookmark]:
        statement = (
            select(BookBookmark)
            .where(BookBookmark.book_id == book_id, BookBookmark.user_id == user_id)
            .order_by(BookBookmark.page_index.asc(), BookBookmark.id.asc())
        )
        return list(db.scalars(statement))

    def get_bookmark(self, db: Session, bookmark_id: int) -> BookBookmark | None:
        return db.get(BookBookmark, bookmark_id)

    def get_bookmark_at_page(
        self,
        db: Session,
        book_id: int,
        page_index: int,
        *,
        user_id: int = DEFAULT_USER_ID,
    ) -> BookBookmark | None:
        statement = select(BookBookmark).where(
            BookBookmark.book_id == book_id,
            BookBookmark.user_id == user_id,
            BookBookmark.page_index == page_index,
        )
        return db.scalar(statement)

    def create_bookmark(self, db: Session, bookmark: BookBookmark) -> BookBookmark:
        db.add(bookmark)
        db.flush()
        db.refresh(bookmark)
        return bookmark

    def delete_bookmark(self, db: Session, bookmark: BookBookmark) -> None:
        db.delete(bookmark)

    def list_highlights(self, db: Session, book_id: int, *, user_id: int = DEFAULT_USER_ID) -> list[BookHighlight]:
        statement = (
            select(BookHighlight)
            .where(BookHighlight.book_id == book_id, BookHighlight.user_id == user_id)
            .order_by(BookHighlight.page_index.asc(), BookHighlight.start_offset.asc(), BookHighlight.id.asc())
        )
        return list(db.scalars(statement))

    def get_highlight(self, db: Session, highlight_id: int) -> BookHighlight | None:
        return db.get(BookHighlight, highlight_id)

    def create_highlight(self, db: Session, highlight: BookHighlight) -> BookHighlight:
        db.add(highlight)
        db.flush()
        db.refresh(highlight)
        return highlight

    def delete_highlight(self, db: Session, highlight: BookHighlight) -> None:
        db.delete(highlight)

    def replace_chunks(self, db: Session, book_id: int, chunks: list[BookChunk]) -> None:
        db.execute(delete(BookChunk).where(BookChunk.book_id == book_id))
        for chunk in chunks:
            db.add(chunk)

    def list_chunks(self, db: Session, book_id: int) -> list[BookChunk]:
        statement = (
            select(BookChunk)
            .where(BookChunk.book_id == book_id)
            .order_by(BookChunk.page_index.asc(), BookChunk.ord.asc(), BookChunk.id.asc())
        )
        return list(db.scalars(statement))

    def list_chunks_for_page(self, db: Session, book_id: int, page_index: int) -> list[BookChunk]:
        statement = (
            select(BookChunk)
            .where(BookChunk.book_id == book_id, BookChunk.page_index == page_index)
            .order_by(BookChunk.ord.asc(), BookChunk.id.asc())
        )
        return list(db.scalars(statement))

    def list_chunks_for_chapter(self, db: Session, book_id: int, chapter: str) -> list[BookChunk]:
        statement = (
            select(BookChunk)
            .where(BookChunk.book_id == book_id, BookChunk.chapter == chapter)
            .order_by(BookChunk.page_index.asc(), BookChunk.ord.asc())
        )
        return list(db.scalars(statement))

    def chunk_count(self, db: Session, book_id: int) -> int:
        return len(self.list_chunks(db, book_id))
