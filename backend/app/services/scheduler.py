import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from backend.app.database import AsyncSessionLocal
from backend.app.models.monitor import Monitor
from backend.app.services.monitor_engine import monitoring_engine

logger = logging.getLogger(__name__)


class MonitoringScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False

    def start(self):
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("PulseWatch Monitoring Scheduler started.")

    def shutdown(self):
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("PulseWatch Monitoring Scheduler stopped.")

    def schedule_monitor(self, monitor_id: int, interval_seconds: int):
        job_id = f"monitor_{monitor_id}"
        # If job already exists, remove it first
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

        self.scheduler.add_job(
            func=monitoring_engine.run_check,
            trigger=IntervalTrigger(seconds=max(5, interval_seconds)),
            args=[monitor_id, False],
            id=job_id,
            name=f"HealthCheck_Monitor_{monitor_id}",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        logger.info("Scheduled monitor #%d every %ds.", monitor_id, interval_seconds)

    def remove_monitor(self, monitor_id: int):
        job_id = f"monitor_{monitor_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info("Removed monitor #%d from scheduler.", monitor_id)

    async def load_all_active_monitors(self):
        """Loads all active monitors from database and schedules them."""
        try:
            async with AsyncSessionLocal() as session:
                query = select(Monitor).where(Monitor.enabled == True)
                result = await session.execute(query)
                monitors = result.scalars().all()
                for mon in monitors:
                    self.schedule_monitor(mon.id, mon.check_interval)
                logger.info("Loaded %d active monitors into scheduler.", len(monitors))
        except Exception as e:
            logger.error("Failed to load active monitors on startup: %s", e)


scheduler = MonitoringScheduler()
