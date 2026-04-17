"""Configuration for the FastAPI backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "EPL Predictor API"
    app_version: str = "0.1.0"
    football_data_base_url: str = os.getenv("FOOTBALL_DATA_BASE_URL", "https://api.football-data.org/v4")
    football_data_api_key: str | None = os.getenv("FOOTBALL_DATA_API_KEY")
    seasons_to_fetch: int = int(os.getenv("EPL_SEASONS_TO_FETCH", "5"))
    project_root: Path = Path(__file__).resolve().parents[2]
    data_dir: Path = project_root / "data"
    raw_data_dir: Path = data_dir / "raw"
    processed_data_dir: Path = data_dir / "processed"
    models_dir: Path = project_root / "models"


settings = Settings()


def ensure_data_directories() -> None:
    """Create standard storage directories if they do not exist."""
    for path in (
        settings.data_dir,
        settings.raw_data_dir,
        settings.processed_data_dir,
        settings.models_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)

