"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Activity, Clock, ExternalLink, Filter } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { ActivityLog } from "@/lib/types";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const event_type = eventTypeFilter === "ALL" ? undefined : eventTypeFilter;
      const data = await api.getActivityLogs({ event_type, limit: 100 });
      setLogs(data);
    } catch (err) {
      console.error("Failed to load activity logs", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventTypeFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const { status: sseStatus } = useSSE(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const filterOptions = [
    { label: "All Events", value: "ALL" },
    { label: "Status Changes", value: "monitor.status_changed" },
    { label: "Monitor Created", value: "monitor.created" },
    { label: "Monitor Updated", value: "monitor.updated" },
    { label: "Manual Checks", value: "manual_check" },
    { label: "Incident Created", value: "incident.created" },
    { label: "Incident Resolved", value: "incident.resolved" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Audit & Activity Logs"
        subtitle="Chronological audit trail of monitoring checks, status changes, and incident lifecycles"
        sseStatus={sseStatus}
        onRefresh={loadLogs}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEventTypeFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none whitespace-nowrap ${
                eventTypeFilter === opt.value
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Event Type</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-4 py-3.5">Monitor</th>
                  <th className="px-6 py-3.5">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-24" /></td>
                      <td className="px-4 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-24" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-64" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-20" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-32" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <Activity className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                        No activity records found
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Activity will record automatically as system actions and health checks occur.
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isIncident = log.event_type.startsWith("incident");
                    const isStatus = log.event_type === "monitor.status_changed";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="px-6 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold border ${
                              isIncident
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                                : isStatus
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {log.event_type}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                          {log.description}
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {log.monitor_id ? (
                            <Link
                              href={`/monitors/${log.monitor_id}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              {log.monitor_name || `#${log.monitor_id}`}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-[11px] font-mono text-slate-400 max-w-xs truncate">
                          {log.metadata_json || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
