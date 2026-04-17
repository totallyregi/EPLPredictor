"""Prediction endpoint."""

from __future__ import annotations

import math
from typing import Any

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


def _weighted_mean(series: pd.Series, weights: pd.Series) -> float:
    valid = ~(series.isna() | weights.isna())
    if not valid.any():
        return 0.0
    values = series[valid].astype(float)
    valid_weights = weights[valid].astype(float).clip(lower=0.0)
    total_weight = valid_weights.sum()
    if total_weight <= 0:
        return 0.0
    return float((values * valid_weights).sum() / total_weight)


def _infer_season_start_year(match_date: pd.Timestamp) -> int:
    return match_date.year if match_date.month >= 8 else match_date.year - 1


def _season_decay_weight(season_diff: int) -> float:
    """
    Season weighting rule:
    - current season: 1.0x
    - previous seasons (max 4): decay from 0.5 -> 0.1
    """
    if season_diff <= 0:
        return 1.0
    decay_lookup = {
        1: 0.5,
        2: 0.37,
        3: 0.23,
        4: 0.1,
    }
    return decay_lookup.get(season_diff, 0.1)


def _prepare_team_matches(training_df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    played = training_df.dropna(subset=["home_goals", "away_goals"]).copy()
    if played.empty:
        return played, 0

    played["date"] = pd.to_datetime(played["date"], errors="coerce")
    played = played.dropna(subset=["date"]).sort_values("date")
    if played.empty:
        return played, 0

    if "season" not in played.columns:
        played["season"] = played["date"].apply(_infer_season_start_year)
    played["season"] = pd.to_numeric(played["season"], errors="coerce").fillna(played["date"].apply(_infer_season_start_year))

    current_season = int(played["season"].max())

    home_view = pd.DataFrame(
        {
            "date": played["date"],
            "season": played["season"],
            "team": played["home_team"],
            "goals_for": played["home_goals"],
            "goals_against": played["away_goals"],
            "is_home": 1,
        }
    )
    away_view = pd.DataFrame(
        {
            "date": played["date"],
            "season": played["season"],
            "team": played["away_team"],
            "goals_for": played["away_goals"],
            "goals_against": played["home_goals"],
            "is_home": 0,
        }
    )
    team_matches = pd.concat([home_view, away_view], ignore_index=True).sort_values("date")
    team_matches["season_diff"] = current_season - team_matches["season"].astype(int)
    team_matches["season_weight"] = team_matches["season_diff"].apply(_season_decay_weight)
    team_matches["recency_weight"] = 1.0

    for team, group in team_matches.groupby("team"):
        recent_idx = group.sort_values("date", ascending=False).head(5).index
        team_matches.loc[recent_idx, "recency_weight"] = 2.0

    team_matches["sample_weight"] = team_matches["season_weight"] * team_matches["recency_weight"]
    return team_matches, current_season


def _team_strengths(team_matches: pd.DataFrame) -> tuple[dict[str, float], dict[str, float], float]:
    league_attack_avg = _weighted_mean(team_matches["goals_for"], team_matches["sample_weight"])
    league_defense_avg = _weighted_mean(team_matches["goals_against"], team_matches["sample_weight"])
    if league_attack_avg <= 0:
        league_attack_avg = 1.35
    if league_defense_avg <= 0:
        league_defense_avg = 1.35

    attack_strength: dict[str, float] = {}
    defense_weakness: dict[str, float] = {}
    for team, group in team_matches.groupby("team"):
        team_attack = _weighted_mean(group["goals_for"], group["sample_weight"])
        team_defense = _weighted_mean(group["goals_against"], group["sample_weight"])
        attack_strength[team] = max(0.3, team_attack / league_attack_avg) if team_attack > 0 else 1.0
        defense_weakness[team] = max(0.3, team_defense / league_defense_avg) if team_defense > 0 else 1.0
    return attack_strength, defense_weakness, league_attack_avg


def _estimate_expected_goals(training_df: pd.DataFrame, home_team: str, away_team: str) -> tuple[float, float]:
    team_matches, _ = _prepare_team_matches(training_df)
    if team_matches.empty:
        return 1.4, 1.1

    attack_strength, defense_weakness, league_goal_rate = _team_strengths(team_matches)
    home_attack = attack_strength.get(home_team, 1.0)
    away_attack = attack_strength.get(away_team, 1.0)
    home_defense = defense_weakness.get(home_team, 1.0)
    away_defense = defense_weakness.get(away_team, 1.0)

    # Weighted Poisson lambdas with 10% home advantage boost.
    expected_home = max(0.2, league_goal_rate * home_attack * away_defense * 1.10)
    expected_away = max(0.2, league_goal_rate * away_attack * home_defense)
    return expected_home, expected_away


@router.post("/predict")
def predict_match(request: PredictionRequest) -> dict[str, Any]:
    training_df = load_processed_csv("training_matches.csv")
    if training_df.empty:
        raise HTTPException(status_code=503, detail="Training data not available. Run data pipeline first.")

    prediction_source = "weighted_poisson"
    try:
        exp_home, exp_away = _estimate_expected_goals(training_df, request.home_team, request.away_team)
    except Exception:  # noqa: BLE001
        # Degrade gracefully instead of returning 500 so frontend can still show predictions.
        exp_home, exp_away = 1.45, 1.15
        prediction_source = "weighted_poisson_degraded"
    max_goals = 5

    home_win = 0.0
    draw = 0.0
    away_win = 0.0
    best_score = (0, 0)
    best_prob = 0.0
    score_matrix: list[list[float]] = []

    for h in range(0, max_goals + 1):
        row: list[float] = []
        p_h = _poisson(h, exp_home)
        for a in range(0, max_goals + 1):
            prob = p_h * _poisson(a, exp_away)
            row.append(round(prob, 6))
            if h > a:
                home_win += prob
            elif h == a:
                draw += prob
            else:
                away_win += prob
            if prob > best_prob:
                best_prob = prob
                best_score = (h, a)
        score_matrix.append(row)

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
        "prediction_source": prediction_source,
        "match_odds": {
            "home_win": round(home_win, 4),
            "draw": round(draw, 4),
            "away_win": round(away_win, 4),
        },
        "score_probability_matrix": score_matrix,
    }

