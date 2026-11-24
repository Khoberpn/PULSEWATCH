export type MonitorStatus = "UP" | "DEGRADED" | "DOWN" | "PENDING";

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: "GET" | "HEAD";
  check_interval: number;
  timeout: number;
  expected_status_codes: string;
  degraded_threshold_ms: number;
  enabled: boolean;
  current_status: MonitorStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  uptime_24h?: number;
  avg_response_time_24h?: number;
}

export interface MonitorCreatePayload {
  name: string;
  url: string;
  method: "GET" | "HEAD";
  check_interval: number;
  timeout: number;
  expected_status_codes: string;
  degraded_threshold_ms: number;
  enabled: boolean;
}

export interface MonitorUpdatePayload {
  name?: string;
  url?: string;
  method?: "GET" | "HEAD";
  check_interval?: number;
  timeout?: number;
  expected_status_codes?: string;
  degraded_threshold_ms?: number;
  enabled?: boolean;
}

export interface CheckResult {
  id: number;
  monitor_id: number;
  status: MonitorStatus;
  http_status_code: number | null;
  response_time_ms: number;
  error_message: string | null;
  checked_at: string;
}

export type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

export interface Incident {
  id: number;
  monitor_id: number;
  title: string;
  description: string | null;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  downtime_seconds: number | null;
  created_at: string;
  updated_at: string;
  monitor_name?: string;
  monitor_url?: string;
}

export interface ActivityLog {
  id: number;
  event_type: string;
  monitor_id: number | null;
  description: string;
  metadata_json: string | null;
  created_at: string;
  monitor_name?: string;
}

export interface DashboardSummary {
  total_monitors: number;
  operational_monitors: number;
  degraded_monitors: number;
  down_monitors: number;
  paused_monitors: number;
  overall_availability: number;
  avg_response_time_ms: number;
  active_incidents: number;
  recent_checks_count: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  total_checks?: number;
  successful_checks?: number;
}

export interface StatusDistribution {
  up: number;
  degraded: number;
  down: number;
}

export interface AnalyticsResponse {
  timeframe: string;
  availability: number;
  availability_24h: number;
  availability_7d: number;
  availability_30d: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  min_response_time_ms: number;
  max_response_time_ms: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  response_time_series: TimeSeriesPoint[];
  availability_series: TimeSeriesPoint[];
  status_distribution: StatusDistribution;
  status_code_distribution: Record<string, number>;
}
