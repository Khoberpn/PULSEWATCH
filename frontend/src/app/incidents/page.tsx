"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { Select } from "@/ui/select";
import { Incident, IncidentStatus } from "@/lib/types";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatRelativeTime, formatDuration } from "@/lib/utils";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      const is_active = filter === "ACTIVE" ? true : filter === "RESOLVED" ? false : undefined;
      const data = await api.getIncidents({ is_active, limit: 100 });
      setIncidents(data);
    } catch (err) {
      console.error("Failed to load incidents", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const { status: sseStatus } = useSSE(
    useCallback((event: string) => {
      if (["incident.created", "incident.resolved", "monitor.status_changed"].includes(event)) {
        loadIncidents();
      }
    }, [loadIncidents])
  );

  const handleOpenEdit = (inc: Incident) => {
    setEditingIncident(inc);
    setUpdateStatus(inc.status);
    setUpdateNotes(inc.description || "");
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;
    setIsUpdating(true);
    try {
      await api.updateIncident(editingIncident.id, {
        status: updateStatus,
        description: updateNotes,
      });
      toast({
        title: "Incident Updated",
        description: `Incident #${editingIncident.id} status changed to ${updateStatus}.`,
        variant: "success",
      });
      setEditingIncident(null);
      loadIncidents();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const activeCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Incident Lifecycle Management"
        subtitle="Track outages, downtime impact, investigation status, and resolution"
        sseStatus={sseStatus}
        onRefresh={loadIncidents}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Status banner if active outages */}
        {activeCount > 0 && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  {activeCount} Active {activeCount === 1 ? "Outage" : "Outages"} Detected
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  Automated checks detected service disruption. Investigation lifecycle active.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
              onClick={() => setFilter("ACTIVE")}
            >
              Filter Active
            </Button>
          </div>
        )}

        {/* Filter Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(["ALL", "ACTIVE", "RESOLVED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none ${
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                }`}
              >
                {f} {f === "ACTIVE" && activeCount > 0 ? `(${activeCount})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Incidents Timeline / List */}
        <Card>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-1/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-sm w-2/3" />
                  </div>
                ))}
              </div>
            ) : incidents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  No Incidents Found
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {filter === "ACTIVE"
                    ? "No unresolved outages currently active."
                    : "No incidents recorded in the system."}
                </p>
              </div>
            ) : (
              incidents.map((inc) => {
                const isResolved = inc.status === "RESOLVED";

                return (
                  <div
                    key={inc.id}
                    className="p-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            isResolved ? "bg-emerald-500" : "bg-rose-500 animate-ping"
                          }`}
                        />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {inc.title}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border uppercase ${
                            isResolved
                              ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                              : inc.status === "INVESTIGATING"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400"
                              : inc.status === "IDENTIFIED"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400"
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>

                      {inc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-5.5">
                          {inc.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono pl-5.5 pt-1">
                        {inc.monitor_name && (
                          <Link
                            href={`/monitors/${inc.monitor_id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-sans font-medium"
                          >
                            {inc.monitor_name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        <span>Started: {formatDate(inc.started_at)}</span>
                        {inc.resolved_at && (
                          <span>Resolved: {formatDate(inc.resolved_at)}</span>
                        )}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Downtime: {isResolved ? formatDuration(inc.downtime_seconds) : "Ongoing"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 pl-5.5 md:pl-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(inc)}
                        className="gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Update Status
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Update Incident Modal */}
      <Modal
        isOpen={Boolean(editingIncident)}
        onClose={() => setEditingIncident(null)}
        title="Update Incident Lifecycle"
        description="Update current incident status or append technical notes."
      >
        <form onSubmit={handleSaveIncident} className="space-y-4">
          <Select
            label="Lifecycle State"
            value={updateStatus}
            onChange={(e) => setUpdateStatus(e.target.value)}
            options={[
              { label: "INVESTIGATING — Outage detected, triaging", value: "INVESTIGATING" },
              { label: "IDENTIFIED — Root cause discovered", value: "IDENTIFIED" },
              { label: "MONITORING — Fix deployed, watching telemetry", value: "MONITORING" },
              { label: "RESOLVED — Service operating normally", value: "RESOLVED" },
            ]}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Investigation Notes / Root Cause
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 p-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              placeholder="e.g. Network peering failure at upstream ISP, failover completed."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingIncident(null)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Save Incident
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
