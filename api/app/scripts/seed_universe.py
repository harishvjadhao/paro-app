from __future__ import annotations

from pathlib import Path

from app.db import SessionLocal
from app.services.universe import UniverseService


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    csv_path = root / "Nifty Shares Viewer Wireframe" / "uploads" / "ind_nifty200list (1).csv"

    if not csv_path.exists():
        raise FileNotFoundError(f"Seed file not found: {csv_path}")

    content = csv_path.read_bytes()
    service = UniverseService()

    with SessionLocal() as db:
        result = service.upload_universe(
            db,
            filename=csv_path.name,
            mode="replace",
            confirm=True,
            content=content,
        )

    print(
        f"Seed complete: total={result.total}, dup={result.dup}, invalid={result.invalid}, preview={len(result.preview)}"
    )


if __name__ == "__main__":
    main()
