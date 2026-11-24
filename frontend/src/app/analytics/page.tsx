"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  PieChart as PieIcon,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { ResponseTimeChart } from "@/dashboard/response-time-chart";
import { AvailabilityChart } from "@/dashboard/availability-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { AnalyticsResponse } from "@/lib/types";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { formatLatency } from "@/lib/utils";

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d">("24h");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getDashboardAnalytics(timeframe);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const { status: sseStatus } = useSSE(
    useCallback((event: string) => {
      if (["monitor.check_completed", "monitor.status_changed"].includes(event)) {
        loadAnalytics();
      }
    }, [loadAnalytics])
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Historical Analytics"
        subtitle="Long-term availability trends, latency distribution, and failure analysis"
        sseStatus={sseStatus}
        onRefresh={loadAnalytics}
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Timeframe Selector Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Aggregated System Performance
            </h2>
            <p className="text-xs text-slate-500">
              Computed across all registered and active endpoints
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg text-xs font-semibold">
            {(["24h", "7d", "30d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-md transition ${
                  timeframe === t
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Last {t === "24h" ? "24 Hours" : t === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Availability
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics?.availability !== undefined ? `${analytics.availability.toFixed(1)}%` : "100.0%"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {analytics?.successful_checks} / {analytics?.total_checks} successful
            </div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Avg Response
            </span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatLatency(analytics?.avg_response_time_ms)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Mean HTTP latency</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              95th Percentile
            </span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatLatency(analytics?.p95_response_time_ms)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">p95 response time</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Min Latency
            </span>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              {formatLatency(analytics?.min_response_time_ms)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Fastest sample</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Max Latency
            </span>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              {formatLatency(analytics?.max_response_time_ms)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Slowest sample</div>
          </Card>

          <Card className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Checks Performed
            </span>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              {analytics?.total_checks || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {analytics?.failed_checks || 0} failures detected
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponseTimeChart
            data={analytics?.response_time_series || []}
            title="Aggregated Latency Trend"
            timeframe={timeframe}
            isLoading={isLoading}
          />
          <AvailabilityChart
            data={analytics?.availability_series || []}
            title="Aggregated Availability Trend"
            timeframe={timeframe}
            overallAvailability={analytics?.availability}
            isLoading={isLoading}
          />
        </div>

        {/* Status Distribution & HTTP Codes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-slate-500" />
                <CardTitle>Health Classification Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Operational (UP)
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {analytics?.status_distribution.up || 0} checks
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        analytics?.total_checks
                          ? ((analytics.status_distribution.up / analytics.total_checks) * 100).toFixed(1)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Degraded Performance
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {analytics?.status_distribution.degraded || 0} checks
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        analytics?.total_checks
                          ? ((analytics.status_distribution.degraded / analytics.total_checks) * 100).toFixed(1)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Outage (DOWN)
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {analytics?.status_distribution.down || 0} checks
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        analytics?.total_checks
                          ? ((analytics.status_distribution.down / analytics.total_checks) * 100).toFixed(1)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HTTP Status Code Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500" />
                <CardTitle>HTTP Response Codes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {analytics?.status_code_distribution &&
              Object.keys(analytics.status_code_distribution).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(analytics.status_code_distribution).map(([code, count]) => {
                    const isSuccess = code.startsWith("2") || code.startsWith("3");
                    return (
                      <div
                        key={code}
                        className={`p-3 rounded-lg border text-center ${
                          isSuccess
                            ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          {code === "ERR" ? "Error / Timeout" : `HTTP ${code}`}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {count} {count === 1 ? "response" : "responses"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">
                  No status code samples recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Methodology & Measurement Disclaimer Card */}
        <Card className="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-200">
                Measurement Methodology & Limitations:
              </span>
              <p>
                Availability is calculated as:{" "}
                <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded-sm font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  Availability = (Successful Checks / Total Completed Checks) × 100
                </code>
                . A check is classified as successful when the HTTP response code matches the monitor's expected range (e.g. 200–399) and the request does not time out. Because periodic sampling checks at configured intervals (e.g. 60s), this represents sampled statistical availability rather than microsecond continuous uptime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
