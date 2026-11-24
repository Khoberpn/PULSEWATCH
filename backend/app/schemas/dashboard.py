from typing import List, Dict, Optional, Any
from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_monitors: int
    operational_monitors: int
    degraded_monitors: int
    down_monitors: int
    paused_monitors: int
    overall_availability: float
    avg_response_time_ms: float
    active_incidents: int
    recent_checks_count: int


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: float
    total_checks: Optional[int] = None
    successful_checks: Optional[int] = None


class StatusDistribution(BaseModel):
    up: int
    degraded: int
    down: int


class AnalyticsResponse(BaseModel):
    timeframe: str
    availability: float
    availability_24h: float
    availability_7d: float
    availability_30d: float
    avg_response_time_ms: float
    p95_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    total_checks: int
    successful_checks: int
    failed_checks: int
    response_time_series: List[TimeSeriesPoint]
    availability_series: List[TimeSeriesPoint]
    status_distribution: StatusDistribution
    status_code_distribution: Dict[str, int]
