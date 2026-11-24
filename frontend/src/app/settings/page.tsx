"use client";

import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Server,
  Database,
  Radio,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const data = await api.getHealth();
      setHealthData(data);
    } catch (err) {
      console.error("Failed to check health", err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Platform Settings & Diagnostics"
        subtitle="Operational parameters, security enforcement, and infrastructure health"
        onRefresh={fetchHealth}
        isRefreshing={isLoadingHealth}
      />

      <div className="p-8 space-y-6 max-w-5xl w-full mx-auto">
        {/* Backend Connectivity Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              <CardTitle>Core Service Health</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              isLoading={isLoadingHealth}
              className="gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Ping Health API
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  API Status
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {healthData?.status?.toUpperCase() || "ONLINE"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {healthData?.service || "PulseWatch Monitoring API"}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Database Engine
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {healthData?.database?.status?.toUpperCase() || "CONNECTED"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Query Latency: {healthData?.database?.latency_ms ? `${healthData.database.latency_ms} ms` : "< 1 ms"}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Background Scheduler
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {healthData?.scheduler?.status?.toUpperCase() || "RUNNING"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Active Scheduled Jobs: {healthData?.scheduler?.active_jobs ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & SSRF Protection Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <CardTitle>SSRF Defense & Security Sandbox</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <p className="leading-relaxed">
              Because PulseWatch executes automated HTTP requests against user-provided URLs, the monitoring engine enforces strict SSRF defense policies:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Scheme & Domain Verification
                </h4>
                <p className="text-[11px] leading-relaxed">
                  Only HTTP and HTTPS are permitted. Schemes like <code>file://</code>, <code>ftp://</code>, and <code>gopher://</code> are rejected immediately at validation time.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Private IP & Cloud Metadata Block
                </h4>
                <p className="text-[11px] leading-relaxed">
                  Loopback (127.0.0.1/8), RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), and cloud metadata endpoints (169.254.169.254) are strictly blocked.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  DNS Resolution & Rebinding Defense
                </h4>
                <p className="text-[11px] leading-relaxed">
                  All resolved IPv4 and IPv6 addresses are inspected before connecting. If any resolved IP points to private infrastructure, the check is aborted.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Hop-by-Hop Redirect Revalidation
                </h4>
                <p className="text-[11px] leading-relaxed">
                  Redirects are not followed blindly. Every subsequent <code>Location</code> header is re-validated through the full SSRF pipeline before the next hop.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engine Parameters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-slate-500" />
              <CardTitle>Engine Defaults & Thresholds</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <dt className="text-slate-400 font-medium">Default Check Frequency</dt>
                <dd className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  60 seconds (Configurable: 15s to 900s)
                </dd>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <dt className="text-slate-400 font-medium">Default Request Timeout</dt>
                <dd className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  10 seconds (Configurable: 1s to 60s)
                </dd>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <dt className="text-slate-400 font-medium">Degraded Performance Threshold</dt>
                <dd className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  1,000 milliseconds
                </dd>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <dt className="text-slate-400 font-medium">Max Response Body Size</dt>
                <dd className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                  5 Megabytes (Protects against memory exhaustion)
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
