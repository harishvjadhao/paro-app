from pathlib import Path

from app.config import settings


class LocalStorage:
    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or settings.storage_local_path)
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, data: bytes) -> str:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return (self.root / key).read_bytes()

    def delete(self, key: str) -> None:
        path = self.root / key
        if path.exists():
            path.unlink()


def get_storage() -> LocalStorage:
    return LocalStorage()
