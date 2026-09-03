"""Chat providers for sector AI (Azure AI Foundry + local stub)."""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings

SYSTEM_PROMPT = (
    "You are a concise equity market analyst reviewing the Nifty 200 by sector. "
    "Ground answers strictly in the provided sector data. Keep replies under 130 words. "
    "Use short paragraphs and markdown bullet lists where helpful. "
    "Refer to stocks by their symbol. No investment-advice disclaimers."
)


class ChatProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        *,
        system: str,
        user: str,
        cancel: asyncio.Event,
    ) -> AsyncIterator[str]:
        """Yield text tokens until complete or cancel is set."""
        raise NotImplementedError


class StubChatProvider(ChatProvider):
    """Deterministic grounded reply used when Azure is not configured / in tests."""

    async def stream_chat(
        self,
        *,
        system: str,
        user: str,
        cancel: asyncio.Event,
    ) -> AsyncIterator[str]:
        _ = system
        reply = _stub_reply(user)
        chunk_size = 12
        for index in range(0, len(reply), chunk_size):
            if cancel.is_set():
                return
            yield reply[index : index + chunk_size]
            await asyncio.sleep(0)


class AzureFoundryChat(ChatProvider):
    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        api_version: str,
        deployment: str,
        timeout: float = 60.0,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.api_version = api_version or "2024-02-15-preview"
        self.deployment = deployment
        self.timeout = timeout

    async def stream_chat(
        self,
        *,
        system: str,
        user: str,
        cancel: asyncio.Event,
    ) -> AsyncIterator[str]:
        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions"
            f"?api-version={self.api_version}"
        )
        payload = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": True,
            "temperature": 0.3,
            "max_tokens": 400,
        }
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise RuntimeError(f"Azure Foundry chat failed ({response.status_code}): {body[:400]}")

                async for line in response.aiter_lines():
                    if cancel.is_set():
                        await response.aclose()
                        return
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        if data == "[DONE]":
                            return
                        continue
                    try:
                        parsed: dict[str, Any] = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = parsed.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content")
                    if text:
                        yield str(text)


def get_chat_provider() -> ChatProvider:
    if getattr(settings, "ai_force_stub", False):
        return StubChatProvider()
    endpoint = (settings.azure_foundry_endpoint or "").strip()
    key = (settings.azure_foundry_key or "").strip()
    deployment = (settings.azure_foundry_chat_deployment or "").strip()
    if endpoint and key and deployment:
        return AzureFoundryChat(
            endpoint=endpoint,
            api_key=key,
            api_version=settings.azure_foundry_api_version or "2024-02-15-preview",
            deployment=deployment,
        )
    return StubChatProvider()


def _stub_reply(user_message: str) -> str:
    """Build a short reply that echoes facts present in the grounded user payload."""
    if "Passages:" in user_message or user_message.strip().startswith("Book:"):
        return _stub_book_reply(user_message)

    sector = "this sector"
    breadth = "?"
    total = "?"
    above = "?"
    leaders: list[str] = []
    laggards: list[str] = []
    weekly = ""

    for line in user_message.splitlines():
        stripped = line.strip()
        if stripped.startswith("Sector:"):
            sector = stripped.split(":", 1)[1].strip().rstrip(".")
        elif "breadth" in stripped.lower() and "%" in stripped:
            # e.g. "12 stocks, 7 above 44 MA (58.3% breadth)."
            if "(" in stripped and "% breadth" in stripped:
                breadth = stripped.split("(")[-1].split("%")[0].strip()
            parts = stripped.replace(",", " ").split()
            for index, token in enumerate(parts):
                if token.isdigit() and index + 1 < len(parts) and parts[index + 1].startswith("stock"):
                    total = token
                if token.isdigit() and index + 1 < len(parts) and parts[index + 1] == "above":
                    above = token
        elif stripped.startswith("Leaders:"):
            leaders = [part.strip() for part in stripped.split(":", 1)[1].split(",") if part.strip()]
        elif stripped.startswith("Laggards:"):
            laggards = [part.strip() for part in stripped.split(":", 1)[1].split(",") if part.strip()]
        elif stripped.startswith("Weekly breadth"):
            weekly = stripped.split(":", 1)[-1].strip()

    leader_txt = ", ".join(leaders[:2]) if leaders else "n/a"
    laggard_txt = ", ".join(laggards[:2]) if laggards else "n/a"
    weekly_txt = weekly or "n/a"
    return (
        f"**{sector}** — breadth is {breadth}%, with {above} of {total} names above the 44-day MA.\n\n"
        f"- Leaders: {leader_txt}\n"
        f"- Laggards: {laggard_txt}\n"
        f"- Weekly breadth: {weekly_txt}\n\n"
        "Configure Azure AI Foundry credentials for live model answers; this reply is grounded in the live sector snapshot above."
    )


def _stub_book_reply(user_message: str) -> str:
    title = "this book"
    question = ""
    passage_lines: list[str] = []
    page_hint = "p.1"
    for line in user_message.splitlines():
        stripped = line.strip()
        if stripped.startswith("Book:"):
            title = stripped.split(":", 1)[1].strip() or title
        elif stripped.startswith("Question:"):
            question = stripped.split(":", 1)[1].strip()
        elif stripped.startswith("[p."):
            page_hint = stripped.split("|", 1)[0].strip("[] ")
        elif stripped and not stripped.startswith("Passages:") and not stripped.startswith("Note:"):
            if not stripped.startswith("score="):
                passage_lines.append(stripped)

    snippet = " ".join(passage_lines)[:220].strip() or "No direct passage text was provided."
    q = question or "your question"
    return (
        f"From **{title}** ({page_hint}): {snippet}\n\n"
        f"That passage is the best grounded match for “{q}”. "
        "Configure Azure AI Foundry for richer answers; this stub only restates retrieved text."
    )
