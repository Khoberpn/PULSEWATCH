import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select
from backend.app.models.monitor import Monitor
from backend.app.models.incident import Incident, IncidentStatus
from backend.app.services.monitor_engine import MonitoringEngine


@pytest.mark.asyncio
async def test_incident_lifecycle(client, db_session):
    # 1. Create monitor in UP state
    mon = Monitor(
        name="Payment Gateway",
        url="https://payment.example.com",
        method="GET",
        check_interval=60,
        timeout=5,
        expected_status_codes="200-299",
        degraded_threshold_ms=1000,
        enabled=True,
        current_status="UP",
    )
    db_session.add(mon)
    await db_session.commit()
    await db_session.refresh(mon)

    engine = MonitoringEngine()

    # 2. Simulate failure (DOWN)
    with patch.object(engine.http_client, "execute_check", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = (503, 350.0, "Service Unavailable (503)")
        await engine.run_check(mon.id, is_manual=True)

    # Verify incident created
    inc_query = select(Incident).where(Incident.monitor_id == mon.id)
    inc_res = await db_session.execute(inc_query)
    incident = inc_res.scalars().first()

    assert incident is not None
    assert incident.status == IncidentStatus.INVESTIGATING.value
    assert "Payment Gateway" in incident.title
    assert incident.resolved_at is None
    incident_id = incident.id

    # 3. Simulate another consecutive failure (DOWN) - should NOT create duplicate incident
    with patch.object(engine.http_client, "execute_check", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = (503, 400.0, "Service Unavailable (503)")
        await engine.run_check(mon.id, is_manual=True)

    all_incs = (await db_session.execute(inc_query)).scalars().all()
    assert len(all_incs) == 1, "Must not create duplicate incidents for ongoing outage"

    # 4. Simulate recovery (UP)
    with patch.object(engine.http_client, "execute_check", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = (200, 120.0, None)
        await engine.run_check(mon.id, is_manual=True)

    # Refresh incident
    await db_session.refresh(incident)
    assert incident.status == IncidentStatus.RESOLVED.value
    assert incident.resolved_at is not None
    assert incident.downtime_seconds is not None
    assert incident.downtime_seconds >= 0.0

    # 5. Test manual incident update API
    res = await client.patch(
        f"/api/incidents/{incident_id}",
        json={"description": "Root cause: upstream gateway failure resolved by cloud provider"},
    )
    assert res.status_code == 200
    assert "upstream gateway" in res.json()["description"]
