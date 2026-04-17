"""Fixtures endpoint."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from ...data.football_data_client import FootballDataClient

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
    fixtures: list[dict] = []
    for match in matches:
        status = match.get("status")
        if status not in {"TIMED", "SCHEDULED"}:
            continue

        utc_date = match.get("utcDate")
        home_team = match.get("homeTeam") or {}
        away_team = match.get("awayTeam") or {}
        if not utc_date or not home_team.get("name") or not away_team.get("name"):
            continue

        fixtures.append(
            {
                "date": utc_date[:10],
                "home": home_team.get("name"),
                "away": away_team.get("name"),
                "home_crest": home_team.get("crest"),
                "away_crest": away_team.get("crest"),
                "status": status,
            }
        )

    fixtures.sort(key=lambda row: row["date"])
    return fixtures


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

