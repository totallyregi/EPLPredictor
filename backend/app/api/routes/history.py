"""Historical data endpoint."""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from ...data.storage import load_processed_csv

router = APIRouter()


@router.get("/history")
def get_history(years: int = 5) -> dict[str, list[dict]]:
    history_df = load_processed_csv("historical_matches.csv")
    if history_df.empty:
        return {"history": []}

    history_df["date"] = pd.to_datetime(history_df["date"], errors="coerce")
    cutoff = pd.Timestamp.utcnow().tz_localize(None) - pd.Timedelta(days=365 * years)
    history_df = history_df[history_df["date"] >= cutoff].copy()
    history_df["date"] = history_df["date"].dt.strftime("%Y-%m-%d")
    return {"history": history_df.sort_values("date", ascending=False).to_dict(orient="records")}

