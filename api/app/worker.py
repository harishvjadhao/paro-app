"""Worker entrypoint (Phase 6 ingestion). Phase 0 stub keeps compose healthy."""

import time


def main() -> None:
    print("paro worker idle (Phase 0 stub)")
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
