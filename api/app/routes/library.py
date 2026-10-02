from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.library import (
    BookAskRequest,
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
    ExplainPageRequest,
    IngestionJobResponse,
    ReadingProgressResponse,
    ReadingProgressUpdate,
    SummarizeChapterRequest,
)
from app.services.book_rag import BookRAGService
from app.services.library import LibraryService

router = APIRouter(tags=["library"])
service = LibraryService()
rag = BookRAGService(library=service)

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}

@router.post("/library/books/upload", response_model=BookUploadResponse)
async def upload_book(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    kind: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> BookUploadResponse:
    result = await service.upload_book(db, file, kind=kind)
    background_tasks.add_task(service.run_ingestion, result.book_id, result.job_id)
    return result


@router.get("/library/jobs/{job_id}", response_model=IngestionJobResponse)
def get_ingestion_job(job_id: int, db: Session = Depends(get_db)) -> IngestionJobResponse:
    return service.get_job(db, job_id)


@router.get("/library/books", response_model=list[BookShelfItem])
def list_books(db: Session = Depends(get_db)) -> list[BookShelfItem]:
    return service.list_shelf(db)


@router.get("/library/books/{book_id}", response_model=BookDetailResponse)
def get_book(book_id: int, db: Session = Depends(get_db)) -> BookDetailResponse:
    return service.get_book(db, book_id)


@router.patch("/library/books/{book_id}", response_model=BookDetailResponse)
def rename_book(book_id: int, payload: BookRenameRequest, db: Session = Depends(get_db)) -> BookDetailResponse:
    return service.rename_book(db, book_id, payload)


@router.delete("/library/books/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.delete_book(db, book_id)


@router.get("/library/books/{book_id}/pages", response_model=list[BookPageResponse])
def list_book_pages(
    book_id: int,
    page_from: int | None = Query(default=None, alias="from"),
    page_to: int | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> list[BookPageResponse]:
    return service.list_pages(db, book_id, page_from=page_from, page_to=page_to)


@router.get("/library/books/{book_id}/progress", response_model=ReadingProgressResponse)
def get_progress(book_id: int, db: Session = Depends(get_db)) -> ReadingProgressResponse:
    return service.get_progress(db, book_id)


@router.put("/library/books/{book_id}/progress", response_model=ReadingProgressResponse)
def set_progress(
    book_id: int,
    payload: ReadingProgressUpdate,
    db: Session = Depends(get_db),
) -> ReadingProgressResponse:
    return service.set_progress(db, book_id, payload)


@router.get("/library/books/{book_id}/bookmarks", response_model=list[BookBookmarkResponse])
def list_bookmarks(book_id: int, db: Session = Depends(get_db)) -> list[BookBookmarkResponse]:
    return service.list_bookmarks(db, book_id)


@router.post("/library/books/{book_id}/bookmarks", response_model=BookBookmarkResponse)
def add_bookmark(
    book_id: int,
    payload: BookBookmarkCreate,
    db: Session = Depends(get_db),
) -> BookBookmarkResponse:
    return service.add_bookmark(db, book_id, payload)


@router.delete("/library/books/{book_id}/bookmarks/{bookmark_id}")
def remove_bookmark(book_id: int, bookmark_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.remove_bookmark(db, book_id, bookmark_id)


@router.post("/library/books/{book_id}/bookmarks/toggle")
def toggle_bookmark(
    book_id: int,
    page_index: int = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    return service.toggle_bookmark(db, book_id, page_index)


@router.get("/library/books/{book_id}/highlights", response_model=list[BookHighlightResponse])
def list_highlights(book_id: int, db: Session = Depends(get_db)) -> list[BookHighlightResponse]:
    """List highlights for a book (also used as export payload)."""
    return service.list_highlights(db, book_id)


@router.post("/library/books/{book_id}/highlights", response_model=BookHighlightResponse)
def add_highlight(
    book_id: int,
    payload: BookHighlightCreate,
    db: Session = Depends(get_db),
) -> BookHighlightResponse:
    return service.add_highlight(db, book_id, payload)


@router.delete("/library/books/{book_id}/highlights/{highlight_id}")
def remove_highlight(book_id: int, highlight_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    return service.remove_highlight(db, book_id, highlight_id)


@router.get("/library/books/{book_id}/search", response_model=list[BookSearchHit])
def search_book(
    book_id: int,
    q: str = Query(default="", min_length=0),
    db: Session = Depends(get_db),
) -> list[BookSearchHit]:
    return service.search_book(db, book_id, q)


@router.post("/library/books/{book_id}/ask")
async def ask_book(
    book_id: int,
    payload: BookAskRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        rag.stream_ask(
            db,
            request,
            book_id=book_id,
            question=payload.question,
            top_k=payload.top_k,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/library/books/{book_id}/explain-page")
async def explain_page(
    book_id: int,
    payload: ExplainPageRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        rag.stream_explain_page(db, request, book_id=book_id, page_index=payload.page_index),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/library/books/{book_id}/summarize-chapter")
async def summarize_chapter(
    book_id: int,
    payload: SummarizeChapterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        rag.stream_summarize_chapter(
            db,
            request,
            book_id=book_id,
            page_index=payload.page_index,
            chapter=payload.chapter,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/library/books/{book_id}/summarize-book")
async def summarize_book(
    book_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        rag.stream_summarize_book(db, request, book_id=book_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
