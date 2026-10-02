from fastapi import APIRouter

from app.routes.ai import router as ai_router
from app.routes.health import router as health_router
from app.routes.highlights import router as highlights_router
from app.routes.journal import router as journal_router
from app.routes.library import router as library_router
from app.routes.sectors import router as sectors_router
from app.routes.stock_list import router as stock_list_router
from app.routes.sync import router as sync_router
from app.routes.trends import router as trends_router
from app.routes.universe import router as universe_router
from app.routes.workspace import router as workspace_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(universe_router)
api_router.include_router(sync_router)
api_router.include_router(workspace_router)
api_router.include_router(stock_list_router)
api_router.include_router(sectors_router)
api_router.include_router(trends_router)
api_router.include_router(journal_router)
api_router.include_router(highlights_router)
api_router.include_router(ai_router)
api_router.include_router(library_router)
