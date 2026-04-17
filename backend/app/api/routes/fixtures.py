"""Fixtures endpoint."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from ...data.football_data_client import FootballDataClient
from ...data.processing import normalize_matches

router = APIRouter()


def _season_window_today_to_end() -> tuple[date, date]:
    """
    Return the date window from today to the end of the current EPL season.
    EPL seasons typically end around May; we use June 30 as a safe boundary.
    """
    today = date.today()
    season_end_year = today.year + 1 if today.month >= 8 else today.year
    season_end = date(season_end_year, 6, 30)
    return today, season_end


def _fixtures_from_live_api() -> list[dict]:
    """Fetch fixtures from live Football-Data API for current season remainder."""
    try:
        client = FootballDataClient()
    except ValueError:
        return []

    start_date, end_date = _season_window_today_to_end()
    matches = client.fetch_matches(start_date, end_date, competition="PL")
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
    """
    Backward-compatible route name.
    Returns fixtures from today through the end of the current season.
    """
    return {"fixtures": _fixtures_from_live_api()}


@router.get("/fixtures/season")
def get_season_fixtures() -> dict[str, list[dict]]:
    """Alias endpoint for explicit season fixtures access."""
    return get_week_fixtures()

