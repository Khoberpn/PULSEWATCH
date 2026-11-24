from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_

from backend.app.database import get_db
from backend.app.models.incident import Incident, IncidentStatus
from backend.app.models.monitor import Monitor
from backend.app.models.activity_log import ActivityLog
from backend.app.schemas.incident import IncidentResponse, IncidentUpdate
from backend.app.services.event_bus import event_bus

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    monitor_id: Optional[int] = Query(None, description="Filter by monitor ID"),
    status: Optional[str] = Query(None, description="Filter by status (INVESTIGATING, IDENTIFIED, MONITORING, RESOLVED)"),
    is_active: Optional[bool] = Query(None, description="Filter active (unresolved) incidents"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Incident, Monitor.name.label("monitor_name"), Monitor.url.label("monitor_url"))
        .join(Monitor, Incident.monitor_id == Monitor.id)
        .order_by(desc(Incident.started_at))
        .offset(offset)
        .limit(limit)
    )

    conditions = []
    if monitor_id is not None:
        conditions.append(Incident.monitor_id == monitor_id)
    if status:
        conditions.append(Incident.status == status.upper())
    if is_active is True:
        conditions.append(Incident.status != IncidentStatus.RESOLVED.value)
    elif is_active is False:
        conditions.append(Incident.status == IncidentStatus.RESOLVED.value)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    rows = result.all()

    incidents = []
    for inc, mon_name, mon_url in rows:
        data = IncidentResponse.model_validate(inc)
        data.monitor_name = mon_name
        data.monitor_url = mon_url
        incidents.append(data)

    return incidents


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Incident, Monitor.name.label("monitor_name"), Monitor.url.label("monitor_url"))
        .join(Monitor, Incident.monitor_id == Monitor.id)
        .where(Incident.id == incident_id)
    )
    res = await db.execute(query)
    row = res.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    inc, mon_name, mon_url = row
    data = IncidentResponse.model_validate(inc)
    data.monitor_name = mon_name
    data.monitor_url = mon_url
    return data


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(Incident).where(Incident.id == incident_id)
    res = await db.execute(query)
    incident = res.scalars().first()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    now = datetime.now(timezone.utc)
    previous_status = incident.status

    if payload.description is not None:
        incident.description = payload.description

    if payload.status is not None:
        incident.status = payload.status
        if payload.status == IncidentStatus.RESOLVED.value and not incident.resolved_at:
            incident.resolved_at = now
            started_at = incident.started_at
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            downtime = max(0.0, (now - started_at).total_seconds())
            incident.downtime_seconds = round(downtime, 1)

    incident.updated_at = now

    # Activity log
    activity = ActivityLog(
        event_type="incident.updated",
        monitor_id=incident.monitor_id,
        description=f"Incident #{incident.id} updated: status {previous_status} -> {incident.status}",
        metadata_json=f'{{"status": "{incident.status}"}}',
        created_at=now,
    )
    db.add(activity)

    await db.commit()
    await db.refresh(incident)

    # Get monitor details
    mon_query = select(Monitor).where(Monitor.id == incident.monitor_id)
    mon_res = await db.execute(mon_query)
    monitor = mon_res.scalars().first()

    data = IncidentResponse.model_validate(incident)
    if monitor:
        data.monitor_name = monitor.name
        data.monitor_url = monitor.url

    # Broadcast event if resolved
    if incident.status == IncidentStatus.RESOLVED.value and previous_status != IncidentStatus.RESOLVED.value:
        await event_bus.broadcast(
            "incident.resolved",
            {
                "incident_id": incident.id,
                "monitor_id": incident.monitor_id,
                "monitor_name": monitor.name if monitor else None,
                "status": incident.status,
                "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
                "downtime_seconds": incident.downtime_seconds,
            },
        )

    return data
