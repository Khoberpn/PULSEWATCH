"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SSEStatus = "connecting" | "connected" | "disconnected";

export interface SSEEventData {
  event: string;
  data: any;
  timestamp: string;
}

export function useSSE(onEvent?: (event: string, data: any) => void) {
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<SSEEventData | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");
    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      retryCountRef.current = 0;
    };

    const handleNamedEvent = (eventType: string) => (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventData: SSEEventData = {
          event: eventType,
          data: parsed,
          timestamp: new Date().toISOString(),
        };
        setLastEvent(eventData);
        if (onEvent) {
          onEvent(eventType, parsed);
        }
      } catch (err) {
        console.error("Failed to parse SSE payload", err);
      }
    };

    // Bind event listeners for all specified events
    const eventTypes = [
      "connected",
      "monitor.created",
      "monitor.updated",
      "monitor.deleted",
      "monitor.status_changed",
      "monitor.check_completed",
      "incident.created",
      "incident.resolved",
    ];

    eventTypes.forEach((ev) => {
      es.addEventListener(ev, handleNamedEvent(ev));
    });

    es.onerror = () => {
      setStatus("disconnected");
      es.close();

      // Exponential backoff reconnect: 1s, 2s, 4s, up to 10s
      const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
      retryCountRef.current += 1;

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [onEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return { status, lastEvent };
}
