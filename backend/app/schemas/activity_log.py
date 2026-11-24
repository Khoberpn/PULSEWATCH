from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ActivityLogResponse(BaseModel):
    id: int
    event_type: str
    monitor_id: Optional[int] = None
    description: str
    metadata_json: Optional[str] = None
    created_at: datetime
    monitor_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
