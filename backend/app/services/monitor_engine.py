import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.database import AsyncSessionLocal
from backend.app.models.monitor import Monitor, MonitorStatus
from backend.app.models.check_result import CheckResult
from backend.app.models.activity_log import ActivityLog
from backend.app.services.http_client import MonitoringHttpClient
from backend.app.services.incident_service import IncidentService
from backend.app.services.event_bus import event_bus

logger = logging.getLogger(__name__)


def parse_expected_status_codes(codes_str: str) -> Set[int]:
    """
    Parses comma-separated codes and ranges e.g. '200-399' or '200,201,204,301-308'.
    Returns set of allowed integer HTTP status codes.
    """
    allowed_codes: Set[int] = set()
    parts = [p.strip() for p in codes_str.split(",") if p.strip()]
    for part in parts:
        if "-" in part:
            try:
                start_s, end_s = part.split("-", 1)
                start, end = int(start_s), int(end_s)
                allowed_codes.update(range(min(start, end), max(start, end) + 1))
            except ValueError:
                pass
        else:
            try:
                allowed_codes.add(int(part))
            except ValueError:
                pass

    if not allowed_codes:
        # Default fallback to 200-399
        allowed_codes.update(range(200, 400))
    return allowed_codes


def evaluate_status(
    status_code: Optional[int],
    response_time_ms: float,
    error_message: Optional[str],
    expected_codes_str: str,
    degraded_threshold_ms: int,
) -> str:
    """
    Evaluates check metrics and determines status: UP, DEGRADED, or DOWN.
    """
    if error_message is not None or status_code is None:
        return MonitorStatus.DOWN.value

    allowed_codes = parse_expected_status_codes(expected_codes_str)
    if status_code not in allowed_codes:
        return MonitorStatus.DOWN.value

    if response_time_ms > degraded_threshold_ms:
        return MonitorStatus.DEGRADED.value

    return MonitorStatus.UP.value


class MonitoringEngine:
    """
    Core engine managing execution of asynchronous health checks and persistence.
    """

    def __init__(self):
        self._check_locks: dict[int, asyncio.Lock] = {}
        self._master_lock = asyncio.Lock()
        self.http_client = MonitoringHttpClient()

    async def _get_monitor_lock(self, monitor_id: int) -> asyncio.Lock:
        async with self._master_lock:
            if monitor_id not in self._check_locks:
                self._check_locks[monitor_id] = asyncio.Lock()
            return self._check_locks[monitor_id]

    async def run_check(self, monitor_id: int, is_manual: bool = False) -> Optional[CheckResult]:
        """
        Runs a check for the specified monitor. Prevents overlapping checks.
        """
        lock = await self._get_monitor_lock(monitor_id)
        if lock.locked():
            logger.info("Check for monitor #%d is already in progress. Skipping duplicate.", monitor_id)
            return None

        async with lock:
            async with AsyncSessionLocal() as session:
                query = select(Monitor).where(Monitor.id == monitor_id)
                res = await session.execute(query)
                monitor = res.scalars().first()

                if not monitor:
                    logger.warning("Monitor #%d not found for check.", monitor_id)
                    return None

                if not monitor.enabled and not is_manual:
                    logger.info("Monitor #%d is disabled. Skipping scheduled check.", monitor_id)
                    return None

                # 1. Execute safe HTTP request
                status_code, response_time_ms, error_msg = await self.http_client.execute_check(
                    url=monitor.url,
                    method=monitor.method,
                    timeout_seconds=monitor.timeout,
                )

                # 2. Evaluate resulting status
                computed_status = evaluate_status(
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    error_message=error_msg,
                    expected_codes_str=monitor.expected_status_codes,
                    degraded_threshold_ms=monitor.degraded_threshold_ms,
                )

                # If status code unexpected but no low-level error, clarify message
                if computed_status == MonitorStatus.DOWN.value and not error_msg and status_code:
                    error_msg = f"Unexpected status code {status_code} (expected: {monitor.expected_status_codes})"

                now = datetime.now(timezone.utc)

                # 3. Persist CheckResult
                check_result = CheckResult(
                    monitor_id=monitor.id,
                    status=computed_status,
                    http_status_code=status_code,
                    response_time_ms=response_time_ms,
                    error_message=error_msg,
                    checked_at=now,
                )
                session.add(check_result)

                previous_status = monitor.current_status
                monitor.current_status = computed_status
                monitor.last_checked_at = now

                # 4. Handle Status Transitions and Incidents
                status_changed = (previous_status != computed_status)
                if status_changed:
                    await IncidentService.handle_status_change(
                        session=session,
                        monitor=monitor,
                        previous_status=previous_status,
                        new_status=computed_status,
                        failure_reason=error_msg,
                    )

                    log_entry = ActivityLog(
                        event_type="monitor.status_changed",
                        monitor_id=monitor.id,
                        description=f"Status for '{monitor.name}' changed from {previous_status} to {computed_status}",
                        metadata_json=f'{{"from": "{previous_status}", "to": "{computed_status}", "response_time_ms": {response_time_ms}}}',
                        created_at=now,
                    )
                    session.add(log_entry)

                if is_manual:
                    manual_log = ActivityLog(
                        event_type="manual_check",
                        monitor_id=monitor.id,
                        description=f"Manual check executed for '{monitor.name}': {computed_status} ({response_time_ms}ms)",
                        metadata_json=f'{{"status": "{computed_status}", "code": {status_code or 0}, "latency_ms": {response_time_ms}}}',
                        created_at=now,
                    )
                    session.add(manual_log)

                await session.commit()
                await session.refresh(check_result)

                # 5. Broadcast real-time SSE events
                if status_changed:
                    await event_bus.broadcast(
                        "monitor.status_changed",
                        {
                            "monitor_id": monitor.id,
                            "monitor_name": monitor.name,
                            "previous_status": previous_status,
                            "current_status": computed_status,
                            "response_time_ms": response_time_ms,
                            "status_code": status_code,
                            "error": error_msg,
                            "timestamp": now.isoformat(),
                        },
                    )

                await event_bus.broadcast(
                    "monitor.check_completed",
                    {
                        "check_id": check_result.id,
                        "monitor_id": monitor.id,
                        "monitor_name": monitor.name,
                        "status": computed_status,
                        "status_code": status_code,
                        "response_time_ms": response_time_ms,
                        "error": error_msg,
                        "checked_at": now.isoformat(),
                    },
                )

                logger.info(
                    "Checked monitor '%s' (#%d): status=%s, latency=%.1fms, code=%s",
                    monitor.name,
                    monitor.id,
                    computed_status,
                    response_time_ms,
                    status_code,
                )
                return check_result


monitoring_engine = MonitoringEngine()
