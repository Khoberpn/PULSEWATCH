import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MonitorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Monitor descriptive name")
    url: str = Field(..., max_length=2048, description="Target URL (must be http or https)")
    method: str = Field(default="GET", description="HTTP Method (GET or HEAD)")
    check_interval: int = Field(default=60, ge=5, le=86400, description="Interval between checks in seconds")
    timeout: int = Field(default=10, ge=1, le=60, description="HTTP request timeout in seconds")
    expected_status_codes: str = Field(default="200-399", description="Expected HTTP status codes, e.g. 200-399 or 200,201,204")
    degraded_threshold_ms: int = Field(default=1000, ge=50, le=60000, description="Response time threshold in ms before marking DEGRADED")
    enabled: bool = Field(default=True, description="Whether monitor is active")

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        upper_v = v.strip().upper()
        if upper_v not in ["GET", "HEAD"]:
            raise ValueError("HTTP method must be either 'GET' or 'HEAD'")
        return upper_v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        stripped = v.strip()
        if not (stripped.startswith("http://") or stripped.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return stripped

    @field_validator("expected_status_codes")
    @classmethod
    def validate_expected_status_codes(cls, v: str) -> str:
        pattern = r"^(\d{3}(-\d{3})?)(,\s*\d{3}(-\d{3})?)*$"
        cleaned = re.sub(r"\s+", "", v)
        if not re.match(pattern, cleaned):
            raise ValueError("Expected status codes must be in format '200-399' or comma-separated e.g. '200,201,204'")
        return cleaned


class MonitorCreate(MonitorBase):
    pass


class MonitorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[str] = Field(None, max_length=2048)
    method: Optional[str] = None
    check_interval: Optional[int] = Field(None, ge=5, le=86400)
    timeout: Optional[int] = Field(None, ge=1, le=60)
    expected_status_codes: Optional[str] = None
    degraded_threshold_ms: Optional[int] = Field(None, ge=50, le=60000)
    enabled: Optional[bool] = None

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            upper_v = v.strip().upper()
            if upper_v not in ["GET", "HEAD"]:
                raise ValueError("HTTP method must be either 'GET' or 'HEAD'")
            return upper_v
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not (stripped.startswith("http://") or stripped.startswith("https://")):
                raise ValueError("URL must start with http:// or https://")
            return stripped
        return v

    @field_validator("expected_status_codes")
    @classmethod
    def validate_expected_status_codes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            pattern = r"^(\d{3}(-\d{3})?)(,\s*\d{3}(-\d{3})?)*$"
            cleaned = re.sub(r"\s+", "", v)
            if not re.match(pattern, cleaned):
                raise ValueError("Expected status codes must be in format '200-399' or comma-separated e.g. '200,201,204'")
            return cleaned
        return v


class MonitorResponse(MonitorBase):
    id: int
    current_status: str
    last_checked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    uptime_24h: Optional[float] = None
    avg_response_time_24h: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
