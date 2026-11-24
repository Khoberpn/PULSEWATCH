"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Edit2,
  Trash2,
  ExternalLink,
  Clock,
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/monitors/status-badge";
import { MonitorModal } from "@/monitors/monitor-modal";
import { ResponseTimeChart } from "@/dashboard/response-time-chart";
import { AvailabilityChart } from "@/dashboard/availability-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { Monitor, CheckResult, Incident, AnalyticsResponse } from "@/lib/types";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "@/hooks/use-toast";
import { formatLatency, formatDuration, formatRelativeTime, formatDate } from "@/lib/utils";

export default function MonitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const monitorId = Number(params?.id);

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d">("24h");
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!monitorId) return;
    try {
      const [monRes, anaRes, chkRes, incRes] = await Promise.all([
        api.getMonitor(monitorId),
        api.getMonitorAnalytics(monitorId, timeframe),
        api.getMonitorChecks(monitorId, 50),
        api.getIncidents({ monitor_id: monitorId, limit: 10 }),
      ]);
      setMonitor(monRes);
      setAnalytics(anaRes);
      setChecks(chkRes);
      setIncidents(incRes);
    } catch (err: any) {
      console.error("Failed to load monitor details", err);
      toast({
        title: "Error Loading Monitor",
        description: err.message || "Failed to retrieve monitor details.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [monitorId, timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time SSE updates
  const { status: sseStatus } = useSSE(
    useCallback((event: string, data: any) => {
      if (
        (event === "monitor.check_completed" && data?.monitor_id === monitorId) ||
        (event === "monitor.status_changed" && data?.monitor_id === monitorId) ||
        (event === "incident.created" && data?.monitor_id === monitorId) ||
        (event === "incident.resolved" && data?.monitor_id === monitorId) ||
        (event === "monitor.updated" && data?.id === monitorId)
      ) {
        loadData();
      }
    }, [monitorId, loadData])
  );

  const handleManualCheck = async () => {
    if (!monitor) return;
    setIsChecking(true);
    try {
      const res = await api.triggerCheck(monitor.id);
      toast({
        title: "Health Check Completed",
        description: `Status: ${res.status} (${formatLatency(res.response_time_ms)})`,
        variant: res.status === "UP" ? "success" : res.status === "DEGRADED" ? "warning" : "error",
      });
      loadData();
    } catch (err: any) {
      toast({
        title: "Check Failed",
        description: err.message || "Failed to trigger manual check.",
        variant: "error",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleTogglePause = async () => {
    if (!monitor) return;
    try {
      if (monitor.enabled) {
        await api.pauseMonitor(monitor.id);
        toast({
          title: "Monitor Paused",
          description: "Scheduled checks are suspended.",
          variant: "warning",
        });
      } else {
        await api.resumeMonitor(monitor.id);
        toast({
          title: "Monitor Resumed",
          description: "Scheduled checks have resumed.",
          variant: "success",
        });
      }
      loadData();
    } catch (err: any) {
      toast({
        title: "Failed to update state",
        description: err.message,
        variant: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!monitor) return;
    setIsDeleting(true);
    try {
      await api.deleteMonitor(monitor.id);
      toast({
        title: "Monitor Deleted",
        description: `"${monitor.name}" has been removed.`,
        variant: "default",
      });
      router.push("/monitors");
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.message,
        variant: "error",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading && !monitor) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="flex-1 p-8 text-center">
        <p className="text-slate-500">Monitor not found.</p>
        <Link href="/monitors" className="text-indigo-600 underline text-sm mt-2 inline-block">
          Return to monitors list
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title={monitor.name}
        subtitle={monitor.url}
        sseStatus={sseStatus}
        onRefresh={loadData}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Navigation & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/monitors"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Monitors
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualCheck}
              isLoading={isChecking}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Check Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
              className="gap-1.5"
            >
              {monitor.enabled ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-amber-600" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-emerald-600" />
                  Resume
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Status & Key Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Status
            </span>
            <StatusBadge status={monitor.current_status} enabled={monitor.enabled} />
            <div className="text-[11px] text-slate-400 mt-2 truncate">
              Last: {formatRelativeTime(monitor.last_checked_at)}
            </div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              24h Uptime
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.availability_24h !== undefined
                ? `${analytics.availability_24h.toFixed(1)}%`
                : "100.0%"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">24-hour window</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              7d Uptime
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.availability_7d !== undefined
                ? `${analytics.availability_7d.toFixed(1)}%`
                : "100.0%"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">7-day window</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              30d Uptime
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.availability_30d !== undefined
                ? `${analytics.availability_30d.toFixed(1)}%`
                : "100.0%"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">30-day window</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Avg Latency
            </span>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatLatency(analytics?.avg_response_time_ms)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              p95: {formatLatency(analytics?.p95_response_time_ms)}
            </div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Check Frequency
            </span>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {monitor.check_interval}s
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Timeout: {monitor.timeout}s
            </div>
          </Card>
        </div>

        {/* Timeframe Selector & Charts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Performance Analytics
            </h2>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              {(["24h", "7d", "30d"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1 rounded-md transition ${
                    timeframe === t
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponseTimeChart
              data={analytics?.response_time_series || []}
              title={`Latency (${timeframe})`}
              timeframe={timeframe}
              isLoading={isLoading}
            />
            <AvailabilityChart
              data={analytics?.availability_series || []}
              title={`Availability (${timeframe})`}
              timeframe={timeframe}
              overallAvailability={analytics?.availability}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Recent Checks Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Check Log</CardTitle>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Latest 50 HTTP checks executed against this endpoint
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HTTP Code</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-6 py-3">Message / Error Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {checks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No check results recorded yet.
                    </td>
                  </tr>
                ) : (
                  checks.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {formatDate(c.checked_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {c.http_status_code ? (
                          <span
                            className={`px-1.5 py-0.5 rounded-sm ${
                              c.http_status_code >= 200 && c.http_status_code < 400
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                            }`}
                          >
                            {c.http_status_code}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {formatLatency(c.response_time_ms)}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-md truncate">
                        {c.error_message || "OK — check passed"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Incidents Table for this Monitor */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <CardTitle>Monitor Outage History</CardTitle>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3">Incident Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Resolved</th>
                  <th className="px-6 py-3">Downtime Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No outages recorded for this monitor.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        {inc.title}
                        {inc.description && (
                          <p className="text-[11px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                            {inc.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border uppercase ${
                            inc.status === "RESOLVED"
                              ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400"
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(inc.started_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {inc.resolved_at ? formatDate(inc.resolved_at) : "Ongoing"}
                      </td>
                      <td className="px-6 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">
                        {formatDuration(inc.downtime_seconds)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Edit Modal */}
      <MonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        monitor={monitor}
      />

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        description="Permanently delete this monitor and all associated history."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{monitor.name}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Monitor
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
