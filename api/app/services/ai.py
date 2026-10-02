from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.providers.ai import SYSTEM_PROMPT, ChatProvider, get_chat_provider
from app.services.sectors import SectorService


class RateLimiter:
    """Simple in-process rate limiter (single-user v1)."""

    def __init__(self, *, per_minute: int = 20, max_concurrent: int = 1) -> None:
        self.per_minute = per_minute
        self.max_concurrent = max_concurrent
        self._hits: dict[int, deque[float]] = defaultdict(deque)
        self._inflight: dict[int, int] = defaultdict(int)

    def acquire(self, user_id: int = 1) -> None:
        now = time.monotonic()
        window = self._hits[user_id]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.per_minute:
            raise HTTPException(status_code=429, detail="AI rate limit exceeded. Try again shortly.")
        if self._inflight[user_id] >= self.max_concurrent:
            raise HTTPException(status_code=429, detail="Another AI request is already in progress.")
        window.append(now)
        self._inflight[user_id] += 1

    def release(self, user_id: int = 1) -> None:
        if self._inflight[user_id] > 0:
            self._inflight[user_id] -= 1


_rate_limiter = RateLimiter(
    per_minute=int(getattr(settings, "ai_rate_limit_per_min", 20) or 20),
    max_concurrent=1,
)


class SectorAIService:
    def __init__(
        self,
        sector_service: SectorService | None = None,
        provider: ChatProvider | None = None,
        rate_limiter: RateLimiter | None = None,
    ) -> None:
        self.sectors = sector_service or SectorService()
        self.provider = provider or get_chat_provider()
        self.rate_limiter = rate_limiter or _rate_limiter

    def build_grounded_user_message(self, db: Session, sector: str, question: str) -> str:
        detail = self.sectors.sector_detail(db, sector)
        constituents = detail.constituents
        lines = [
            f"Sector: {detail.name}.",
            (
                f"{detail.total} stocks, {detail.above} above 44 MA "
                f"({detail.breadth}% breadth). Avg vs 44 MA: {detail.avg_pct_vs_ma}%."
            ),
            "Constituents vs 44-day MA: "
            + ", ".join(
                f"{item.symbol} {'+' if item.pct_vs_ma44 >= 0 else ''}{item.pct_vs_ma44:.1f}%"
                for item in constituents
            )
            + ".",
        ]
        if detail.leader:
            lines.append(
                "Leaders: "
                + ", ".join(item.symbol for item in sorted(constituents, key=lambda c: c.pct_vs_ma44, reverse=True)[:3])
            )
        if detail.laggard:
            lines.append(
                "Laggards: "
                + ", ".join(item.symbol for item in sorted(constituents, key=lambda c: c.pct_vs_ma44)[:3])
            )
        weekly = " → ".join(f"{point.pct:.0f}%" for point in detail.weekly_trend)
        lines.append(f"Weekly breadth trend: {weekly}.")
        lines.append(f"Rotation: avg8={detail.avg8:.1f}, momentum={detail.momentum:.1f}.")
        lines.append("")
        lines.append(f"Question: {question.strip()}")
        return "\n".join(lines)

    async def stream_sector_chat(
        self,
        db: Session,
        request: Request,
        *,
        sector: str,
        question: str,
        user_id: int = 1,
    ) -> AsyncIterator[str]:
        if not question.strip():
            raise HTTPException(status_code=400, detail="Question is required")

        self.rate_limiter.acquire(user_id)
        cancel = asyncio.Event()
        try:
            grounded = self.build_grounded_user_message(db, sector, question)
            yield _sse({"type": "meta", "sector": sector, "provider": type(self.provider).__name__})

            async for token in self.provider.stream_chat(
                system=SYSTEM_PROMPT,
                user=grounded,
                cancel=cancel,
            ):
                if await request.is_disconnected():
                    cancel.set()
                    yield _sse({"type": "cancelled"})
                    return
                yield _sse({"type": "token", "text": token})

            yield _sse({"type": "done"})
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 — surface as SSE error event
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            cancel.set()
            self.rate_limiter.release(user_id)


def _sse(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
