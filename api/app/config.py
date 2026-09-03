from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "paro.db"
DEFAULT_ENV_PATH = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    data_dir: str = str((PROJECT_ROOT / "data").as_posix())

    azure_foundry_endpoint: str = ""
    azure_foundry_api_version: str = ""
    azure_foundry_key: str = ""
    azure_foundry_chat_deployment: str = ""
    azure_foundry_embeddings_deployment: str = ""
    azure_foundry_vision_deployment: str = ""

    ai_force_stub: bool = False
    ai_rate_limit_per_min: int = 20
    library_max_upload_mb: int = 25

    app_version: str = "0.1.0-s0"

    sync_retry_attempts: int = 2
    sync_retry_backoff_sec: float = 0.5
    sync_force_fail_symbols: str = ""
    scheduler_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=str(DEFAULT_ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
