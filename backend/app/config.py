import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "PULSEWATCH"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./pulsewatch.db"
    DATABASE_ECHO: bool = False

    # Security & SSRF
    ALLOW_LOCAL_TARGETS: bool = False
    MAX_RESPONSE_BYTES: int = 5 * 1024 * 1024  # 5 MB
    MAX_REDIRECTS: int = 5

    # Monitoring defaults
    DEFAULT_CHECK_INTERVAL: int = 60
    DEFAULT_TIMEOUT: int = 10
    DEFAULT_DEGRADED_THRESHOLD_MS: int = 1000
    DEFAULT_EXPECTED_STATUS_CODES: str = "200-399"

    # Real-time / SSE
    SSE_PING_INTERVAL_SECONDS: int = 15

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://frontend:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]


settings = Settings()
