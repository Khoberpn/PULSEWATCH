import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.database import Base


class CheckStatus(str, enum.Enum):
    UP = "UP"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


class CheckResult(Base):
    __tablename__ = "check_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    http_status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=False)
    error_message = Column(Text, nullable=True)
    checked_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    monitor = relationship("Monitor", back_populates="check_results")

    __table_args__ = (
        Index("ix_check_results_monitor_checked_at", "monitor_id", "checked_at"),
    )
