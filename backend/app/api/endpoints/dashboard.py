from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from backend.app.database import get_db
from backend.app.models.monitor import Monitor, MonitorStatus
from backend.app.models.check_result import CheckResult
from backend.app.models.incident import Incident, IncidentStatus
from backend.app.schemas.dashboard import DashboardSummary, AnalyticsResponse
from backend.app.services.analytics import AnalyticsService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)

    # Monitor counts
    total_q = select(func.count(Monitor.id))
    total_monitors = (await db.execute(total_q)).scalar_one_or_none() or 0

    up_q = select(func.count(Monitor.id)).where(
        and_(Monitor.enabled == True, Monitor.current_status == MonitorStatus.UP.value)
    )
    operational_monitors = (await db.execute(up_q)).scalar_one_or_none() or 0

    deg_q = select(func.count(Monitor.id)).where(
        and_(Monitor.enabled == True, Monitor.current_status == MonitorStatus.DEGRADED.value)
    )
    degraded_monitors = (await db.execute(deg_q)).scalar_one_or_none() or 0

    down_q = select(func.count(Monitor.id)).where(
        and_(Monitor.enabled == True, Monitor.current_status == MonitorStatus.DOWN.value)
    )
    down_monitors = (await db.execute(down_q)).scalar_one_or_none() or 0

    paused_q = select(func.count(Monitor.id)).where(Monitor.enabled == False)
    paused_monitors = (await db.execute(paused_q)).scalar_one_or_none() or 0

    # Active incidents
    inc_q = select(func.count(Incident.id)).where(Incident.status != IncidentStatus.RESOLVED.value)
    active_incidents = (await db.execute(inc_q)).scalar_one_or_none() or 0

    # Availability and Average latency over last 24h across all monitors
    avail_24h, total_checks_24h, _, _ = await AnalyticsService.get_monitor_availability(
        db, monitor_id=None, since=since_24h
    )

    avg_rt_q = select(func.avg(CheckResult.response_time_ms)).where(CheckResult.checked_at >= since_24h)
    avg_rt_res = await db.execute(avg_rt_q)
    avg_rt = avg_rt_res.scalar_one_or_none()

    return DashboardSummary(
        total_monitors=total_monitors,
        operational_monitors=operational_monitors,
        degraded_monitors=degraded_monitors,
        down_monitors=down_monitors,
        paused_monitors=paused_monitors,
        overall_availability=avail_24h,
        avg_response_time_ms=round(float(avg_rt), 1) if avg_rt is not None else 0.0,
        active_incidents=active_incidents,
        recent_checks_count=total_checks_24h,
    )


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_dashboard_analytics(
    timeframe: str = Query("24h", pattern="^(24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
):
    analytics = await AnalyticsService.get_detailed_analytics(db, monitor_id=None, timeframe=timeframe)
    return analytics
