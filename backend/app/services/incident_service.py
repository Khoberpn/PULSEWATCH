import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.models.monitor import Monitor
from backend.app.models.incident import Incident, IncidentStatus
from backend.app.models.activity_log import ActivityLog
from backend.app.services.event_bus import event_bus

logger = logging.getLogger(__name__)


class IncidentService:
    @staticmethod
    async def get_active_incident(session: AsyncSession, monitor_id: int) -> Optional[Incident]:
        """Find any ongoing unresolved incident for the monitor."""
        query = select(Incident).where(
            and_(
                Incident.monitor_id == monitor_id,
                Incident.status != IncidentStatus.RESOLVED.value,
            )
        ).order_by(Incident.started_at.desc())
        result = await session.execute(query)
        return result.scalars().first()

    @staticmethod
    async def handle_status_change(
        session: AsyncSession,
        monitor: Monitor,
        previous_status: str,
        new_status: str,
        failure_reason: Optional[str] = None,
    ) -> Optional[Incident]:
        """
        Evaluates state transitions and manages incident lifecycle:
        - UP/DEGRADED/PENDING -> DOWN: create new incident if none active
        - DOWN -> UP/DEGRADED: resolve existing active incident
        """
        now = datetime.now(timezone.utc)

        # Transition to DOWN
        if new_status == "DOWN" and previous_status != "DOWN":
            active_incident = await IncidentService.get_active_incident(session, monitor.id)
            if not active_incident:
                title = f"Outage detected: {monitor.name}"
                desc = failure_reason or f"Monitor {monitor.name} ({monitor.url}) failed health check."
                incident = Incident(
                    monitor_id=monitor.id,
                    title=title,
                    description=desc,
                    status=IncidentStatus.INVESTIGATING.value,
                    started_at=now,
                )
                session.add(incident)
                await session.flush()

                # Log activity
                log_entry = ActivityLog(
                    event_type="incident.created",
                    monitor_id=monitor.id,
                    description=f"Incident opened: {title}",
                    metadata_json=f'{{"incident_id": {incident.id}, "reason": "{failure_reason or ""}"}}',
                    created_at=now,
                )
                session.add(log_entry)
                await session.flush()

                # Broadcast event
                await event_bus.broadcast(
                    "incident.created",
                    {
                        "incident_id": incident.id,
                        "monitor_id": monitor.id,
                        "monitor_name": monitor.name,
                        "title": title,
                        "status": incident.status,
                        "started_at": incident.started_at.isoformat(),
                        "description": incident.description,
                    },
                )
                logger.warning("Created incident #%d for monitor %s", incident.id, monitor.name)
                return incident

        # Recovery from DOWN to UP or DEGRADED
        elif new_status in ("UP", "DEGRADED") and previous_status == "DOWN":
            active_incident = await IncidentService.get_active_incident(session, monitor.id)
            if active_incident:
                active_incident.status = IncidentStatus.RESOLVED.value
                active_incident.resolved_at = now
                started_at = active_incident.started_at
                # If timezone naive, localize to utc
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                downtime = max(0.0, (now - started_at).total_seconds())
                active_incident.downtime_seconds = round(downtime, 1)

                log_entry = ActivityLog(
                    event_type="incident.resolved",
                    monitor_id=monitor.id,
                    description=f"Incident #{active_incident.id} resolved. Service recovered ({active_incident.downtime_seconds}s downtime).",
                    metadata_json=f'{{"incident_id": {active_incident.id}, "downtime_seconds": {active_incident.downtime_seconds}}}',
                    created_at=now,
                )
                session.add(log_entry)
                await session.flush()

                await event_bus.broadcast(
                    "incident.resolved",
                    {
                        "incident_id": active_incident.id,
                        "monitor_id": monitor.id,
                        "monitor_name": monitor.name,
                        "title": active_incident.title,
                        "status": active_incident.status,
                        "resolved_at": active_incident.resolved_at.isoformat(),
                        "downtime_seconds": active_incident.downtime_seconds,
                    },
                )
                logger.info("Resolved incident #%d for monitor %s", active_incident.id, monitor.name)
                return active_incident

        return None
