import asyncio
import pytest
from backend.app.services.event_bus import EventBus


@pytest.mark.asyncio
async def test_event_bus_pubsub():
    bus = EventBus()
    queue = await bus.subscribe()

    await bus.broadcast("monitor.created", {"id": 1, "name": "Test Monitor"})

    # Queue should receive event
    item = await asyncio.wait_for(queue.get(), timeout=2.0)
    assert item["event"] == "monitor.created"
    assert item["data"]["id"] == 1
    assert item["data"]["name"] == "Test Monitor"
    assert "timestamp" in item

    # Unsubscribe
    await bus.unsubscribe(queue)
    assert len(bus._subscribers) == 0
