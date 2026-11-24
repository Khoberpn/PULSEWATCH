import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_create_monitor_validation(client):
    # Missing required field
    res = await client.post("/api/monitors", json={})
    assert res.status_code == 422

    # Invalid scheme
    res = await client.post(
        "/api/monitors",
        json={"name": "Bad URL", "url": "ftp://example.com", "method": "GET"},
    )
    assert res.status_code == 422

    # Invalid status code pattern
    res = await client.post(
        "/api/monitors",
        json={
            "name": "Bad Codes",
            "url": "https://example.com",
            "expected_status_codes": "abc-xyz",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_and_manage_monitor_lifecycle(client):
    # Mock validate_url_for_ssrf to bypass network DNS during test
    with patch("backend.app.api.endpoints.monitors.validate_url_for_ssrf", return_value=("https", "api.example.com", 443)):
        # 1. Create monitor
        create_payload = {
            "name": "API Service",
            "url": "https://api.example.com/health",
            "method": "GET",
            "check_interval": 30,
            "timeout": 5,
            "expected_status_codes": "200-299",
            "degraded_threshold_ms": 800,
            "enabled": True,
        }
        res = await client.post("/api/monitors", json=create_payload)
        assert res.status_code == 201
        data = res.json()
        monitor_id = data["id"]
        assert data["name"] == "API Service"
        assert data["current_status"] == "PENDING"
        assert data["check_interval"] == 30

        # 2. List monitors
        res = await client.get("/api/monitors")
        assert res.status_code == 200
        monitors = res.json()
        assert any(m["id"] == monitor_id for m in monitors)

        # 3. Get monitor detail
        res = await client.get(f"/api/monitors/{monitor_id}")
        assert res.status_code == 200
        assert res.json()["id"] == monitor_id

        # 4. Update monitor
        res = await client.patch(
            f"/api/monitors/{monitor_id}",
            json={"name": "API Service Production", "check_interval": 60},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "API Service Production"
        assert res.json()["check_interval"] == 60

        # 5. Pause monitor
        res = await client.post(f"/api/monitors/{monitor_id}/pause")
        assert res.status_code == 200
        assert res.json()["enabled"] is False

        # 6. Resume monitor
        res = await client.post(f"/api/monitors/{monitor_id}/resume")
        assert res.status_code == 200
        assert res.json()["enabled"] is True

        # 7. Delete monitor
        res = await client.delete(f"/api/monitors/{monitor_id}")
        assert res.status_code == 200

        # Verify 404 after deletion
        res = await client.get(f"/api/monitors/{monitor_id}")
        assert res.status_code == 404
