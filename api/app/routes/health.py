from fastapi import APIRouter

from app.config import settings
from app.db import check_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    db_status = "ok" if check_db() else "down"
    return {
        "status": "ok",
        "db": db_status,
        "version": settings.app_version,
    }
