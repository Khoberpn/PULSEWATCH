import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from backend.app.database import get_db
from backend.app.models.monitor import Monitor, MonitorStatus
from backend.app.models.check_result import CheckResult
from backend.app.models.activity_log import ActivityLog
from backend.app.schemas.monitor import MonitorCreate, MonitorUpdate, MonitorResponse
from backend.app.schemas.check_result import CheckResultResponse
from backend.app.schemas.dashboard import AnalyticsResponse
from backend.app.services.ssrf import validate_url_for_ssrf, SSRFValidationError
from backend.app.services.scheduler import scheduler
from backend.app.services.monitor_engine import monitoring_engine
from backend.app.services.event_bus import event_bus
from backend.app.services.analytics import AnalyticsService
from backend.app.config import settings

router = APIRouter(prefix="/monitors", tags=["Monitors"])


@router.get("", response_model=List[MonitorResponse])
async def list_monitors(
    search: Optional[str] = Query(None, description="Search by name or URL"),
    status: Optional[str] = Query(None, description="Filter by status (UP, DEGRADED, DOWN, PENDING)"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled state"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).order_by(desc(Monitor.created_at))
    conditions = []
    if search:
        search_filter = f"%{search}%"
        conditions.append(Monitor.name.ilike(search_filter) | Monitor.url.ilike(search_filter))
    if status:
        conditions.append(Monitor.current_status == status.upper())
    if enabled is not None:
        conditions.append(Monitor.enabled == enabled)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    monitors = result.scalars().all()

    # Calculate 24h uptime for each monitor
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    response_list = []
    for mon in monitors:
        avail_24h, _, _, _ = await AnalyticsService.get_monitor_availability(db, mon.id, since_24h)
        # Average response time in 24h
        rt_query = select(func.avg(CheckResult.response_time_ms)).where(
            and_(CheckResult.monitor_id == mon.id, CheckResult.checked_at >= since_24h)
        )
        rt_res = await db.execute(rt_query)
        avg_rt = rt_res.scalar_one_or_none()

        mon_data = MonitorResponse.model_validate(mon)
        mon_data.uptime_24h = avail_24h
        mon_data.avg_response_time_24h = round(float(avg_rt), 1) if avg_rt is not None else None
        response_list.append(mon_data)

    return response_list


@router.post("", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
async def create_monitor(
    payload: MonitorCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate SSRF
    try:
        validate_url_for_ssrf(payload.url, allow_local=settings.ALLOW_LOCAL_TARGETS)
    except SSRFValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target URL: {str(e)}",
        )

    now = datetime.now(timezone.utc)
    monitor = Monitor(
        name=payload.name.strip(),
        url=payload.url.strip(),
        method=payload.method,
        check_interval=payload.check_interval,
        timeout=payload.timeout,
        expected_status_codes=payload.expected_status_codes,
        degraded_threshold_ms=payload.degraded_threshold_ms,
        enabled=payload.enabled,
        current_status=MonitorStatus.PENDING.value,
        created_at=now,
        updated_at=now,
    )
    db.add(monitor)
    await db.flush()

    # Log creation activity
    activity = ActivityLog(
        event_type="monitor.created",
        monitor_id=monitor.id,
        description=f"Monitor '{monitor.name}' created targeting {monitor.url} ({monitor.method}, every {monitor.check_interval}s)",
        metadata_json=f'{{"url": "{monitor.url}", "interval": {monitor.check_interval}}}',
        created_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(monitor)

    # Schedule periodic checks if enabled
    if monitor.enabled:
        scheduler.schedule_monitor(monitor.id, monitor.check_interval)

    # Broadcast event
    await event_bus.broadcast(
        "monitor.created",
        {
            "id": monitor.id,
            "name": monitor.name,
            "url": monitor.url,
            "method": monitor.method,
            "status": monitor.current_status,
            "created_at": monitor.created_at.isoformat(),
        },
    )

    # Trigger an immediate background check so user sees instant results
    if monitor.enabled:
        asyncio.create_task(monitoring_engine.run_check(monitor.id, is_manual=False))

    res = MonitorResponse.model_validate(monitor)
    res.uptime_24h = 100.0
    return res


@router.get("/{monitor_id}", response_model=MonitorResponse)
async def get_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    avail_24h, _, _, _ = await AnalyticsService.get_monitor_availability(db, monitor.id, since_24h)

    rt_query = select(func.avg(CheckResult.response_time_ms)).where(
        and_(CheckResult.monitor_id == monitor.id, CheckResult.checked_at >= since_24h)
    )
    rt_res = await db.execute(rt_query)
    avg_rt = rt_res.scalar_one_or_none()

    mon_data = MonitorResponse.model_validate(monitor)
    mon_data.uptime_24h = avail_24h
    mon_data.avg_response_time_24h = round(float(avg_rt), 1) if avg_rt is not None else None
    return mon_data


@router.patch("/{monitor_id}", response_model=MonitorResponse)
async def update_monitor(
    monitor_id: int,
    payload: MonitorUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    # If updating URL, re-check SSRF
    if payload.url and payload.url != monitor.url:
        try:
            validate_url_for_ssrf(payload.url, allow_local=settings.ALLOW_LOCAL_TARGETS)
        except SSRFValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target URL: {str(e)}",
            )
        monitor.url = payload.url.strip()

    if payload.name is not None:
        monitor.name = payload.name.strip()
    if payload.method is not None:
        monitor.method = payload.method
    if payload.check_interval is not None:
        monitor.check_interval = payload.check_interval
    if payload.timeout is not None:
        monitor.timeout = payload.timeout
    if payload.expected_status_codes is not None:
        monitor.expected_status_codes = payload.expected_status_codes
    if payload.degraded_threshold_ms is not None:
        monitor.degraded_threshold_ms = payload.degraded_threshold_ms
    if payload.enabled is not None:
        monitor.enabled = payload.enabled

    now = datetime.now(timezone.utc)
    monitor.updated_at = now

    # Activity log
    activity = ActivityLog(
        event_type="monitor.updated",
        monitor_id=monitor.id,
        description=f"Monitor '{monitor.name}' configuration updated",
        metadata_json=f'{{"enabled": {monitor.enabled}, "interval": {monitor.check_interval}}}',
        created_at=now,
    )
    db.add(activity)

    await db.commit()
    await db.refresh(monitor)

    # Update scheduler
    if monitor.enabled:
        scheduler.schedule_monitor(monitor.id, monitor.check_interval)
    else:
        scheduler.remove_monitor(monitor.id)

    # Broadcast event
    await event_bus.broadcast(
        "monitor.updated",
        {
            "id": monitor.id,
            "name": monitor.name,
            "enabled": monitor.enabled,
            "check_interval": monitor.check_interval,
            "status": monitor.current_status,
        },
    )

    return MonitorResponse.model_validate(monitor)


@router.delete("/{monitor_id}", status_code=status.HTTP_200_OK)
async def delete_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    mon_name = monitor.name

    # Remove from scheduler
    scheduler.remove_monitor(monitor_id)

    # Log deletion in activity log before deleting
    now = datetime.now(timezone.utc)
    activity = ActivityLog(
        event_type="monitor.deleted",
        monitor_id=None,
        description=f"Monitor '{mon_name}' (ID #{monitor_id}) was deleted.",
        metadata_json=f'{{"deleted_monitor_id": {monitor_id}, "name": "{mon_name}"}}',
        created_at=now,
    )
    db.add(activity)

    await db.delete(monitor)
    await db.commit()

    # Broadcast event
    await event_bus.broadcast(
        "monitor.deleted",
        {
            "id": monitor_id,
            "name": mon_name,
        },
    )

    return {"message": f"Monitor #{monitor_id} '{mon_name}' successfully deleted."}


@router.post("/{monitor_id}/check", response_model=CheckResultResponse)
async def trigger_manual_check(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    # Run immediate check
    check_result = await monitoring_engine.run_check(monitor_id, is_manual=True)
    if not check_result:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A check for this monitor is already in progress. Please retry in a moment.",
        )

    return CheckResultResponse.model_validate(check_result)


@router.post("/{monitor_id}/pause", response_model=MonitorResponse)
async def pause_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    monitor.enabled = False
    now = datetime.now(timezone.utc)
    monitor.updated_at = now

    scheduler.remove_monitor(monitor_id)

    activity = ActivityLog(
        event_type="monitor.paused",
        monitor_id=monitor.id,
        description=f"Monitoring paused for '{monitor.name}'",
        created_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(monitor)

    await event_bus.broadcast(
        "monitor.updated",
        {"id": monitor.id, "name": monitor.name, "enabled": False, "status": monitor.current_status},
    )

    return MonitorResponse.model_validate(monitor)


@router.post("/{monitor_id}/resume", response_model=MonitorResponse)
async def resume_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    monitor.enabled = True
    now = datetime.now(timezone.utc)
    monitor.updated_at = now

    scheduler.schedule_monitor(monitor.id, monitor.check_interval)

    activity = ActivityLog(
        event_type="monitor.resumed",
        monitor_id=monitor.id,
        description=f"Monitoring resumed for '{monitor.name}'",
        created_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(monitor)

    await event_bus.broadcast(
        "monitor.updated",
        {"id": monitor.id, "name": monitor.name, "enabled": True, "status": monitor.current_status},
    )

    # Immediately queue check
    asyncio.create_task(monitoring_engine.run_check(monitor.id, is_manual=False))

    return MonitorResponse.model_validate(monitor)


@router.get("/{monitor_id}/checks", response_model=List[CheckResultResponse])
async def get_monitor_checks(
    monitor_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CheckResult)
        .where(CheckResult.monitor_id == monitor_id)
        .order_by(desc(CheckResult.checked_at))
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(query)
    checks = res.scalars().all()
    return [CheckResultResponse.model_validate(c) for c in checks]


@router.get("/{monitor_id}/analytics", response_model=AnalyticsResponse)
async def get_monitor_analytics(
    monitor_id: int,
    timeframe: str = Query("24h", pattern="^(24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Monitor).where(Monitor.id == monitor_id)
    res = await db.execute(query)
    monitor = res.scalars().first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")

    analytics = await AnalyticsService.get_detailed_analytics(db, monitor_id=monitor_id, timeframe=timeframe)
    return analytics
