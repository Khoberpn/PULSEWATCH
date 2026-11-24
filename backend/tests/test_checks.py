import pytest
from unittest.mock import AsyncMock, patch
from backend.app.services.monitor_engine import (
    evaluate_status,
    parse_expected_status_codes,
    MonitoringEngine,
)
from backend.app.models.monitor import Monitor, MonitorStatus


def test_parse_expected_status_codes():
    codes = parse_expected_status_codes("200-202, 204, 301-302")
    assert 200 in codes
    assert 201 in codes
    assert 202 in codes
    assert 204 in codes
    assert 301 in codes
    assert 302 in codes
    assert 400 not in codes
    assert 500 not in codes


def test_evaluate_status():
    # Healthy (UP)
    status = evaluate_status(
        status_code=200,
        response_time_ms=120.5,
        error_message=None,
        expected_codes_str="200-399",
        degraded_threshold_ms=1000,
    )
    assert status == "UP"

    # Degraded performance
    status = evaluate_status(
        status_code=200,
        response_time_ms=1550.0,
        error_message=None,
        expected_codes_str="200-399",
        degraded_threshold_ms=1000,
    )
    assert status == "DEGRADED"

    # Unexpected status code
    status = evaluate_status(
        status_code=500,
        response_time_ms=80.0,
        error_message=None,
        expected_codes_str="200-399",
        degraded_threshold_ms=1000,
    )
    assert status == "DOWN"

    # Connection error / timeout
    status = evaluate_status(
        status_code=None,
        response_time_ms=5000.0,
        error_message="Connection timed out",
        expected_codes_str="200-399",
        degraded_threshold_ms=1000,
    )
    assert status == "DOWN"


@pytest.mark.asyncio
async def test_manual_check_execution(client, db_session):
    # Create monitor directly in test DB
    mon = Monitor(
        name="Test Service",
        url="https://test.internal/health",
        method="GET",
        check_interval=60,
        timeout=5,
        expected_status_codes="200-399",
        degraded_threshold_ms=1000,
        enabled=True,
        current_status="PENDING",
    )
    db_session.add(mon)
    await db_session.commit()
    await db_session.refresh(mon)

    engine = MonitoringEngine()
    with patch.object(engine.http_client, "execute_check", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = (200, 145.2, None)
        with patch("backend.app.api.endpoints.monitors.monitoring_engine", engine):
            res = await client.post(f"/api/monitors/{mon.id}/check")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "UP"
            assert data["http_status_code"] == 200
            assert data["response_time_ms"] == 145.2

            # Check that monitor current status became UP
            mon_res = await client.get(f"/api/monitors/{mon.id}")
            assert mon_res.json()["current_status"] == "UP"
