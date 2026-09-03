"""Book-scoped RAG: retrieve chunks, stream grounded answers with citations."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.domain.chunking import best_quote_sentence
from app.models.library import BookChunk
from app.providers.ai import ChatProvider, get_chat_provider
from app.providers.embeddings import EmbeddingProvider, get_embedding_provider
from app.providers.vector_store import VectorHit, VectorStore, get_vector_store
from app.services.ai import RateLimiter, _rate_limiter
from app.services.library import LibraryService

BOOK_SYSTEM_PROMPT = (
    "You are a careful reading assistant for a single book. "
    "Answer only from the provided passages. Keep replies under 160 words. "
    "When you lean on a passage, mention its page like p.N. "
    "If the passages do not contain enough evidence, say so briefly."
)


class BookRAGService:
    def __init__(
        self,
        *,
        library: LibraryService | None = None,
        embedder: EmbeddingProvider | None = None,
        store: VectorStore | None = None,
        chat: ChatProvider | None = None,
        rate_limiter: RateLimiter | None = None,
    ) -> None:
        self.library = library or LibraryService()
        self.embedder = embedder or get_embedding_provider()
        self.store = store or get_vector_store()
        self.chat = chat or get_chat_provider()
        self.rate_limiter = rate_limiter or _rate_limiter

    def _require_book(self, db: Session, book_id: int):
        book = self.library.repo.get_book(db, book_id)
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")
        if book.status != "ready":
            raise HTTPException(status_code=409, detail="Book is not ready for Ask yet.")
        return book

    def _cites_from_hits(self, hits: list[VectorHit]) -> list[dict]:
        cites: list[dict] = []
        seen_pages: set[int] = set()
        for hit in hits:
            if hit.page_index in seen_pages:
                continue
            seen_pages.add(hit.page_index)
            quote, local_start, local_end = best_quote_sentence(hit.text)
            if not quote:
                quote = hit.text[:180].strip()
                local_start, local_end = 0, len(quote)
            # Map chunk-local quote offsets onto page-local char ranges.
            char_start = hit.char_start + local_start
            char_end = hit.char_start + local_end
            cites.append(
                {
                    "page_index": hit.page_index,
                    "chapter": hit.chapter,
                    "quote": quote,
                    "char_start": char_start,
                    "char_end": char_end,
                }
            )
        return cites

    def _hits_from_chunks(self, chunks: list[BookChunk], *, score: float = 1.0) -> list[VectorHit]:
        return [
            VectorHit(
                chunk_id=chunk.id,
                book_id=chunk.book_id,
                page_index=chunk.page_index,
                chapter=chunk.chapter,
                text=chunk.text,
                char_start=chunk.char_start,
                char_end=chunk.char_end,
                score=score,
            )
            for chunk in chunks
        ]

    def retrieve_for_question(self, db: Session, book_id: int, question: str, *, top_k: int = 4) -> list[VectorHit]:
        self.library.ensure_chunks(db, book_id)
        query_vec = self.embedder.embed([question])[0]
        hits = self.store.search(db, book_id=book_id, query_vector=query_vec, top_k=top_k)
        if hits:
            return hits
        # Fallback: nearest available chunks by page order.
        chunks = self.library.repo.list_chunks(db, book_id)[:top_k]
        return self._hits_from_chunks(chunks, score=0.0)

    def retrieve_page(self, db: Session, book_id: int, page_index: int) -> list[VectorHit]:
        self.library.ensure_chunks(db, book_id)
        chunks = self.library.repo.list_chunks_for_page(db, book_id, page_index)
        if not chunks:
            pages = self.library.repo.list_pages(db, book_id)
            page = next((row for row in pages if row.page_index == page_index), None)
            if page is None:
                raise HTTPException(status_code=404, detail="Page not found")
            return [
                VectorHit(
                    chunk_id=0,
                    book_id=book_id,
                    page_index=page.page_index,
                    chapter=page.chapter,
                    text=page.text,
                    char_start=0,
                    char_end=len(page.text or ""),
                    score=1.0,
                )
            ]
        return self._hits_from_chunks(chunks)

    def retrieve_chapter(self, db: Session, book_id: int, *, page_index: int | None, chapter: str | None) -> list[VectorHit]:
        self.library.ensure_chunks(db, book_id)
        chapter_name = (chapter or "").strip()
        if not chapter_name and page_index is not None:
            pages = self.library.repo.list_pages(db, book_id)
            page = next((row for row in pages if row.page_index == page_index), None)
            if page is None:
                raise HTTPException(status_code=404, detail="Page not found")
            chapter_name = page.chapter
        if not chapter_name:
            raise HTTPException(status_code=400, detail="chapter or page_index is required")
        chunks = self.library.repo.list_chunks_for_chapter(db, book_id, chapter_name)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks for that chapter")
        return self._hits_from_chunks(chunks[:8])

    def retrieve_book_overview(self, db: Session, book_id: int) -> list[VectorHit]:
        self.library.ensure_chunks(db, book_id)
        chunks = self.library.repo.list_chunks(db, book_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks available")
        # First chunk of each chapter, capped.
        seen: set[str] = set()
        picked: list[BookChunk] = []
        for chunk in chunks:
            key = chunk.chapter or f"page-{chunk.page_index}"
            if key in seen:
                continue
            seen.add(key)
            picked.append(chunk)
            if len(picked) >= 8:
                break
        return self._hits_from_chunks(picked)

    def build_prompt(self, *, title: str, question: str, hits: list[VectorHit], weak: bool) -> str:
        lines = [f"Book: {title}", "Passages:"]
        for hit in hits:
            lines.append(
                f"[p.{hit.page_index + 1} | {hit.chapter or '—'} | score={hit.score:.2f}]\n{hit.text}"
            )
        lines.append("")
        if weak:
            lines.append(
                "Note: retrieval was weak — if passages are only loosely related, "
                "start with a short caveat that you could not find a direct passage."
            )
        lines.append(f"Question: {question.strip()}")
        return "\n".join(lines)

    async def stream_ask(
        self,
        db: Session,
        request: Request,
        *,
        book_id: int,
        question: str,
        top_k: int = 4,
        user_id: int = 1,
    ) -> AsyncIterator[str]:
        if not question.strip():
            raise HTTPException(status_code=400, detail="Question is required")
        book = self._require_book(db, book_id)
        hits = self.retrieve_for_question(db, book_id, question, top_k=top_k)
        weak = not hits or all(hit.score <= 0.05 for hit in hits)
        async for event in self._stream(
            db,
            request,
            book_title=book.title,
            question=question,
            hits=hits,
            weak=weak,
            user_id=user_id,
        ):
            yield event

    async def stream_explain_page(
        self,
        db: Session,
        request: Request,
        *,
        book_id: int,
        page_index: int,
        user_id: int = 1,
    ) -> AsyncIterator[str]:
        book = self._require_book(db, book_id)
        hits = self.retrieve_page(db, book_id, page_index)
        question = f"Explain page {page_index + 1} in plain language."
        async for event in self._stream(
            db,
            request,
            book_title=book.title,
            question=question,
            hits=hits,
            weak=False,
            user_id=user_id,
        ):
            yield event

    async def stream_summarize_chapter(
        self,
        db: Session,
        request: Request,
        *,
        book_id: int,
        page_index: int | None,
        chapter: str | None,
        user_id: int = 1,
    ) -> AsyncIterator[str]:
        book = self._require_book(db, book_id)
        hits = self.retrieve_chapter(db, book_id, page_index=page_index, chapter=chapter)
        label = hits[0].chapter if hits else (chapter or "this chapter")
        question = f"Summarize the chapter “{label}”."
        async for event in self._stream(
            db,
            request,
            book_title=book.title,
            question=question,
            hits=hits,
            weak=False,
            user_id=user_id,
        ):
            yield event

    async def stream_summarize_book(
        self,
        db: Session,
        request: Request,
        *,
        book_id: int,
        user_id: int = 1,
    ) -> AsyncIterator[str]:
        book = self._require_book(db, book_id)
        hits = self.retrieve_book_overview(db, book_id)
        question = "Summarize the whole book at a high level."
        async for event in self._stream(
            db,
            request,
            book_title=book.title,
            question=question,
            hits=hits,
            weak=False,
            user_id=user_id,
        ):
            yield event

    async def _stream(
        self,
        db: Session,
        request: Request,
        *,
        book_title: str,
        question: str,
        hits: list[VectorHit],
        weak: bool,
        user_id: int,
    ) -> AsyncIterator[str]:
        self.rate_limiter.acquire(user_id)
        cancel = asyncio.Event()
        try:
            retrieved = [
                {
                    "chunk_id": hit.chunk_id,
                    "page_index": hit.page_index,
                    "chapter": hit.chapter,
                    "score": round(hit.score, 4),
                }
                for hit in hits
            ]
            yield _sse(
                {
                    "type": "meta",
                    "retrieved": retrieved,
                    "provider": type(self.chat).__name__,
                }
            )

            grounded = self.build_prompt(title=book_title, question=question, hits=hits, weak=weak)
            async for token in self.chat.stream_chat(
                system=BOOK_SYSTEM_PROMPT,
                user=grounded,
                cancel=cancel,
            ):
                if await request.is_disconnected():
                    cancel.set()
                    yield _sse({"type": "cancelled"})
                    return
                yield _sse({"type": "token", "text": token})

            yield _sse({"type": "cites", "cites": self._cites_from_hits(hits)})
            yield _sse({"type": "done", "finish": "stop"})
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            cancel.set()
            self.rate_limiter.release(user_id)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
