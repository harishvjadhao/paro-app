from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

BookKind = Literal["text", "scanned"]
BookStatus = Literal["queued", "parsing", "ocr", "embedding", "ready", "failed"]
JobState = Literal["queued", "uploading", "parsing", "ocr", "embedding", "ready", "failed"]


class BookUploadResponse(BaseModel):
    book_id: int
    job_id: int


class IngestionReport(BaseModel):
    pages: int
    chunks: int
    tokens: int
    ocr_confidence: float | None = None


class IngestionJobResponse(BaseModel):
    id: int
    book_id: int
    state: str
    pct: int
    stage: str
    error: str | None = None
    report: IngestionReport | None = None
    started_at: datetime
    finished_at: datetime | None = None


class BookShelfItem(BaseModel):
    id: int
    title: str
    author: str
    subtitle: str
    tag: str
    spine_color: str
    kind: BookKind
    status: str
    page_count: int
    chunk_count: int
    token_count: int
    ocr_confidence: float | None
    created_at: datetime
    progress_pct: int = 0


class BookRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=240)


class TocEntry(BaseModel):
    chapter: str
    page_index: int


class BookDetailResponse(BaseModel):
    id: int
    title: str
    author: str
    subtitle: str
    tag: str
    spine_color: str
    kind: BookKind
    status: str
    page_count: int
    chunk_count: int
    token_count: int
    ocr_confidence: float | None
    source_filename: str
    created_at: datetime
    toc: list[TocEntry]
    suggestions: list[str]
    report: IngestionReport | None = None


class BookPageResponse(BaseModel):
    page_index: int
    chapter: str
    text: str


class ReadingProgressResponse(BaseModel):
    book_id: int
    page_index: int
    updated_at: datetime | None = None


class ReadingProgressUpdate(BaseModel):
    page_index: int = Field(ge=0)


class BookBookmarkResponse(BaseModel):
    id: int
    book_id: int
    page_index: int
    label: str
    created_at: datetime


class BookBookmarkCreate(BaseModel):
    page_index: int = Field(ge=0)
    label: str = Field(default="", max_length=240)


class BookHighlightResponse(BaseModel):
    id: int
    book_id: int
    page_index: int
    start_offset: int
    end_offset: int
    quote: str
    color: str
    created_at: datetime


class BookHighlightCreate(BaseModel):
    page_index: int = Field(ge=0)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    quote: str = Field(min_length=1)
    color: str = Field(default="#EA9D00", max_length=20)


class BookSearchHit(BaseModel):
    page_index: int
    chapter: str
    snippet: str
    match_offset: int


class BookAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=12)


class ExplainPageRequest(BaseModel):
    page_index: int = Field(ge=0)


class SummarizeChapterRequest(BaseModel):
    page_index: int | None = Field(default=None, ge=0)
    chapter: str | None = Field(default=None, max_length=240)
