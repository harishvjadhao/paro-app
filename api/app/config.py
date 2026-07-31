from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://paro:paro@localhost:5432/paro"
    redis_url: str = "redis://localhost:6379/0"
    default_user_id: int = 1
    api_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    tz: str = "Asia/Kolkata"

    azure_foundry_endpoint: str = ""
    azure_foundry_api_key: str = ""
    azure_foundry_api_version: str = "2024-08-01-preview"
    azure_foundry_chat_deployment: str = "gpt-4o"
    azure_foundry_embeddings_deployment: str = "text-embedding-3-small"
    azure_foundry_vision_deployment: str = "gpt-4o"

    storage_backend: str = "local"
    storage_local_path: str = "./data/storage"
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "paro-books"
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "paro-books"
    s3_region: str = "us-east-1"

    price_provider: str = "yfinance"
    sync_cron_hour_ist: int = 16
    sync_cron_minute_ist: int = 30

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
