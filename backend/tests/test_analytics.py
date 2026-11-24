import pytest
from datetime import datetime, timezone, timedelta
from backend.app.models.monitor import Monitor
from backend.app.models.check_result import CheckResult
from backend.app.services.analytics import AnalyticsService


@pytest.mark.asyncio
async def test_analytics_availability_calculation(db_session):
    now = datetime.now(timezone.utc)
    mon = Monitor(
        name="Analytics Test Target",
        url="https://metrics.example.com",
        method="GET",
        check_interval=60,
        timeout=5,
        expected_status_codes="200-399",
        degraded_threshold_ms=1000,
        enabled=True,
        current_status="UP",
    )
    db_session.add(mon)
    await db_session.commit()
    await db_session.refresh(mon)

    # Add 8 UP checks, 1 DEGRADED check, 1 DOWN check (total 10 checks)
    # Expected availability = (9 successful / 10 total) * 100 = 90.0%
    for i in range(8):
        db_session.add(
            CheckResult(
                monitor_id=mon.id,
                status="UP",
                http_status_code=200,
                response_time_ms=100.0 + i * 10,
                checked_at=now - timedelta(minutes=i * 5),
            )
        )
    db_session.add(
        CheckResult(
            monitor_id=mon.id,
            status="DEGRADED",
            http_status_code=200,
            response_time_ms=1500.0,
            checked_at=now - timedelta(minutes=45),
        )
    )
    db_session.add(
        CheckResult(
            monitor_id=mon.id,
            status="DOWN",
            http_status_code=500,
            response_time_ms=80.0,
            error_message="Internal Server Error",
            checked_at=now - timedelta(minutes=50),
        )
    )
    await db_session.commit()

    since = now - timedelta(hours=2)
    avail, total, successful, failed = await AnalyticsService.get_monitor_availability(
        db_session, mon.id, since
    )

    assert total == 10
    assert successful == 9
    assert failed == 1
    assert avail == 90.0

    analytics = await AnalyticsService.get_detailed_analytics(
        db_session, monitor_id=mon.id, timeframe="24h"
    )
    assert analytics.total_checks == 10
    assert analytics.successful_checks == 9
    assert analytics.failed_checks == 1
    assert analytics.availability == 90.0
    assert analytics.status_distribution.up == 8
    assert analytics.status_distribution.degraded == 1
    assert analytics.status_distribution.down == 1
    assert analytics.min_response_time_ms == 80.0
    assert analytics.max_response_time_ms == 1500.0
