"""Auditable experimental baseline runs and exact-time observation matching."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "forecast_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("station_id", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column("data_mode", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("issue_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("input_cutoff", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("input_sha256", sa.String(64), nullable=True),
        sa.Column("provenance", sa.JSON, nullable=False),
        sa.UniqueConstraint("station_id", "model_version", "issue_at", "input_cutoff"),
    )
    for column in ["station_id", "model_version", "issue_at"]:
        op.create_index("ix_forecast_runs_" + column, "forecast_runs", [column])
    op.create_table(
        "shadow_predictions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("forecast_runs.id"), nullable=False),
        sa.Column("horizon_h", sa.Integer, nullable=False),
        sa.Column("target_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("concentration", sa.Float, nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("quality_flags", sa.JSON, nullable=False),
        sa.Column(
            "matched_observation_id", sa.Integer, sa.ForeignKey("observations.id"), nullable=True
        ),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("run_id", "horizon_h"),
    )
    for column in ["run_id", "target_at"]:
        op.create_index("ix_shadow_predictions_" + column, "shadow_predictions", [column])


def downgrade():
    op.drop_table("shadow_predictions")
    op.drop_table("forecast_runs")
