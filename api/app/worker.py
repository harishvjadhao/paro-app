"""Ingest worker: poll Redis queue `paro:ingest` for book_id:job_id."""

from __future__ import annotations

import time

from app.config import settings
from app.db import SessionLocal
from app.services.ingest import process_ingestion


def main() -> None:
    print("paro worker starting (ingest queue)")
    try:
        import redis

        r = redis.from_url(settings.redis_url)
    except Exception as exc:
        print(f"redis unavailable ({exc}); idle")
        while True:
            time.sleep(60)
        return

    while True:
        item = r.brpop("paro:ingest", timeout=5)
        if not item:
            continue
        _, payload = item
        payload = payload.decode() if isinstance(payload, bytes) else payload
        try:
            book_id_s, job_id_s = payload.split(":", 1)
            book_id, job_id = int(book_id_s), int(job_id_s)
        except ValueError:
            print("bad payload", payload)
            continue
        db = SessionLocal()
        try:
            process_ingestion(db, book_id, job_id)
        finally:
            db.close()


if __name__ == "__main__":
    main()
