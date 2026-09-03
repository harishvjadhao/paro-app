from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    author: Mapped[str] = mapped_column(String(180), nullable=False, default="", server_default="")
    subtitle: Mapped[str] = mapped_column(String(320), nullable=False, default="", server_default="")
    tag: Mapped[str] = mapped_column(String(80), nullable=False, default="Book", server_default="Book")
    spine_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#3C2CDA", server_default="#3C2CDA")
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="text", server_default="text")
    source_filename: Mapped[str] = mapped_column(String(260), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(400), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="queued", server_default="queued", index=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    pages: Mapped[list["BookPage"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    jobs: Mapped[list["IngestionJob"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    suggestions: Mapped[list["BookSuggestion"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    progress_rows: Mapped[list["ReadingProgress"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    bookmarks: Mapped[list["BookBookmark"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    highlights: Mapped[list["BookHighlight"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    chunks: Mapped[list["BookChunk"]] = relationship(back_populates="book", cascade="all, delete-orphan")


class BookPage(Base):
    __tablename__ = "book_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter: Mapped[str] = mapped_column(String(240), nullable=False, default="", server_default="")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    book: Mapped[Book] = relationship(back_populates="pages")


class BookChunk(Base):
    __tablename__ = "book_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter: Mapped[str] = mapped_column(String(240), nullable=False, default="", server_default="")
    ord: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    char_end: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    book: Mapped[Book] = relationship(back_populates="chunks")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(40), nullable=False, default="queued", server_default="queued")
    pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    stage_message: Mapped[str] = mapped_column(String(240), nullable=False, default="", server_default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    book: Mapped[Book] = relationship(back_populates="jobs")


class BookSuggestion(Base):
    __tablename__ = "book_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    question: Mapped[str] = mapped_column(String(400), nullable=False)

    book: Mapped[Book] = relationship(back_populates="suggestions")


class ReadingProgress(Base):
    __tablename__ = "reading_progress"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_reading_progress_user_book"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    page_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    book: Mapped[Book] = relationship(back_populates="progress_rows")


class BookBookmark(Base):
    __tablename__ = "book_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "book_id", "page_index", name="uq_book_bookmarks_user_book_page"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(240), nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    book: Mapped[Book] = relationship(back_populates="bookmarks")


class BookHighlight(Base):
    __tablename__ = "book_highlights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    end_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#EA9D00", server_default="#EA9D00")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    book: Mapped[Book] = relationship(back_populates="highlights")
