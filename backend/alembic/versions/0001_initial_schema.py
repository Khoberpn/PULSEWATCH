"""0001_initial_schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-24 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. monitors table
    op.create_table(
        'monitors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False, server_default='GET'),
        sa.Column('check_interval', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('timeout', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('expected_status_codes', sa.String(length=50), nullable=False, server_default='200-399'),
        sa.Column('degraded_threshold_ms', sa.Integer(), nullable=False, server_default='1000'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('current_status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_monitors_id', 'monitors', ['id'], unique=False)
    op.create_index('ix_monitors_enabled_status', 'monitors', ['enabled', 'current_status'], unique=False)

    # 2. check_results table
    op.create_table(
        'check_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('monitor_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('http_status_code', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Float(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['monitor_id'], ['monitors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_check_results_id', 'check_results', ['id'], unique=False)
    op.create_index('ix_check_results_monitor_id', 'check_results', ['monitor_id'], unique=False)
    op.create_index('ix_check_results_checked_at', 'check_results', ['checked_at'], unique=False)
    op.create_index('ix_check_results_monitor_checked_at', 'check_results', ['monitor_id', 'checked_at'], unique=False)

    # 3. incidents table
    op.create_table(
        'incidents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('monitor_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='INVESTIGATING'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('downtime_seconds', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['monitor_id'], ['monitors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_incidents_id', 'incidents', ['id'], unique=False)
    op.create_index('ix_incidents_monitor_id', 'incidents', ['monitor_id'], unique=False)
    op.create_index('ix_incidents_status', 'incidents', ['status'], unique=False)
    op.create_index('ix_incidents_started_at', 'incidents', ['started_at'], unique=False)
    op.create_index('ix_incidents_monitor_status', 'incidents', ['monitor_id', 'status'], unique=False)

    # 4. activity_logs table
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('monitor_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['monitor_id'], ['monitors.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_activity_logs_id', 'activity_logs', ['id'], unique=False)
    op.create_index('ix_activity_logs_event_type', 'activity_logs', ['event_type'], unique=False)
    op.create_index('ix_activity_logs_monitor_id', 'activity_logs', ['monitor_id'], unique=False)
    op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'], unique=False)
    op.create_index('ix_activity_logs_event_created', 'activity_logs', ['event_type', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('activity_logs')
    op.drop_table('incidents')
    op.drop_table('check_results')
    op.drop_table('monitors')
