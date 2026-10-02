"""PDF text extraction, kind detection, chapter inference, token/chunk estimates."""

from __future__ import annotations

import re
from dataclasses import dataclass

import fitz


@dataclass(frozen=True)
class ExtractedPage:
    page_index: int
    chapter: str
    text: str


SPINE_COLORS = ["#3C2CDA", "#B4632E", "#2E7D5B", "#8A5CF6", "#1D86FF", "#C48900", "#DC3545"]


def estimate_tokens(text: str) -> int:
    words = len(re.findall(r"\S+", text or ""))
    return max(1, int(words * 1.3)) if words else 0


def estimate_chunks(text: str, *, target_tokens: int = 750) -> int:
    tokens = estimate_tokens(text)
    if tokens <= 0:
        return 0
    return max(1, (tokens + target_tokens - 1) // target_tokens)


def infer_chapter(text: str, fallback: str) -> str:
    for line in (text or "").splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        if re.match(r"(?i)^chapter\s+\d+", cleaned):
            return cleaned[:240]
        if re.match(r"(?i)^(part|section)\s+\d+", cleaned):
            return cleaned[:240]
        if cleaned.isupper() and 8 <= len(cleaned) <= 80:
            return cleaned.title()[:240]
    return fallback


def extract_pdf_pages(path: str) -> list[ExtractedPage]:
    doc = fitz.open(path)
    pages: list[ExtractedPage] = []
    current_chapter = "Introduction"
    try:
        for index in range(doc.page_count):
            page = doc.load_page(index)
            text = page.get_text("text") or ""
            # Normalise hyphenated line breaks and whitespace a bit.
            text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
            text = re.sub(r"[ \t]+\n", "\n", text).strip()
            chapter = infer_chapter(text, current_chapter)
            if chapter != current_chapter and chapter:
                current_chapter = chapter
            pages.append(ExtractedPage(page_index=index, chapter=current_chapter, text=text))
    finally:
        doc.close()
    return pages


def text_density(pages: list[ExtractedPage]) -> float:
    if not pages:
        return 0.0
    chars = sum(len(page.text.strip()) for page in pages)
    return chars / max(len(pages), 1)


def detect_kind(pages: list[ExtractedPage], *, forced: str | None = None) -> str:
    if forced in {"text", "scanned"}:
        return forced
    # High extractable text ⇒ text PDF; otherwise treat as scanned.
    return "text" if text_density(pages) >= 40 else "scanned"


def title_from_filename(filename: str) -> str:
    stem = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE)
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    return stem[:240] or "Untitled book"
