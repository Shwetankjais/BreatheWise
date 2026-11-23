"""Owned in-app alert rules/events and canonical observation uniqueness."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "uq_observation_canonical_hour",
        "observations",
        ["station_id", "pollutant", "measured_at"],
        unique=True,
    )
    op.create_table(
        "alert_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("station_id", sa.String(100), sa.ForeignKey("stations.id"), nullable=False),
        sa.Column("pollutant", sa.String(10), nullable=False),
        sa.Column("threshold", sa.Float, nullable=False),
        sa.Column("cooldown_minutes", sa.Integer, nullable=False),
        sa.Column("enabled", sa.Boolean, nullable=False),
        sa.Column("deleted", sa.Boolean, nullable=False),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_alert_rules_user_id", "alert_rules", ["user_id"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rule_id", sa.String(36), sa.ForeignKey("alert_rules.id"), nullable=False),
        sa.Column("observation_id", sa.Integer, sa.ForeignKey("observations.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("threshold", sa.Float, nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("rule_id", "observation_id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade():
    op.drop_table("notifications")
    op.drop_table("alert_rules")
    op.drop_index("uq_observation_canonical_hour", "observations")
