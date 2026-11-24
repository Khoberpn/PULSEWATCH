from fastapi import APIRouter
from backend.app.api.endpoints import health, monitors, incidents, activity, dashboard, events

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(monitors.router)
api_router.include_router(incidents.router)
api_router.include_router(activity.router)
api_router.include_router(dashboard.router)
api_router.include_router(events.router)
