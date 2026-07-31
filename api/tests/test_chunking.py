from app.services.chunking import chunk_page_text, find_char_range, quote_for_citation


def test_chunk_overlap_and_ranges():
    text = ("word " * 800).strip()
    chunks = chunk_page_text(text, page_index=3, chapter="Ch1", target_tokens=100, overlap_ratio=0.15)
    assert len(chunks) >= 2
    assert chunks[0].char_start == 0
    assert chunks[0].page_index == 3
    # ranges map back into page text
    for c in chunks:
        assert text[c.char_start : c.char_end].strip()
        assert c.char_end > c.char_start


def test_citation_quote_roundtrip():
    page = "Alpha. The honest journal is a contract. Beta."
    chunks = chunk_page_text(page, page_index=0, target_tokens=20)
    assert chunks
    q = quote_for_citation(page, chunks[0].char_start, chunks[0].char_end)
    found = find_char_range(page, q.rstrip("…"))
    assert found is not None


def test_delete_cascade_contract_documented():
    # ORM relationships use cascade="all, delete-orphan" + FK ondelete CASCADE
    from app.models.books import Book

    assert Book.pages.property.cascade.delete_orphan
