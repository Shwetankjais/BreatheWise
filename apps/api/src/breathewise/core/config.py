from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = next(
    (p for p in Path(__file__).resolve().parents if (p / "pyproject.toml").exists()),
    Path.cwd(),
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://breathewise:breathewise@127.0.0.1:5432/breathewise"
    openaq_api_key: SecretStr = SecretStr("")
    data_mode: Literal["live", "historical_replay", "demo"] = "live"
    web_origin: str = "http://localhost:5173"
    data_root: Path = ROOT / "data"
    archive_root: Path = ROOT / "data/archive"
    forecast_registry_root: Path = ROOT / "work/forecast-experiment"
    routing_base_url: str = ""
    model_artifact_path: Path = ROOT / "artifacts/models/zero_input_aq_weather_model.joblib"

    @property
    def cors_origins(self) -> list[str]:
        if not self.web_origin or self.web_origin.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
