from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.routes.sync import sync_service

scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    global scheduler
    if not settings.scheduler_enabled:
        return
    if scheduler is not None:
        return

    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        sync_service.start_scheduled_incremental,
        CronTrigger(hour=18, minute=10),
        id="daily_incremental_sync",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
