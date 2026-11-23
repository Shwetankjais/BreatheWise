from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = next(
    (
        p
        for p in Path(__file__).resolve().parents
        if (p / "pyproject.toml").exists() and (p / "docs/MODEL_STATIC_AUDIT.json").exists()
    ),
    Path.cwd(),
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://breathewise:breathewise@127.0.0.1:5432/breathewise"
    data_mode: Literal["live", "historical_replay", "demo"] = "live"
    web_origin: str = "http://localhost:5173"
    data_root: Path = ROOT / "data"
    model_artifact_path: Path = ROOT / "artifacts/models/zero_input_aq_weather_model.joblib"


@lru_cache
def get_settings() -> Settings:
    return Settings()
