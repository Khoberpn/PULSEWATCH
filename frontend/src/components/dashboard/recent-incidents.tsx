import React from "react";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Incident } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

interface RecentIncidentsProps {
  incidents: Incident[];
  isLoading?: boolean;
}

export const RecentIncidents: React.FC<RecentIncidentsProps> = ({
  incidents,
  isLoading = false,
}) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-500" />
          <CardTitle>Recent Incidents</CardTitle>
        </div>
        <Link href="/incidents" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          History <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-0 divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-sm w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-sm w-1/2" />
              </div>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No Incidents Recorded
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              All monitored endpoints are operating within normal parameters.
            </p>
          </div>
        ) : (
          incidents.slice(0, 5).map((inc) => {
            const isResolved = inc.status === "RESOLVED";

            return (
              <div key={inc.id} className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isResolved ? "bg-emerald-500" : "bg-rose-500 animate-ping"
                        }`}
                      />
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {inc.title}
                      </span>
                    </div>
                    {inc.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {inc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                      <span>Started: {formatRelativeTime(inc.started_at)}</span>
                      <span>•</span>
                      <span>
                        Downtime: {isResolved ? formatDuration(inc.downtime_seconds) : "Ongoing"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border uppercase ${
                      isResolved
                        ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400"
                    }`}
                  >
                    {inc.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
