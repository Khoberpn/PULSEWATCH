import {
  Monitor,
  MonitorCreatePayload,
  MonitorUpdatePayload,
  CheckResult,
  Incident,
  ActivityLog,
  DashboardSummary,
  AnalyticsResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorDetail = "Request failed";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Dashboard
  getDashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  getDashboardAnalytics: (timeframe: string = "24h") =>
    request<AnalyticsResponse>(`/api/dashboard/analytics?timeframe=${timeframe}`),

  // Monitors
  getMonitors: (params?: { search?: string; status?: string; enabled?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append("search", params.search);
    if (params?.status) q.append("status", params.status);
    if (params?.enabled !== undefined) q.append("enabled", String(params.enabled));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<Monitor[]>(`/api/monitors${qs}`);
  },
  getMonitor: (id: number) => request<Monitor>(`/api/monitors/${id}`),
  createMonitor: (payload: MonitorCreatePayload) =>
    request<Monitor>("/api/monitors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMonitor: (id: number, payload: MonitorUpdatePayload) =>
    request<Monitor>(`/api/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteMonitor: (id: number) =>
    request<{ message: string }>(`/api/monitors/${id}`, {
      method: "DELETE",
    }),
  triggerCheck: (id: number) =>
    request<CheckResult>(`/api/monitors/${id}/check`, {
      method: "POST",
    }),
  pauseMonitor: (id: number) =>
    request<Monitor>(`/api/monitors/${id}/pause`, {
      method: "POST",
    }),
  resumeMonitor: (id: number) =>
    request<Monitor>(`/api/monitors/${id}/resume`, {
      method: "POST",
    }),
  getMonitorChecks: (id: number, limit: number = 50) =>
    request<CheckResult[]>(`/api/monitors/${id}/checks?limit=${limit}`),
  getMonitorAnalytics: (id: number, timeframe: string = "24h") =>
    request<AnalyticsResponse>(`/api/monitors/${id}/analytics?timeframe=${timeframe}`),

  // Incidents
  getIncidents: (params?: { monitor_id?: number; status?: string; is_active?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.monitor_id) q.append("monitor_id", String(params.monitor_id));
    if (params?.status) q.append("status", params.status);
    if (params?.is_active !== undefined) q.append("is_active", String(params.is_active));
    if (params?.limit) q.append("limit", String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<Incident[]>(`/api/incidents${qs}`);
  },
  getIncident: (id: number) => request<Incident>(`/api/incidents/${id}`),
  updateIncident: (id: number, payload: { status?: string; description?: string }) =>
    request<Incident>(`/api/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Activity Logs
  getActivityLogs: (params?: { monitor_id?: number; event_type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.monitor_id) q.append("monitor_id", String(params.monitor_id));
    if (params?.event_type) q.append("event_type", params.event_type);
    if (params?.limit) q.append("limit", String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<ActivityLog[]>(`/api/activity${qs}`);
  },

  // Health
  getHealth: () => request<any>("/api/health"),
};
