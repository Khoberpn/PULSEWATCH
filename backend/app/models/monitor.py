import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Index
from sqlalchemy.orm import relationship
from backend.app.database import Base


class MonitorStatus(str, enum.Enum):
    PENDING = "PENDING"
    UP = "UP"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    method = Column(String(10), nullable=False, default="GET")
    check_interval = Column(Integer, nullable=False, default=60)  # in seconds
    timeout = Column(Integer, nullable=False, default=10)         # in seconds
    expected_status_codes = Column(String(50), nullable=False, default="200-399")
    degraded_threshold_ms = Column(Integer, nullable=False, default=1000)
    enabled = Column(Boolean, nullable=False, default=True)
    current_status = Column(String(20), nullable=False, default=MonitorStatus.PENDING.value)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    check_results = relationship(
        "CheckResult",
        back_populates="monitor",
        cascade="all, delete-orphan",
        order_by="desc(CheckResult.checked_at)",
    )
    incidents = relationship(
        "Incident",
        back_populates="monitor",
        cascade="all, delete-orphan",
        order_by="desc(Incident.started_at)",
    )
    activity_logs = relationship(
        "ActivityLog",
        back_populates="monitor",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_monitors_enabled_status", "enabled", "current_status"),
    )
