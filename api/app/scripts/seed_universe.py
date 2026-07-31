"""Seed active universe from the owner Nifty-200 CSV.

Usage (from api/):
  python -m app.scripts.seed_universe
  python -m app.scripts.seed_universe --path ../Nifty Shares Viewer Wireframe/uploads/ind_nifty200list.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.db import SessionLocal
from app.services.universe import seed_from_csv_path

DEFAULT_CSV = (
    Path(__file__).resolve().parents[3]
    / "Nifty Shares Viewer Wireframe"
    / "uploads"
    / "ind_nifty200list.csv"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--no-replace", action="store_true")
    args = parser.parse_args()
    if not args.path.exists():
        raise SystemExit(f"CSV not found: {args.path}")
    db = SessionLocal()
    try:
        upload = seed_from_csv_path(db, args.path, replace=not args.no_replace)
        print(
            f"seeded upload_id={upload.id} total={upload.total} "
            f"dup={upload.duplicates} invalid={upload.invalid}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
