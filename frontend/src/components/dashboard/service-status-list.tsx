"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, ArrowUpRight, ExternalLink } from "lucide-react";
import { Monitor } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { StatusBadge } from "@/monitors/status-badge";
import { Button } from "@/ui/button";
import { formatLatency, formatRelativeTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface ServiceStatusListProps {
  monitors: Monitor[];
  isLoading?: boolean;
  onCheckCompleted?: () => void;
}

export const ServiceStatusList: React.FC<ServiceStatusListProps> = ({
  monitors,
  isLoading = false,
  onCheckCompleted,
}) => {
  const [checkingIds, setCheckingIds] = useState<Record<number, boolean>>({});

  const handleManualCheck = async (e: React.MouseEvent, monitor: Monitor) => {
    e.preventDefault();
    e.stopPropagation();

    setCheckingIds((prev) => ({ ...prev, [monitor.id]: true }));
    try {
      const res = await api.triggerCheck(monitor.id);
      toast({
        title: `Check: ${monitor.name}`,
        description: `Status: ${res.status} (${formatLatency(res.response_time_ms)})`,
        variant: res.status === "UP" ? "success" : res.status === "DEGRADED" ? "warning" : "error",
      });
      if (onCheckCompleted) onCheckCompleted();
    } catch (err: any) {
      toast({
        title: "Check Failed",
        description: err.message || "Failed to execute manual check.",
        variant: "error",
      });
    } finally {
      setCheckingIds((prev) => ({ ...prev, [monitor.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Service Status Overview</CardTitle>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Current operational state of monitored endpoints
          </span>
        </div>
        <Link href="/monitors" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          View All <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
              <th className="px-6 py-3">Monitor / Endpoint</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Latency</th>
              <th className="px-4 py-3">24h Uptime</th>
              <th className="px-4 py-3">Last Checked</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-36 mb-1" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-sm w-48" />
                  </td>
                  <td className="px-4 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-12" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-20" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-md w-16 ml-auto" /></td>
                </tr>
              ))
            ) : monitors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  <p className="font-medium text-sm">No Monitors Configured</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click "Add Monitor" above to begin monitoring your first HTTP endpoint.
                  </p>
                </td>
              </tr>
            ) : (
              monitors.slice(0, 8).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/monitors/${m.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5">
                      {m.name}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 truncate max-w-sm">
                      <span className="px-1.5 py-0.2 rounded-xs bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold uppercase">
                        {m.method}
                      </span>
                      <span className="truncate">{m.url}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={m.current_status} enabled={m.enabled} />
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {formatLatency(m.avg_response_time_24h)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-xs font-semibold ${
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
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleManualCheck(e, m)}
                        isLoading={checkingIds[m.id]}
                        title="Execute Immediate Check"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span className="hidden sm:inline">Check</span>
                      </Button>
                      <Link href={`/monitors/${m.id}`}>
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
