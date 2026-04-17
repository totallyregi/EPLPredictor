"""Fixtures endpoint."""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter

from ...data.football_data_client import FootballDataClient
from ...data.processing import normalize_matches
from ...data.storage import load_processed_csv

router = APIRouter()


def _fixtures_from_live_api() -> list[dict]:
    """Fallback to live API when processed CSV has no upcoming fixtures."""
    try:
        client = FootballDataClient()
    except ValueError:
        return []

    today = date.today()
    matches = client.fetch_matches(today, today + timedelta(days=7), competition="PL")
    normalized = normalize_matches(matches)
    if normalized.empty:
        return []

    fixtures = normalized[
        normalized["status"].isin(["TIMED", "SCHEDULED"])
    ][["date", "home_team", "away_team", "status"]].copy()
    if fixtures.empty:
        return []

    fixtures = fixtures.rename(columns={"home_team": "home", "away_team": "away"})
    fixtures["date"] = fixtures["date"].dt.strftime("%Y-%m-%d")
    return fixtures.to_dict(orient="records")


@router.get("/fixtures/week")
def get_week_fixtures() -> dict[str, list[dict]]:
    historical = load_processed_csv("historical_matches.csv")
    if historical.empty:
        return {"fixtures": _fixtures_from_live_api()}

    historical["date"] = pd.to_datetime(historical["date"], errors="coerce")
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    end = today + pd.Timedelta(days=7)

    fixtures = historical[(historical["date"] >= today) & (historical["date"] <= end)].copy()
    if fixtures.empty:
        return {"fixtures": _fixtures_from_live_api()}

    columns = ["date", "home_team", "away_team", "status"]
    fixtures = fixtures[columns].rename(columns={"home_team": "home", "away_team": "away"})
    fixtures["date"] = fixtures["date"].dt.strftime("%Y-%m-%d")
    return {"fixtures": fixtures.to_dict(orient="records")}

