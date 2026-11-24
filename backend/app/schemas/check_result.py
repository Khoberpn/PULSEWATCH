from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CheckResultResponse(BaseModel):
    id: int
    monitor_id: int
    status: str
    http_status_code: Optional[int] = None
    response_time_ms: float
    error_message: Optional[str] = None
    checked_at: datetime

    model_config = ConfigDict(from_attributes=True)
