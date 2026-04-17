"""Fixtures endpoint."""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from ...data.storage import load_processed_csv

router = APIRouter()


@router.get("/fixtures/week")
def get_week_fixtures() -> dict[str, list[dict]]:
    historical = load_processed_csv("historical_matches.csv")
    if historical.empty:
        return {"fixtures": []}

    historical["date"] = pd.to_datetime(historical["date"], errors="coerce")
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    end = today + pd.Timedelta(days=7)

    fixtures = historical[(historical["date"] >= today) & (historical["date"] <= end)].copy()
    if fixtures.empty:
        return {"fixtures": []}

    columns = ["date", "home_team", "away_team", "status"]
    fixtures = fixtures[columns].rename(columns={"home_team": "home", "away_team": "away"})
    fixtures["date"] = fixtures["date"].dt.strftime("%Y-%m-%d")
    return {"fixtures": fixtures.to_dict(orient="records")}

