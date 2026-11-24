"""Recent results endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ...model import store

router = APIRouter()


@router.get("/history")
def get_history(years: int = 5, limit: int = Query(default=20, ge=1, le=2000)) -> dict[str, list[dict]]:
    try:
        store.ensure()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Match data unavailable: {exc}") from exc
    played = store.played(store.df).sort_values("kickoff", ascending=False).head(limit)
    return {
        "history": [
            {
                "date": r.kickoff.strftime("%Y-%m-%d"),
                "season": f"{int(r.season)}/{str(int(r.season) + 1)[-2:]}" if r.season == r.season else "",
                "matchday": None if r.matchday != r.matchday else int(r.matchday),
                "home_team": r.home_team,
                "away_team": r.away_team,
                "home_crest": r.home_crest,
                "away_crest": r.away_crest,
                "home_goals": int(r.home_goals),
                "away_goals": int(r.away_goals),
                "result": "H" if r.home_goals > r.away_goals else ("A" if r.away_goals > r.home_goals else "D"),
            }
            for r in played.itertuples()
        ]
    }
