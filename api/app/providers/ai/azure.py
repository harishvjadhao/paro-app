"""Azure AI Foundry (OpenAI-compatible) providers."""

from __future__ import annotations

import base64
from collections.abc import AsyncIterator, Iterator

from openai import AzureOpenAI, AsyncAzureOpenAI

from app.config import settings


def _client() -> AzureOpenAI:
    return AzureOpenAI(
        api_key=settings.azure_foundry_api_key,
        api_version=settings.azure_foundry_api_version,
        azure_endpoint=settings.azure_foundry_endpoint,
    )


def _aclient() -> AsyncAzureOpenAI:
    return AsyncAzureOpenAI(
        api_key=settings.azure_foundry_api_key,
        api_version=settings.azure_foundry_api_version,
        azure_endpoint=settings.azure_foundry_endpoint,
    )


class AzureChatProvider:
    def stream_chat(self, messages: list[dict[str, str]]) -> Iterator[str]:
        if not settings.azure_foundry_api_key or not settings.azure_foundry_endpoint:
            yield "[Azure Foundry not configured — set AZURE_FOUNDRY_* in .env]"
            return
        stream = _client().chat.completions.create(
            model=settings.azure_foundry_chat_deployment,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def astream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if not settings.azure_foundry_api_key or not settings.azure_foundry_endpoint:
            yield "[Azure Foundry not configured — set AZURE_FOUNDRY_* in .env]"
            return
        stream = await _aclient().chat.completions.create(
            model=settings.azure_foundry_chat_deployment,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class AzureEmbeddingsProvider:
    def embed(self, texts: list[str]) -> list[list[float]]:
        if not settings.azure_foundry_api_key:
            # Deterministic stub vectors for offline tests
            return [[float((hash(t) % 1000) / 1000.0)] * 8 for t in texts]
        resp = _client().embeddings.create(
            model=settings.azure_foundry_embeddings_deployment,
            input=texts,
        )
        return [list(item.embedding) for item in resp.data]


class AzureVisionOCRProvider:
    def ocr_image(self, image_bytes: bytes, prompt: str = "Extract all text from this page.") -> str:
        if not settings.azure_foundry_api_key:
            return ""
        b64 = base64.b64encode(image_bytes).decode("ascii")
        resp = _client().chat.completions.create(
            model=settings.azure_foundry_vision_deployment,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                    ],
                }
            ],
        )
        return resp.choices[0].message.content or ""
