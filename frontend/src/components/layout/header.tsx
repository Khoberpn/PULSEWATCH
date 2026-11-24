"use client";

import React, { useState, useEffect } from "react";
import { Plus, RefreshCw, Radio } from "lucide-react";
import { Button } from "@/ui/button";
import { SSEStatus } from "@/hooks/use-sse";

interface HeaderProps {
  title: string;
  subtitle?: string;
  sseStatus?: SSEStatus;
  onAddMonitor?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  sseStatus = "connected",
  onAddMonitor,
  onRefresh,
  isRefreshing = false,
}) => {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-4">
        {/* Real-time SSE indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            {sseStatus === "connected" ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </>
            ) : sseStatus === "connecting" ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse" />
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            )}
          </span>
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Radio className="h-3 w-3 text-slate-400" />
            {sseStatus === "connected"
              ? "Live SSE"
              : sseStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>

        {/* Local Clock */}
        {timeStr && (
          <span className="text-xs font-mono text-slate-400 hidden md:inline-block">
            {timeStr}
          </span>
        )}

        {/* Manual Refresh */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            title="Refresh Data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Add Monitor */}
        {onAddMonitor && (
          <Button size="sm" onClick={onAddMonitor} className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Add Monitor
          </Button>
        )}
      </div>
    </header>
  );
};
