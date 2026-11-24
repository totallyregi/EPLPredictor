"""Prediction endpoints backed by the Dixon-Coles Poisson model."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...model import predict, store

router = APIRouter()


class PredictionRequest(BaseModel):
    home_team: str
    away_team: str
    date: str | None = None


def _ready() -> None:
    try:
        store.ensure()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Match data unavailable: {exc}") from exc
    if store.model is None:
        raise HTTPException(status_code=503, detail="Not enough completed matches to fit the model yet.")


@router.post("/predict")
def predict_match(request: PredictionRequest) -> dict[str, Any]:
    _ready()
    return {"home_team": request.home_team, "away_team": request.away_team, **predict(store.model, request.home_team, request.away_team)}


@router.get("/predictions")
def upcoming_predictions(matchdays: int = Query(default=4, ge=1, le=38)) -> dict[str, Any]:
    """Predictions for the next `matchdays` rounds, plus team form and model metadata."""
    _ready()
    upcoming = store.upcoming()
    if not upcoming.empty and upcoming["matchday"].notna().any():
        first = int(upcoming["matchday"].dropna().min())
        upcoming = upcoming[upcoming["matchday"].fillna(first) < first + matchdays]

    form_cache: dict[str, list[dict]] = {}

    def form(team: str) -> list[dict]:
        if team not in form_cache:
            form_cache[team] = store.form(team)
        return form_cache[team]

    fixtures = []
    for r in upcoming.itertuples():
        fixtures.append(
            {
                "match_id": r.match_id,
                "matchday": None if r.matchday != r.matchday else int(r.matchday),
                "kickoff": r.kickoff.isoformat(),
                "date": r.kickoff.strftime("%Y-%m-%d"),
                "home": r.home_team,
                "away": r.away_team,
                "home_short": r.home_short,
                "away_short": r.away_short,
                "home_crest": r.home_crest,
                "away_crest": r.away_crest,
                "status": r.status,
                "home_form": form(r.home_team),
                "away_form": form(r.away_team),
                **predict(store.model, r.home_team, r.away_team),
            }
        )
    return {"model": store.model_info(), "predictions": fixtures}


@router.get("/model")
def model_info() -> dict[str, Any]:
    _ready()
    return store.model_info()


@router.get("/dashboard")
def dashboard() -> dict[str, Any]:
    """Everything the site needs in one round trip (the free-tier server may be cold)."""
    _ready()
    upcoming = upcoming_predictions(matchdays=38)["predictions"]
    form: dict[str, list[dict]] = {}
    for p in upcoming:
        form.setdefault(p["home"], p.pop("home_form", []))
        form.setdefault(p["away"], p.pop("away_form", []))
        p.pop("home_form", None)
        p.pop("away_form", None)
    played = store.played(store.df).sort_values("kickoff", ascending=False).head(12)
    results = [
        {
            "date": r.kickoff.strftime("%Y-%m-%d"),
            "matchday": None if r.matchday != r.matchday else int(r.matchday),
            "home": r.home_team, "away": r.away_team,
            "home_short": r.home_short, "away_short": r.away_short,
            "home_crest": r.home_crest, "away_crest": r.away_crest,
            "score": f"{int(r.home_goals)}-{int(r.away_goals)}",
        }
        for r in played.itertuples()
    ]
    table = store.projection or []
    teams = [{"team": t["team"], "short": t["short"], "crest": t["crest"]} for t in sorted(table, key=lambda x: x["short"])]
    return {
        "model": store.model_info(),
        "predictions": upcoming,
        "table": table,
        "teams": teams,
        "results": results,
        "form": form,
        "track_record": (store.backtest or {}).get("recent", []),
    }
