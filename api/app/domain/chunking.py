"""Split page text into overlapping retrieval chunks with page-local char ranges."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.library import estimate_tokens


@dataclass(frozen=True)
class TextChunk:
    page_index: int
    chapter: str
    ord: int
    text: str
    char_start: int
    char_end: int
    token_count: int


def _token_spans(text: str) -> list[tuple[int, int, str]]:
    """Return (start, end, token) spans for whitespace-separated tokens."""
    return [(match.start(), match.end(), match.group(0)) for match in re.finditer(r"\S+", text or "")]


def chunk_page_text(
    *,
    page_index: int,
    chapter: str,
    text: str,
    target_tokens: int = 750,
    overlap_ratio: float = 0.15,
    min_tokens: int = 40,
) -> list[TextChunk]:
    """Chunk a single page. Char ranges are offsets into `text`."""
    body = text or ""
    spans = _token_spans(body)
    if not spans:
        return []

    # estimate_tokens ≈ words * 1.3; work in word counts approximating that.
    target_words = max(20, int(target_tokens / 1.3))
    overlap_words = max(5, int(target_words * overlap_ratio))

    chunks: list[TextChunk] = []
    start_i = 0
    ord_index = 0
    while start_i < len(spans):
        end_i = min(len(spans), start_i + target_words)
        if end_i - start_i < min_tokens and end_i < len(spans):
            end_i = min(len(spans), start_i + min_tokens)

        char_start = spans[start_i][0]
        char_end = spans[end_i - 1][1]
        piece = body[char_start:char_end]
        token_count = estimate_tokens(piece)
        chunks.append(
            TextChunk(
                page_index=page_index,
                chapter=chapter or "",
                ord=ord_index,
                text=piece,
                char_start=char_start,
                char_end=char_end,
                token_count=token_count,
            )
        )
        ord_index += 1
        if end_i >= len(spans):
            break
        next_start = max(start_i + 1, end_i - overlap_words)
        if next_start <= start_i:
            next_start = start_i + 1
        start_i = next_start

    return chunks


def chunk_pages(
    pages: list[tuple[int, str, str]],
    *,
    target_tokens: int = 750,
    overlap_ratio: float = 0.15,
) -> list[TextChunk]:
    """pages: list of (page_index, chapter, text)."""
    out: list[TextChunk] = []
    for page_index, chapter, text in pages:
        out.extend(
            chunk_page_text(
                page_index=page_index,
                chapter=chapter,
                text=text,
                target_tokens=target_tokens,
                overlap_ratio=overlap_ratio,
            )
        )
    return out


def best_quote_sentence(text: str, *, max_chars: int = 220) -> tuple[str, int, int]:
    """Pick a citation quote + char range inside `text` (relative to the chunk/page slice)."""
    body = (text or "").strip()
    if not body:
        return "", 0, 0
    # Prefer first sentence-like span.
    match = re.search(r".+?[.!?](?:\s|$)", body, flags=re.S)
    if match:
        quote = match.group(0).strip()
        start = body.find(quote)
        end = start + len(quote)
        return quote[:max_chars], start, end
    quote = body[:max_chars]
    return quote, 0, len(quote)
