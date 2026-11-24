from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Station(Base):
    __tablename__ = "stations"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(250))
    city_id: Mapped[str] = mapped_column(String(50), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(500))
    data_mode: Mapped[str] = mapped_column(String(30))


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        UniqueConstraint("station_id", "pollutant", "measured_at", "source"),
        Index(
            "uq_observation_canonical_hour", "station_id", "pollutant", "measured_at", unique=True
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"), index=True)
    pollutant: Mapped[str] = mapped_column(String(10))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))
    original_value: Mapped[float] = mapped_column(Float)
    original_unit: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(500))
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)


class SessionToken(Base):
    __tablename__ = "session_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SavedPlace(Base):
    __tablename__ = "saved_places"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)


class AlertRule(Base):
    __tablename__ = "alert_rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    pollutant: Mapped[str] = mapped_column(String(10))
    threshold: Mapped[float] = mapped_column(Float)
    cooldown_minutes: Mapped[int] = mapped_column(default=60)
    enabled: Mapped[bool] = mapped_column(default=True)
    deleted: Mapped[bool] = mapped_column(default=False)
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("rule_id", "observation_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("alert_rules.id"))
    observation_id: Mapped[int] = mapped_column(ForeignKey("observations.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    value: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="delivered_in_app")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    provider: Mapped[str] = mapped_column(String(30))
    data_mode: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class ForecastRun(Base):
    __tablename__ = "forecast_runs"
    __table_args__ = (UniqueConstraint("station_id", "model_version", "issue_at", "input_cutoff"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    station_id: Mapped[str] = mapped_column(String(100), index=True)
    model_version: Mapped[str] = mapped_column(String(100), index=True)
    data_mode: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issue_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    input_cutoff: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    input_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)


class ShadowPrediction(Base):
    __tablename__ = "shadow_predictions"
    __table_args__ = (UniqueConstraint("run_id", "horizon_h"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    horizon_h: Mapped[int] = mapped_column()
    target_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    concentration: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    matched_observation_id: Mapped[int | None] = mapped_column(
        ForeignKey("observations.id"), nullable=True
    )
    matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
