from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.ai import SectorChatRequest
from app.services.ai import SectorAIService

router = APIRouter(tags=["ai"])
service = SectorAIService()


@router.post("/ai/sector-chat")
async def sector_chat(
    payload: SectorChatRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    generator = service.stream_sector_chat(
        db,
        request,
        sector=payload.sector,
        question=payload.question,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
