from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String(100), nullable=False, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="SET NULL"), nullable=True, index=True)
    description = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    monitor = relationship("Monitor", back_populates="activity_logs")

    __table_args__ = (
        Index("ix_activity_logs_event_created", "event_type", "created_at"),
    )
