from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from backend.app.models.incident import IncidentStatus


class IncidentUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Updated incident status")
    description: Optional[str] = Field(None, description="Updated incident notes or description")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            upper_v = v.strip().upper()
            allowed = [s.value for s in IncidentStatus]
            if upper_v not in allowed:
                raise ValueError(f"Status must be one of {allowed}")
            return upper_v
        return v


class IncidentResponse(BaseModel):
    id: int
    monitor_id: int
    title: str
    description: Optional[str] = None
    status: str
    started_at: datetime
    resolved_at: Optional[datetime] = None
    downtime_seconds: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    monitor_name: Optional[str] = None
    monitor_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
