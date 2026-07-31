"""Sector AI grounded prompt + SSE."""

from __future__ import annotations

import json
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.providers.ai import get_chat_provider
from app.services import sectors as sectors_service

router = APIRouter(tags=["ai"])

_rate: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 20  # per minute per IP


class SectorChatIn(BaseModel):
    sector: str
    question: str = Field(min_length=1, max_length=2000)


def _check_rate(request: Request) -> None:
    ip = request.client.host if request.client else "local"
    now = time.time()
    window = [t for t in _rate[ip] if now - t < 60]
    if len(window) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="rate limit")
    window.append(now)
    _rate[ip] = window


def build_grounded_prompt(sector_data: dict, question: str) -> list[dict[str, str]]:
    cons = sector_data.get("constituents") or []
    lines = [
        f"{c['symbol']} pct_vs_ma={c['pct_vs_ma']:.1f}% above={c['above']}" for c in cons[:40]
    ]
    context = (
        f"Sector: {sector_data.get('industry')}. "
        f"Breadth: {sector_data.get('above')}/{sector_data.get('total')} "
        f"({sector_data.get('breadth'):.1f}% above 44-day MA). "
        f"Constituents: " + "; ".join(lines)
    )
    return [
        {
            "role": "system",
            "content": (
                "You are PaRo sector analyst. Answer ONLY using the provided live market context. "
                "Mention symbols that appear in context. Be concise. Use markdown."
            ),
        },
        {"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{question}"},
    ]


@router.post("/ai/sector-chat")
async def sector_chat(
    body: SectorChatIn,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _check_rate(request)
    data = sectors_service.breadth_for_sector(db, body.sector)
    messages = build_grounded_prompt(data, body.question)
    chat = get_chat_provider()

    def event_stream():
        for token in chat.stream_chat(messages):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
