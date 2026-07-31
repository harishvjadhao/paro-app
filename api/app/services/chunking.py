"""Chunking + citation char-range helpers (pure)."""

from __future__ import annotations

from dataclasses import dataclass


def approx_tokens(text: str) -> int:
    # rough: ~4 chars/token
    return max(1, len(text) // 4)


@dataclass(frozen=True)
class TextChunk:
    text: str
    char_start: int
    char_end: int
    page_index: int
    chapter: str
    ord: int


def chunk_page_text(
    page_text: str,
    *,
    page_index: int,
    chapter: str = "",
    target_tokens: int = 750,
    overlap_ratio: float = 0.15,
) -> list[TextChunk]:
    """Split page into ~600–900 token chunks with ~15% overlap; map char ranges."""
    text = page_text or ""
    if not text.strip():
        return []
    target_chars = target_tokens * 4
    overlap_chars = int(target_chars * overlap_ratio)
    chunks: list[TextChunk] = []
    start = 0
    ord_i = 0
    n = len(text)
    while start < n:
        end = min(n, start + target_chars)
        # prefer break at whitespace
        if end < n:
            space = text.rfind(" ", start + target_chars // 2, end)
            if space > start:
                end = space
        piece = text[start:end]
        chunks.append(
            TextChunk(
                text=piece.strip(),
                char_start=start,
                char_end=end,
                page_index=page_index,
                chapter=chapter,
                ord=ord_i,
            )
        )
        if end >= n:
            break
        start = max(end - overlap_chars, start + 1)
        ord_i += 1
    return [c for c in chunks if c.text]


def quote_for_citation(page_text: str, char_start: int, char_end: int, max_len: int = 180) -> str:
    """Exact substring for flash-highlight; clamp to sentence-ish window."""
    snippet = page_text[char_start:char_end]
    if len(snippet) <= max_len:
        return snippet
    return snippet[: max_len - 1].rsplit(" ", 1)[0] + "…"


def find_char_range(page_text: str, quote: str) -> tuple[int, int] | None:
    idx = page_text.find(quote)
    if idx < 0:
        return None
    return idx, idx + len(quote)
