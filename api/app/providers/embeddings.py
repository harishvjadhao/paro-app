"""Embedding providers for book RAG (Azure Foundry + deterministic stub)."""

from __future__ import annotations

import hashlib
import re
from abc import ABC, abstractmethod

import httpx
import numpy as np

from app.config import settings

STUB_DIM = 64


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def dimension(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def embed(self, texts: list[str]) -> list[np.ndarray]:
        raise NotImplementedError


class StubEmbeddingProvider(EmbeddingProvider):
    """Hash-bag embeddings — stable, offline, good enough for retrieval tests."""

    @property
    def dimension(self) -> int:
        return STUB_DIM

    def embed(self, texts: list[str]) -> list[np.ndarray]:
        return [_hash_embed(text, STUB_DIM) for text in texts]


class AzureFoundryEmbeddings(EmbeddingProvider):
    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        api_version: str,
        deployment: str,
        dimension: int = 1536,
        timeout: float = 60.0,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.api_version = api_version or "2024-02-15-preview"
        self.deployment = deployment
        self._dimension = dimension
        self.timeout = timeout

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, texts: list[str]) -> list[np.ndarray]:
        if not texts:
            return []
        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}/embeddings"
            f"?api-version={self.api_version}"
        )
        headers = {"api-key": self.api_key, "Content-Type": "application/json"}
        vectors: list[np.ndarray] = []
        # Batch modestly to stay under request limits.
        batch_size = 16
        with httpx.Client(timeout=self.timeout) as client:
            for start in range(0, len(texts), batch_size):
                batch = texts[start : start + batch_size]
                response = client.post(url, headers=headers, json={"input": batch})
                if response.status_code >= 400:
                    raise RuntimeError(
                        f"Azure embeddings failed ({response.status_code}): {response.text[:400]}"
                    )
                data = response.json().get("data") or []
                data = sorted(data, key=lambda row: int(row.get("index", 0)))
                for row in data:
                    arr = np.asarray(row.get("embedding") or [], dtype=np.float32)
                    if arr.size:
                        self._dimension = int(arr.size)
                    vectors.append(_l2_normalize(arr))
        return vectors


def get_embedding_provider() -> EmbeddingProvider:
    if getattr(settings, "ai_force_stub", False):
        return StubEmbeddingProvider()
    endpoint = (settings.azure_foundry_endpoint or "").strip()
    key = (settings.azure_foundry_key or "").strip()
    deployment = (settings.azure_foundry_embeddings_deployment or "").strip()
    if endpoint and key and deployment:
        return AzureFoundryEmbeddings(
            endpoint=endpoint,
            api_key=key,
            api_version=settings.azure_foundry_api_version or "2024-02-15-preview",
            deployment=deployment,
        )
    return StubEmbeddingProvider()


def packing_bytes(vector: np.ndarray) -> bytes:
    return np.asarray(vector, dtype=np.float32).tobytes()


def unpacking_bytes(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    return np.frombuffer(blob, dtype=np.float32).copy()


def _hash_embed(text: str, dim: int) -> np.ndarray:
    vec = np.zeros(dim, dtype=np.float32)
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    if not tokens:
        tokens = ["empty"]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vec[index] += sign
    return _l2_normalize(vec)


def _l2_normalize(vector: np.ndarray) -> np.ndarray:
    arr = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    if norm <= 1e-12:
        return arr
    return arr / norm


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a.size == 0 or b.size == 0 or a.size != b.size:
        return -1.0
    return float(np.dot(a, b) / (max(np.linalg.norm(a), 1e-12) * max(np.linalg.norm(b), 1e-12)))
