"""Swappable Azure AI Foundry chat / embeddings / vision interfaces."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import Protocol


class ChatProvider(Protocol):
    def stream_chat(self, messages: list[dict[str, str]]) -> Iterator[str]:
        ...

    async def astream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        ...


class EmbeddingsProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class VisionOCRProvider(Protocol):
    def ocr_image(self, image_bytes: bytes, prompt: str = "Extract all text from this page.") -> str:
        ...
