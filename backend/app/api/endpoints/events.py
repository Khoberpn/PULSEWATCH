import asyncio
import json
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from backend.app.services.event_bus import event_bus
from backend.app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Realtime Events"])


@router.get("/events", summary="Server-Sent Events Stream")
async def events_stream(request: Request):
    """
    Real-time Server-Sent Events stream for connected clients.
    Broadcasts monitor creation, updates, deletions, health check results, and incidents.
    """
    queue = await event_bus.subscribe()

    async def event_generator():
        try:
            # Send initial connected greeting event
            init_payload = json.dumps({"status": "connected", "message": "PulseWatch SSE Stream Active"})
            yield f"event: connected\ndata: {init_payload}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait for an event with timeout for ping
                    item = await asyncio.wait_for(
                        queue.get(),
                        timeout=settings.SSE_PING_INTERVAL_SECONDS,
                    )
                    event_type = item.get("event", "message")
                    data_str = json.dumps(item.get("data", {}))
                    yield f"event: {event_type}\ndata: {data_str}\n\n"
                except asyncio.TimeoutError:
                    # Send periodic keep-alive ping
                    yield ": ping\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            await event_bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
