from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

EMBED_DIM = 1536


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    author: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    subtitle: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    tag: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    spine_color: Mapped[str] = mapped_column(String(16), nullable=False, default="#3C2CDA")
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="text")
    source_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pages = relationship("BookPage", back_populates="book", cascade="all, delete-orphan")
    chunks = relationship("BookChunk", back_populates="book", cascade="all, delete-orphan")
    suggestions = relationship(
        "BookSuggestion", back_populates="book", cascade="all, delete-orphan"
    )
    jobs = relationship("IngestionJob", back_populates="book", cascade="all, delete-orphan")


class BookPage(Base):
    __tablename__ = "book_pages"
    __table_args__ = (UniqueConstraint("book_id", "page_index", name="uq_book_page"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    book = relationship("Book", back_populates="pages")


class BookChunk(Base):
    __tablename__ = "book_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="CASCADE"), index=True
    )
    page_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    chapter: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    ord: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding = mapped_column(Vector(EMBED_DIM), nullable=True)

    book = relationship("Book", back_populates="chunks")


class BookSuggestion(Base):
    __tablename__ = "book_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text, nullable=False)

    book = relationship("Book", back_populates="suggestions")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stage_message: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    book = relationship("Book", back_populates="jobs")


class ReadingProgress(Base):
    __tablename__ = "reading_progress"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_reading_progress"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    page_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BookBookmark(Base):
    __tablename__ = "book_bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "book_id", "page_index", name="uq_book_bookmark"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)


class BookHighlight(Base):
    __tablename__ = "book_highlights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
