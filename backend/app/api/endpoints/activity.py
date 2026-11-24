from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_

from backend.app.database import get_db
from backend.app.models.activity_log import ActivityLog
from backend.app.models.monitor import Monitor
from backend.app.schemas.activity_log import ActivityLogResponse

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("", response_model=List[ActivityLogResponse])
async def list_activity_logs(
    monitor_id: Optional[int] = Query(None, description="Filter by monitor ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ActivityLog, Monitor.name.label("monitor_name"))
        .outerjoin(Monitor, ActivityLog.monitor_id == Monitor.id)
        .order_by(desc(ActivityLog.created_at))
        .offset(offset)
        .limit(limit)
    )

    conditions = []
    if monitor_id is not None:
        conditions.append(ActivityLog.monitor_id == monitor_id)
    if event_type:
        conditions.append(ActivityLog.event_type == event_type)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    rows = result.all()

    logs = []
    for log_item, mon_name in rows:
        data = ActivityLogResponse.model_validate(log_item)
        data.monitor_name = mon_name
        logs.append(data)

    return logs
