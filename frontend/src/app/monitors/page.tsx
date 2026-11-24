"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Edit2,
  Trash2,
  Plus,
  Search,
  ExternalLink,
  Radio,
  Clock,
  Activity,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/monitors/status-badge";
import { MonitorModal } from "@/monitors/monitor-modal";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Modal } from "@/ui/modal";
import { Monitor } from "@/lib/types";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "@/hooks/use-toast";
import { formatLatency, formatRelativeTime } from "@/lib/utils";

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Monitor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Record<number, boolean>>({});

  const loadMonitors = useCallback(async () => {
    try {
      const data = await api.getMonitors();
      setMonitors(data);
    } catch (err) {
      console.error("Failed to load monitors", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  const { status: sseStatus } = useSSE(
    useCallback((event: string) => {
      if (
        [
          "monitor.status_changed",
          "monitor.created",
          "monitor.updated",
          "monitor.deleted",
          "monitor.check_completed",
        ].includes(event)
      ) {
        loadMonitors();
      }
    }, [loadMonitors])
  );

  const handleManualCheck = async (monitor: Monitor) => {
    setCheckingIds((prev) => ({ ...prev, [monitor.id]: true }));
    try {
      const res = await api.triggerCheck(monitor.id);
      toast({
        title: `Check Completed: ${monitor.name}`,
        description: `Result: ${res.status} (${formatLatency(res.response_time_ms)})`,
        variant: res.status === "UP" ? "success" : res.status === "DEGRADED" ? "warning" : "error",
      });
      loadMonitors();
    } catch (err: any) {
      toast({
        title: "Check Failed",
        description: err.message || "Failed to trigger manual check.",
        variant: "error",
      });
    } finally {
      setCheckingIds((prev) => ({ ...prev, [monitor.id]: false }));
    }
  };

  const handleTogglePause = async (monitor: Monitor) => {
    try {
      if (monitor.enabled) {
        await api.pauseMonitor(monitor.id);
        toast({
          title: "Monitor Paused",
          description: `Checks suspended for "${monitor.name}".`,
          variant: "warning",
        });
      } else {
        await api.resumeMonitor(monitor.id);
        toast({
          title: "Monitor Resumed",
          description: `Scheduled checks resumed for "${monitor.name}".`,
          variant: "success",
        });
      }
      loadMonitors();
    } catch (err: any) {
      toast({
        title: "Operation Failed",
        description: err.message || "Could not update monitor status.",
        variant: "error",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteMonitor(deleteTarget.id);
      toast({
        title: "Monitor Deleted",
        description: `"${deleteTarget.name}" has been permanently removed.`,
        variant: "default",
      });
      setDeleteTarget(null);
      loadMonitors();
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.message || "Could not delete monitor.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter monitors
  const filteredMonitors = monitors.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.url.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "PAUSED") return !m.enabled;
    if (statusFilter === "UP") return m.enabled && m.current_status === "UP";
    if (statusFilter === "DEGRADED") return m.enabled && m.current_status === "DEGRADED";
    if (statusFilter === "DOWN") return m.enabled && m.current_status === "DOWN";

    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Monitors Management"
        subtitle="Configure, evaluate, and inspect target web endpoints"
        sseStatus={sseStatus}
        onAddMonitor={() => {
          setEditingMonitor(null);
          setIsModalOpen(true);
        }}
        onRefresh={loadMonitors}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search monitors or URLs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "UP", "DEGRADED", "DOWN", "PAUSED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none ${
                  statusFilter === st
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Monitors Grid/Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5">Monitor Name & Target</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Method & Interval</th>
                  <th className="px-4 py-3.5">Latency</th>
                  <th className="px-4 py-3.5">24h Availability</th>
                  <th className="px-4 py-3.5">Last Check</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-40 mb-1" />
                        <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-sm w-60" />
                      </td>
                      <td className="px-4 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-20" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-16" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-12" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-20" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-md w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredMonitors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <Radio className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                        No monitors match the filter criteria
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your search terms or create a new monitor.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredMonitors.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/monitors/${m.id}`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5"
                        >
                          {m.name}
                        </Link>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                          {m.url}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={m.current_status} enabled={m.enabled} />
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{m.method}</span> / every {m.check_interval}s
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {formatLatency(m.avg_response_time_24h)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`text-xs font-bold ${
                            (m.uptime_24h ?? 100) >= 99
                              ? "text-emerald-600 dark:text-emerald-400"
                              : (m.uptime_24h ?? 100) >= 95
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {m.uptime_24h !== undefined ? `${m.uptime_24h.toFixed(1)}%` : "100.0%"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(m.last_checked_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Run Check */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManualCheck(m)}
                            isLoading={checkingIds[m.id]}
                            title="Execute Manual Check Now"
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </Button>

                          {/* Pause / Resume */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePause(m)}
                            title={m.enabled ? "Pause Monitoring" : "Resume Monitoring"}
                          >
                            {m.enabled ? (
                              <Pause className="h-3 w-3 text-amber-600" />
                            ) : (
                              <Play className="h-3 w-3 text-emerald-600" />
                            )}
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingMonitor(m);
                              setIsModalOpen(true);
                            }}
                            title="Edit Configuration"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(m)}
                            className="text-rose-600 hover:text-rose-700 hover:border-rose-300"
                            title="Delete Monitor"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create / Edit Modal */}
      <MonitorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMonitor(null);
        }}
        onSaved={loadMonitors}
        monitor={editingMonitor}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Monitor Deletion"
        description="This action cannot be undone. All check results and incident logs for this monitor will be removed."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deleteTarget?.name}"
            </span>{" "}
            targeting <span className="font-mono text-xs">{deleteTarget?.url}</span>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
            >
              Delete Monitor
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
