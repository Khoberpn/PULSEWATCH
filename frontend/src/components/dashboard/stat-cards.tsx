import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Activity, Clock, ShieldAlert } from "lucide-react";
import { DashboardSummary } from "@/lib/types";
import { Card } from "@/ui/card";
import { formatLatency } from "@/lib/utils";

interface StatCardsProps {
  summary: DashboardSummary | null;
  isLoading?: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({ summary, isLoading = false }) => {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-sm w-16 mb-3" />
            <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded-sm w-12" />
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Operational",
      value: summary.operational_monitors,
      total: summary.total_monitors,
      icon: CheckCircle2,
      textColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      subtext: `${summary.total_monitors} total monitors`,
    },
    {
      title: "Degraded",
      value: summary.degraded_monitors,
      icon: AlertTriangle,
      textColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      borderColor: "border-amber-200 dark:border-amber-800",
      subtext: "Latency threshold exceeded",
    },
    {
      title: "Down",
      value: summary.down_monitors,
      icon: XCircle,
      textColor: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/40",
      borderColor: "border-rose-200 dark:border-rose-800",
      subtext: summary.down_monitors > 0 ? "Action required" : "Zero outages",
    },
    {
      title: "Availability (24h)",
      value: `${summary.overall_availability.toFixed(1)}%`,
      icon: Activity,
      textColor:
        summary.overall_availability >= 99.0
          ? "text-emerald-600 dark:text-emerald-400"
          : summary.overall_availability >= 95.0
          ? "text-amber-600 dark:text-amber-400"
          : "text-rose-600 dark:text-rose-400",
      bgColor: "bg-slate-50 dark:bg-slate-900",
      borderColor: "border-slate-200 dark:border-slate-800",
      subtext: `${summary.recent_checks_count} checks recorded`,
    },
    {
      title: "Avg Latency (24h)",
      value: formatLatency(summary.avg_response_time_ms),
      icon: Clock,
      textColor: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-slate-50 dark:bg-slate-900",
      borderColor: "border-slate-200 dark:border-slate-800",
      subtext: "Across active targets",
    },
    {
      title: "Active Incidents",
      value: summary.active_incidents,
      icon: ShieldAlert,
      textColor:
        summary.active_incidents > 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-600 dark:text-slate-400",
      bgColor:
        summary.active_incidents > 0
          ? "bg-rose-50 dark:bg-rose-950/40"
          : "bg-slate-50 dark:bg-slate-900",
      borderColor:
        summary.active_incidents > 0
          ? "border-rose-200 dark:border-rose-800"
          : "border-slate-200 dark:border-slate-800",
      subtext: summary.active_incidents > 0 ? "Under investigation" : "All services stable",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className={`p-4 border ${c.borderColor} ${c.bgColor} transition-shadow hover:shadow-xs`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {c.title}
              </span>
              <Icon className={`h-4 w-4 ${c.textColor}`} />
            </div>
            <div className={`text-2xl font-bold tracking-tight ${c.textColor}`}>{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {c.subtext}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
