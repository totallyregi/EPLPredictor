"""Helpers for loading and saving project data artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from ..config import ensure_data_directories, settings


def processed_file_path(file_name: str) -> Path:
    ensure_data_directories()
    return settings.processed_data_dir / file_name


def raw_file_path(file_name: str) -> Path:
    ensure_data_directories()
    return settings.raw_data_dir / file_name


def load_processed_csv(file_name: str) -> pd.DataFrame:
    path = processed_file_path(file_name)
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def save_processed_csv(df: pd.DataFrame, file_name: str) -> Path:
    path = processed_file_path(file_name)
    df.to_csv(path, index=False)
    return path


def save_raw_json(payload: Any, file_name: str) -> Path:
    path = raw_file_path(file_name)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return path

