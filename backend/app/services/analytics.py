import math
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from backend.app.models.check_result import CheckResult
from backend.app.schemas.dashboard import AnalyticsResponse, TimeSeriesPoint, StatusDistribution


class AnalyticsService:
    @staticmethod
    async def get_monitor_availability(
        session: AsyncSession,
        monitor_id: Optional[int],
        since: datetime,
    ) -> Tuple[float, int, int, int]:
        """
        Calculates availability:
        Availability = (Successful checks / Total completed checks) * 100
        Returns (availability_pct, total_checks, successful_checks, failed_checks)
        """
        conditions = [CheckResult.checked_at >= since]
        if monitor_id is not None:
            conditions.append(CheckResult.monitor_id == monitor_id)

        # Count total
        total_query = select(func.count(CheckResult.id)).where(and_(*conditions))
        total_res = await session.execute(total_query)
        total_checks = total_res.scalar_one_or_none() or 0

        if total_checks == 0:
            return 100.0, 0, 0, 0

        # Successful checks are UP or DEGRADED
        success_query = select(func.count(CheckResult.id)).where(
            and_(*conditions, CheckResult.status.in_(["UP", "DEGRADED"]))
        )
        success_res = await session.execute(success_query)
        successful_checks = success_res.scalar_one_or_none() or 0
        failed_checks = total_checks - successful_checks

        availability = round((successful_checks / total_checks) * 100.0, 2)
        return availability, total_checks, successful_checks, failed_checks

    @staticmethod
    async def get_detailed_analytics(
        session: AsyncSession,
        monitor_id: Optional[int] = None,
        timeframe: str = "24h",
    ) -> AnalyticsResponse:
        now = datetime.now(timezone.utc)
        if timeframe == "7d":
            window = timedelta(days=7)
            bucket_delta = timedelta(hours=6)
        elif timeframe == "30d":
            window = timedelta(days=30)
            bucket_delta = timedelta(days=1)
        else:  # default 24h
            timeframe = "24h"
            window = timedelta(hours=24)
            bucket_delta = timedelta(hours=1)

        since = now - window

        # Calculate availability for windows
        avail_selected, total_checks, successful_checks, failed_checks = (
            await AnalyticsService.get_monitor_availability(session, monitor_id, since)
        )
        avail_24h, _, _, _ = await AnalyticsService.get_monitor_availability(
            session, monitor_id, now - timedelta(hours=24)
        )
        avail_7d, _, _, _ = await AnalyticsService.get_monitor_availability(
            session, monitor_id, now - timedelta(days=7)
        )
        avail_30d, _, _, _ = await AnalyticsService.get_monitor_availability(
            session, monitor_id, now - timedelta(days=30)
        )

        conditions = [CheckResult.checked_at >= since]
        if monitor_id is not None:
            conditions.append(CheckResult.monitor_id == monitor_id)

        # Response times and percentiles
        rt_query = (
            select(CheckResult.response_time_ms, CheckResult.status, CheckResult.http_status_code, CheckResult.checked_at)
            .where(and_(*conditions))
            .order_by(CheckResult.checked_at.asc())
        )
        rt_res = await session.execute(rt_query)
        rows = rt_res.all()

        latencies = [r[0] for r in rows if r[0] is not None]
        status_counts = {"UP": 0, "DEGRADED": 0, "DOWN": 0}
        status_codes: Dict[str, int] = {}

        for r in rows:
            st = r[1]
            if st in status_counts:
                status_counts[st] += 1
            code = r[2]
            code_str = str(code) if code else "ERR"
            status_codes[code_str] = status_codes.get(code_str, 0) + 1

        if latencies:
            latencies_sorted = sorted(latencies)
            avg_rt = round(sum(latencies) / len(latencies), 1)
            min_rt = round(latencies_sorted[0], 1)
            max_rt = round(latencies_sorted[-1], 1)
            p95_index = min(len(latencies_sorted) - 1, math.floor(0.95 * len(latencies_sorted)))
            p95_rt = round(latencies_sorted[p95_index], 1)
        else:
            avg_rt = 0.0
            min_rt = 0.0
            max_rt = 0.0
            p95_rt = 0.0

        # Build time-series buckets
        num_buckets = int(window.total_seconds() // bucket_delta.total_seconds())
        buckets = []
        for i in range(num_buckets):
            b_start = since + (i * bucket_delta)
            b_end = b_start + bucket_delta
            buckets.append({
                "start": b_start,
                "end": b_end,
                "latencies": [],
                "total": 0,
                "success": 0,
            })

        for r in rows:
            checked_at = r[3]
            # Normalize timezone
            if checked_at.tzinfo is None:
                checked_at = checked_at.replace(tzinfo=timezone.utc)
            for b in buckets:
                if b["start"] <= checked_at < b["end"]:
                    b["latencies"].append(r[0])
                    b["total"] += 1
                    if r[1] in ("UP", "DEGRADED"):
                        b["success"] += 1
                    break

        response_series: List[TimeSeriesPoint] = []
        availability_series: List[TimeSeriesPoint] = []

        for b in buckets:
            # Format timestamp for display
            label = b["start"].strftime("%H:%M" if timeframe == "24h" else "%b %d %H:%M")
            avg_val = round(sum(b["latencies"]) / len(b["latencies"]), 1) if b["latencies"] else 0.0
            avail_val = round((b["success"] / b["total"]) * 100.0, 1) if b["total"] > 0 else 100.0

            response_series.append(TimeSeriesPoint(timestamp=label, value=avg_val))
            availability_series.append(
                TimeSeriesPoint(
                    timestamp=label,
                    value=avail_val,
                    total_checks=b["total"],
                    successful_checks=b["success"],
                )
            )

        return AnalyticsResponse(
            timeframe=timeframe,
            availability=avail_selected,
            availability_24h=avail_24h,
            availability_7d=avail_7d,
            availability_30d=avail_30d,
            avg_response_time_ms=avg_rt,
            p95_response_time_ms=p95_rt,
            min_response_time_ms=min_rt,
            max_response_time_ms=max_rt,
            total_checks=total_checks,
            successful_checks=successful_checks,
            failed_checks=failed_checks,
            response_time_series=response_series,
            availability_series=availability_series,
            status_distribution=StatusDistribution(
                up=status_counts["UP"],
                degraded=status_counts["DEGRADED"],
                down=status_counts["DOWN"],
            ),
            status_code_distribution=status_codes,
        )
