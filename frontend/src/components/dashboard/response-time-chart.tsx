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
import { formatLatency } from "@/lib/utils";

interface ResponseTimeChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  timeframe?: string;
  isLoading?: boolean;
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  data,
  title = "Response Time Performance",
  timeframe = "24h",
  isLoading = false,
}) => {
  const hasData = data && data.length > 0 && data.some((d) => d.value > 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Average HTTP latency trend ({timeframe})
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[260px] pt-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <p className="text-sm font-medium">Insufficient Latency Data</p>
            <p className="text-xs mt-1 max-w-xs text-slate-500">
              Response time metrics will populate automatically as scheduled health checks complete.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
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
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as TimeSeriesPoint;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-md shadow-lg text-xs">
                        <div className="text-slate-400 font-mono text-[10px]">{item.timestamp}</div>
                        <div className="font-semibold text-indigo-300 mt-0.5">
                          Latency: {formatLatency(item.value)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4F46E5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#latencyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
