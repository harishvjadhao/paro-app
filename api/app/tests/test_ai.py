from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.main import app
from app.models import Base
from app.models.highlights import ChartHighlight
from app.models.journal import Trade
from app.models.stock_list import StockListColumn, StockMeta
from app.models.sync import PriceBar, SyncRun, SyncRunItem
from app.models.universe import StockUniverse, UniverseUpload
from app.models.workspace import StockComment, StockState
from app.providers.ai import StubChatProvider
from app.services.ai import RateLimiter, SectorAIService
from fastapi import HTTPException

SAMPLE_CSV = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha One,Finance,AAA,EQ,INE000A00001
Beta Two,Finance,BBB,EQ,INE000B00002
Gamma Three,IT,CCC,EQ,INE000C00003
"""


def _reset_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(ChartHighlight).delete()
        db.query(Trade).delete()
        db.query(StockListColumn).delete()
        db.query(StockMeta).delete()
        db.query(StockComment).delete()
        db.query(StockState).delete()
        db.query(SyncRunItem).delete()
        db.query(SyncRun).delete()
        db.query(PriceBar).delete()
        db.query(StockUniverse).delete()
        db.query(UniverseUpload).delete()
        db.commit()


def _seed_universe(client: TestClient) -> None:
    response = client.post(
        "/admin/universe/upload",
        data={"mode": "append"},
        files={"file": ("universe.csv", SAMPLE_CSV, "text/csv")},
    )
    assert response.status_code == 200


def _seed_bars(symbol: str, *, start: float, step: float, days: int = 90) -> None:
    with SessionLocal() as db:
        base = date.today() - timedelta(days=days)
        for index in range(days):
            close = start + index * step
            db.add(
                PriceBar(
                    symbol=symbol,
                    date=base + timedelta(days=index),
                    o=close - 0.2,
                    h=close + 0.4,
                    l=close - 0.5,
                    c=close,
                    v=1000 + index,
                )
            )
        db.commit()


def _parse_sse(text: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for block in text.split("\n\n"):
        line = block.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload:
            events.append(json.loads(payload))
    return events


def test_grounded_prompt_includes_live_sector_facts() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_bars("AAA", start=100, step=1.0)
    _seed_bars("BBB", start=80, step=-0.2)
    _seed_bars("CCC", start=50, step=0.4)

    with SessionLocal() as db:
        service = SectorAIService(provider=StubChatProvider())
        message = service.build_grounded_user_message(db, "Finance", "Who leads?")
        assert "Sector: Finance" in message
        assert "AAA" in message
        assert "BBB" in message
        assert "Question: Who leads?" in message
        assert "% breadth" in message


def test_sector_chat_streams_tokens_via_sse() -> None:
    _reset_tables()
    client = TestClient(app)
    _seed_universe(client)
    _seed_bars("AAA", start=100, step=1.0)
    _seed_bars("BBB", start=90, step=0.5)

    with client.stream(
        "POST",
        "/ai/sector-chat",
        json={"sector": "Finance", "question": "Summarise breadth and leaders."},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    events = _parse_sse(body)
    types = [event.get("type") for event in events]
    assert "meta" in types
    assert "token" in types
    assert "done" in types
    text = "".join(str(event.get("text", "")) for event in events if event.get("type") == "token")
    assert "Finance" in text
    assert "breadth" in text.lower()


def test_rate_limiter_blocks_burst() -> None:
    limiter = RateLimiter(per_minute=2, max_concurrent=1)
    limiter.acquire(1)
    limiter.release(1)
    limiter.acquire(1)
    limiter.release(1)
    try:
        limiter.acquire(1)
        raised = False
    except HTTPException as exc:
        raised = True
        assert exc.status_code == 429
    assert raised


def test_stub_provider_respects_cancel() -> None:
    provider = StubChatProvider()
    cancel = asyncio.Event()

    async def run() -> list[str]:
        tokens: list[str] = []
        async for token in provider.stream_chat(system="s", user="Sector: Demo.\nQuestion: hi", cancel=cancel):
            tokens.append(token)
            cancel.set()
        return tokens

    tokens = asyncio.run(run())
    assert len(tokens) >= 1
