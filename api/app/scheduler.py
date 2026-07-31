"""APScheduler: daily incremental sync after NSE close (IST)."""

from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from zoneinfo import ZoneInfo

from app.config import settings
from app.db import SessionLocal
from app.providers.prices import get_price_provider
from app.services.sync import run_sync

_scheduler: BackgroundScheduler | None = None


def _job() -> None:
    db = SessionLocal()
    try:
        run_sync(db, get_price_provider(), mode="Incremental")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    tz = ZoneInfo(settings.tz)
    _scheduler = BackgroundScheduler(timezone=tz)
    _scheduler.add_job(
        _job,
        CronTrigger(
            hour=settings.sync_cron_hour_ist,
            minute=settings.sync_cron_minute_ist,
            timezone=tz,
        ),
        id="daily_incremental_sync",
        replace_existing=True,
    )
    _scheduler.start()
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
