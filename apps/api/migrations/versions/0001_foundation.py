"""Station observations and opaque authenticated sessions; initial schema."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "stations",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("name", sa.String(250), nullable=False),
        sa.Column("city_id", sa.String(50), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("source", sa.String(500), nullable=False),
        sa.Column("data_mode", sa.String(30), nullable=False),
    )
    op.create_index("ix_stations_city_id", "stations", ["city_id"])
    op.create_table(
        "observations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("station_id", sa.String(100), sa.ForeignKey("stations.id"), nullable=False),
        sa.Column("pollutant", sa.String(10), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("original_value", sa.Float, nullable=False),
        sa.Column("original_unit", sa.String(20), nullable=False),
        sa.Column("source", sa.String(500), nullable=False),
        sa.Column("quality_flags", sa.JSON, nullable=False),
        sa.UniqueConstraint("station_id", "pollutant", "measured_at", "source"),
    )
    op.create_index("ix_observations_station_id", "observations", ["station_id"])
    op.create_index("ix_observations_measured_at", "observations", ["measured_at"])
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("preferences", sa.JSON, nullable=False),
    )
    op.create_table(
        "session_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "saved_places",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
    )
    op.create_index("ix_saved_places_user_id", "saved_places", ["user_id"])


def downgrade():
    for table in ["saved_places", "session_tokens", "users", "observations", "stations"]:
        op.drop_table(table)
