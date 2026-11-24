import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.app.database import get_db
from backend.app.services.scheduler import scheduler

router = APIRouter(tags=["Health"])


@router.get("/health", summary="System Health Check")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Returns platform health, database responsiveness, and background scheduler status.
    """
    db_status = "unhealthy"
    db_latency_ms = None
    start = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - start) * 1000, 2)
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    scheduler_status = "running" if scheduler.is_running else "stopped"
    overall_status = "healthy" if db_status == "healthy" else "degraded"

    return {
        "status": overall_status,
        "database": {
            "status": db_status,
            "latency_ms": db_latency_ms,
        },
        "scheduler": {
            "status": scheduler_status,
            "active_jobs": len(scheduler.scheduler.get_jobs()) if scheduler.is_running else 0,
        },
        "service": "PulseWatch Monitoring API",
        "version": "1.0.0",
    }
