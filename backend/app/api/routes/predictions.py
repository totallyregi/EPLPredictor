"""Prediction endpoint."""

from __future__ import annotations

import math

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...data.storage import load_processed_csv

router = APIRouter()


class PredictionRequest(BaseModel):
    home_team: str
    away_team: str
    date: str | None = None


def _poisson(k: int, expected: float) -> float:
    return (expected**k) * math.exp(-expected) / math.factorial(k)


def _estimate_expected_goals(training_df: pd.DataFrame, home_team: str, away_team: str) -> tuple[float, float]:
    played = training_df.dropna(subset=["home_goals", "away_goals"]).copy()
    if played.empty:
        return 1.4, 1.1

    league_home_avg = played["home_goals"].mean()
    league_away_avg = played["away_goals"].mean()

    home_home = played[played["home_team"] == home_team]
    away_away = played[played["away_team"] == away_team]

    home_attack = (home_home["home_goals"].mean() / league_home_avg) if not home_home.empty else 1.0
    away_defense = (away_away["home_goals"].mean() / league_home_avg) if not away_away.empty else 1.0
    away_attack = (away_away["away_goals"].mean() / league_away_avg) if not away_away.empty else 1.0
    home_defense = (home_home["away_goals"].mean() / league_away_avg) if not home_home.empty else 1.0

    expected_home = max(0.2, league_home_avg * home_attack * away_defense)
    expected_away = max(0.2, league_away_avg * away_attack * home_defense)
    return expected_home, expected_away


@router.post("/predict")
def predict_match(request: PredictionRequest) -> dict[str, float | str]:
    training_df = load_processed_csv("training_matches.csv")
    if training_df.empty:
        raise HTTPException(status_code=503, detail="Training data not available. Run data pipeline first.")

    exp_home, exp_away = _estimate_expected_goals(training_df, request.home_team, request.away_team)
    max_goals = 6

    home_win = 0.0
    draw = 0.0
    away_win = 0.0
    best_score = (0, 0)
    best_prob = 0.0

    for h in range(max_goals + 1):
        p_h = _poisson(h, exp_home)
        for a in range(max_goals + 1):
            prob = p_h * _poisson(a, exp_away)
            if h > a:
                home_win += prob
            elif h == a:
                draw += prob
            else:
                away_win += prob
            if prob > best_prob:
                best_prob = prob
                best_score = (h, a)

    total = home_win + draw + away_win
    home_win /= total
    draw /= total
    away_win /= total

    predicted = "Home Win" if home_win >= draw and home_win >= away_win else ("Away Win" if away_win >= draw else "Draw")
    return {
        "home_team": request.home_team,
        "away_team": request.away_team,
        "home_win_prob": round(home_win, 4),
        "draw_prob": round(draw, 4),
        "away_win_prob": round(away_win, 4),
        "expected_home_goals": round(exp_home, 2),
        "expected_away_goals": round(exp_away, 2),
        "predicted_score": f"{best_score[0]}-{best_score[1]}",
        "predicted": predicted,
    }

