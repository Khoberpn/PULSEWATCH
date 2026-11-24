"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TimeSeriesPoint } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";

interface AvailabilityChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  timeframe?: string;
  overallAvailability?: number;
  isLoading?: boolean;
}

export const AvailabilityChart: React.FC<AvailabilityChartProps> = ({
  data,
  title = "Availability Trends",
  timeframe = "24h",
  overallAvailability,
  isLoading = false,
}) => {
  const hasData = data && data.length > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Percentage of successful checks ({timeframe})
          </span>
        </div>
        {overallAvailability !== undefined && (
          <div className="text-right">
            <span className="text-xs text-slate-500">Period Avg: </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {overallAvailability.toFixed(1)}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-[260px] pt-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <p className="text-sm font-medium">Insufficient Check History</p>
            <p className="text-xs mt-1 max-w-xs text-slate-500">
              Availability percentage requires at least one completed periodic monitoring check.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="availGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
              <XAxis
                dataKey="timestamp"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748B" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as TimeSeriesPoint;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-md shadow-lg text-xs">
                        <div className="text-slate-400 font-mono text-[10px]">{item.timestamp}</div>
                        <div className="font-semibold text-emerald-400 mt-0.5">
                          Uptime: {item.value.toFixed(1)}%
                        </div>
                        {item.total_checks !== undefined && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.successful_checks} / {item.total_checks} checks successful
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#059669"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#availGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
