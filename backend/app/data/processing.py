"""Data normalization and feature generation for EPL matches."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

REQUIRED_COLUMNS = [
    "date",
    "season",
    "home_team",
    "away_team",
    "home_goals",
    "away_goals",
    "status",
]


@dataclass(frozen=True)
class ProcessedDataBundle:
    historical_df: pd.DataFrame
    training_df: pd.DataFrame


def normalize_matches(raw_matches: Iterable[dict]) -> pd.DataFrame:
    """Convert Football-Data.org match payloads into a flat DataFrame."""
    rows: list[dict] = []
    for match in raw_matches:
        utc_date = match.get("utcDate")
        season = (match.get("season") or {}).get("startDate", "")
        season_value = season.split("-")[0] if season else None
        full_time = (match.get("score") or {}).get("fullTime") or {}
        home = (match.get("homeTeam") or {}).get("name")
        away = (match.get("awayTeam") or {}).get("name")
        rows.append(
            {
                "match_id": match.get("id"),
                "date": utc_date[:10] if utc_date else None,
                "season": season_value,
                "home_team": home,
                "away_team": away,
                "home_goals": full_time.get("home"),
                "away_goals": full_time.get("away"),
                "status": match.get("status"),
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["home_goals"] = pd.to_numeric(df["home_goals"], errors="coerce")
    df["away_goals"] = pd.to_numeric(df["away_goals"], errors="coerce")
    return df.sort_values("date").reset_index(drop=True)


def validate_schema(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Processed data missing required columns: {missing}")


def _team_form_columns(df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    completed = df.copy()
    completed["home_points"] = (
        (completed["home_goals"] > completed["away_goals"]) * 3
        + (completed["home_goals"] == completed["away_goals"]) * 1
    )
    completed["away_points"] = (
        (completed["away_goals"] > completed["home_goals"]) * 3
        + (completed["away_goals"] == completed["home_goals"]) * 1
    )

    long_form = pd.concat(
        [
            completed[["date", "home_team", "home_goals", "away_goals", "home_points"]].rename(
                columns={
                    "home_team": "team",
                    "home_goals": "goals_for",
                    "away_goals": "goals_against",
                    "home_points": "points",
                }
            ),
            completed[["date", "away_team", "away_goals", "home_goals", "away_points"]].rename(
                columns={
                    "away_team": "team",
                    "away_goals": "goals_for",
                    "home_goals": "goals_against",
                    "away_points": "points",
                }
            ),
        ],
        ignore_index=True,
    ).sort_values(["team", "date"])

    long_form["recent_points"] = long_form.groupby("team")["points"].transform(
        lambda s: s.shift(1).rolling(window=window, min_periods=1).sum()
    )
    long_form["recent_goal_diff"] = long_form.groupby("team").apply(
        lambda g: (g["goals_for"] - g["goals_against"]).shift(1).rolling(window=window, min_periods=1).sum()
    ).reset_index(level=0, drop=True)

    home_recent = long_form[["date", "team", "recent_points", "recent_goal_diff"]].rename(
        columns={
            "team": "home_team",
            "recent_points": "home_recent_points_5",
            "recent_goal_diff": "home_recent_goal_diff_5",
        }
    )
    away_recent = long_form[["date", "team", "recent_points", "recent_goal_diff"]].rename(
        columns={
            "team": "away_team",
            "recent_points": "away_recent_points_5",
            "recent_goal_diff": "away_recent_goal_diff_5",
        }
    )
    df = df.merge(home_recent, on=["date", "home_team"], how="left")
    df = df.merge(away_recent, on=["date", "away_team"], how="left")
    return df


def _head_to_head(df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    data = df.copy()
    data["pair_key"] = data.apply(
        lambda r: "__".join(sorted([str(r["home_team"]), str(r["away_team"])])), axis=1
    )
    data["home_result_value"] = (
        (data["home_goals"] > data["away_goals"]).astype(int)
        - (data["home_goals"] < data["away_goals"]).astype(int)
    )
    data["h2h_home_edge_5"] = data.groupby("pair_key")["home_result_value"].transform(
        lambda s: s.shift(1).rolling(window=window, min_periods=1).sum()
    )
    return data.drop(columns=["pair_key", "home_result_value"])


def add_features(df: pd.DataFrame) -> ProcessedDataBundle:
    """Generate model-oriented and UI-oriented features."""
    validate_schema(df)
    working = df.copy()
    working["result"] = working.apply(
        lambda row: "H" if row["home_goals"] > row["away_goals"] else ("A" if row["away_goals"] > row["home_goals"] else "D"),
        axis=1,
    )
    working["goal_diff"] = working["home_goals"] - working["away_goals"]
    working["home_advantage"] = 1
    working = _team_form_columns(working, window=5)
    working = _head_to_head(working, window=5)

    historical_cols = [
        "date",
        "season",
        "home_team",
        "away_team",
        "home_goals",
        "away_goals",
        "status",
        "result",
        "goal_diff",
    ]
    training_cols = historical_cols + [
        "home_advantage",
        "home_recent_points_5",
        "away_recent_points_5",
        "home_recent_goal_diff_5",
        "away_recent_goal_diff_5",
        "h2h_home_edge_5",
    ]

    historical_df = working[historical_cols].copy()
    training_df = working[training_cols].copy()

    numeric_cols = [
        "home_advantage",
        "home_recent_points_5",
        "away_recent_points_5",
        "home_recent_goal_diff_5",
        "away_recent_goal_diff_5",
        "h2h_home_edge_5",
        "goal_diff",
    ]
    training_df[numeric_cols] = training_df[numeric_cols].fillna(0)

    return ProcessedDataBundle(historical_df=historical_df, training_df=training_df)

