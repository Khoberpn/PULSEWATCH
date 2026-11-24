"use client";

import React from "react";
import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import { ActivityLog } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { formatRelativeTime } from "@/lib/utils";

interface RecentActivityProps {
  logs: ActivityLog[];
  isLoading?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  logs,
  isLoading = false,
}) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
        <Link
          href="/activity"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          Full Log <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-0 divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-sm w-5/6" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-sm w-1/4" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            <p className="text-sm font-medium">No Activity Recorded</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Platform events and monitoring milestones will appear here.
            </p>
          </div>
        ) : (
          logs.slice(0, 6).map((log) => (
            <div
              key={log.id}
              className="p-3.5 px-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {log.description}
                  </span>
                  {log.monitor_name && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xs text-[10px]">
                      {log.monitor_name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap shrink-0">
                  {formatRelativeTime(log.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
