"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { StatCards } from "@/dashboard/stat-cards";
import { ResponseTimeChart } from "@/dashboard/response-time-chart";
import { AvailabilityChart } from "@/dashboard/availability-chart";
import { ServiceStatusList } from "@/dashboard/service-status-list";
import { RecentIncidents } from "@/dashboard/recent-incidents";
import { RecentActivity } from "@/dashboard/recent-activity";
import { MonitorModal } from "@/monitors/monitor-modal";
import { useSSE } from "@/hooks/use-sse";
import { api } from "@/lib/api";
import {
  DashboardSummary,
  AnalyticsResponse,
  Monitor,
  Incident,
  ActivityLog,
} from "@/lib/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const [sumRes, anaRes, monRes, incRes, actRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardAnalytics("24h"),
        api.getMonitors(),
        api.getIncidents({ limit: 5 }),
        api.getActivityLogs({ limit: 8 }),
      ]);
      setSummary(sumRes);
      setAnalytics(anaRes);
      setMonitors(monRes);
      setIncidents(incRes);
      setActivityLogs(actRes);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Connect to real-time Server-Sent Events (SSE)
  const { status: sseStatus } = useSSE(
    useCallback((event: string) => {
      // Refresh dashboard on real-time backend updates
      if (
        [
          "monitor.status_changed",
          "monitor.created",
          "monitor.updated",
          "monitor.deleted",
          "incident.created",
          "incident.resolved",
          "monitor.check_completed",
        ].includes(event)
      ) {
        fetchDashboardData(false);
      }
    }, [fetchDashboardData])
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Monitoring Overview"
        subtitle="Live telemetry and system health across public web endpoints"
        sseStatus={sseStatus}
        onAddMonitor={() => setIsModalOpen(true)}
        onRefresh={() => fetchDashboardData(true)}
        isRefreshing={isRefreshing}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Core Metrics */}
        <StatCards summary={summary} isLoading={isLoading} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponseTimeChart
            data={analytics?.response_time_series || []}
            timeframe="24h"
            isLoading={isLoading}
          />
          <AvailabilityChart
            data={analytics?.availability_series || []}
            timeframe="24h"
            overallAvailability={summary?.overall_availability}
            isLoading={isLoading}
          />
        </div>

        {/* Active Service Status Table */}
        <ServiceStatusList
          monitors={monitors}
          isLoading={isLoading}
          onCheckCompleted={() => fetchDashboardData(false)}
        />

        {/* Incident History & Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentIncidents incidents={incidents} isLoading={isLoading} />
          <RecentActivity logs={activityLogs} isLoading={isLoading} />
        </div>
      </div>

      <MonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => fetchDashboardData(true)}
      />
    </div>
  );
}
