"""Fixture endpoints (served from the cached season data)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...model import store

router = APIRouter()


def _fixtures() -> list[dict]:
    try:
        store.ensure()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Match data unavailable: {exc}") from exc
    return [
        {
            "date": r.kickoff.strftime("%Y-%m-%d"),
            "kickoff": r.kickoff.isoformat(),
            "matchday": None if r.matchday != r.matchday else int(r.matchday),
            "home": r.home_team,
            "away": r.away_team,
            "home_crest": r.home_crest,
            "away_crest": r.away_crest,
            "status": r.status,
        }
        for r in store.upcoming().itertuples()
    ]


@router.get("/fixtures/week")
def get_week_fixtures() -> dict[str, list[dict]]:
    """Backward-compatible name: fixtures from today to the end of the season."""
    return {"fixtures": _fixtures()}


@router.get("/fixtures/season")
def get_season_fixtures() -> dict[str, list[dict]]:
    return {"fixtures": _fixtures()}
