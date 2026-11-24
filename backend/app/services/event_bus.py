import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Any, Set

logger = logging.getLogger(__name__)


class EventBus:
    """
    Lightweight in-process async event bus for broadcasting Server-Sent Events (SSE)
    to connected dashboard clients.
    """

    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
            logger.info("New SSE client subscribed. Total clients: %d", len(self._subscribers))
        return queue

    async def unsubscribe(self, queue: asyncio.Queue):
        async with self._lock:
            self._subscribers.discard(queue)
            logger.info("SSE client disconnected. Total clients: %d", len(self._subscribers))

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast an event to all connected clients."""
        payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        async with self._lock:
            subscribers = list(self._subscribers)

        for queue in subscribers:
            try:
                # If queue is full, drop oldest item to avoid stalling
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(payload)
            except Exception as e:
                logger.warning("Failed to queue event for subscriber: %s", e)


# Global singleton instance
event_bus = EventBus()
