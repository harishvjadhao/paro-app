"""VectorStore interface — numpy/BLOB cosine today; sqlite-vec / pgvector later."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.library import BookChunk
from app.providers.embeddings import cosine_similarity, unpacking_bytes


@dataclass(frozen=True)
class VectorHit:
    chunk_id: int
    book_id: int
    page_index: int
    chapter: str
    text: str
    char_start: int
    char_end: int
    score: float


class VectorStore(ABC):
    @abstractmethod
    def search(
        self,
        db: Session,
        *,
        book_id: int,
        query_vector: np.ndarray,
        top_k: int = 4,
    ) -> list[VectorHit]:
        raise NotImplementedError


class NumpyBlobVectorStore(VectorStore):
    """Load book-scoped embedding BLOBs and rank by cosine similarity in Python."""

    def search(
        self,
        db: Session,
        *,
        book_id: int,
        query_vector: np.ndarray,
        top_k: int = 4,
    ) -> list[VectorHit]:
        rows = list(
            db.scalars(
                select(BookChunk)
                .where(BookChunk.book_id == book_id)
                .order_by(BookChunk.page_index.asc(), BookChunk.ord.asc())
            )
        )
        scored: list[VectorHit] = []
        for row in rows:
            vector = unpacking_bytes(row.embedding)
            if vector is None:
                continue
            score = cosine_similarity(query_vector, vector)
            scored.append(
                VectorHit(
                    chunk_id=row.id,
                    book_id=row.book_id,
                    page_index=row.page_index,
                    chapter=row.chapter,
                    text=row.text,
                    char_start=row.char_start,
                    char_end=row.char_end,
                    score=score,
                )
            )
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[: max(top_k, 1)]


def get_vector_store() -> VectorStore:
    """Prefer sqlite-vec when available; otherwise numpy/BLOB cosine."""
    try:
        import sqlite_vec  # type: ignore  # noqa: F401

        # Extension present but not wired for v1 schema — keep numpy path until we ship vec0 tables.
        return NumpyBlobVectorStore()
    except Exception:  # noqa: BLE001
        return NumpyBlobVectorStore()
