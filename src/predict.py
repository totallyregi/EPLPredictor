"""
Prediction interface for Premier League matches.
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional, List
from . import features


class MissingDict(dict):
    """Dictionary that returns the key if missing."""
    def __missing__(self, key):
        return key


# Team name mapping for normalization
TEAM_NAME_MAPPING = {
    "Brighton and Hove Albion": "Brighton",
    "Manchester United": "Manchester Utd",
    "Newcastle United": "Newcastle Utd",
    "Tottenham Hotspur": "Tottenham",
    "West Ham United": "West Ham",
    "Wolverhampton Wanderers": "Wolves",
    "Sheffield United": "Sheffield Utd",
    "Leicester City": "Leicester",
    "Norwich City": "Norwich",
    "West Bromwich Albion": "West Brom",
    "Crystal Palace": "Crystal Palace",
    "Aston Villa": "Aston Villa",
    "Burnley": "Burnley",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Leeds United": "Leeds",
    "Liverpool": "Liverpool",
    "Manchester City": "Manchester City",
    "Arsenal": "Arsenal",
    "Chelsea": "Chelsea",
    "Southampton": "Southampton",
    "Watford": "Watford",
    "Brentford": "Brentford",
    "Brighton": "Brighton",
    "Manchester Utd": "Manchester Utd",
    "Newcastle Utd": "Newcastle Utd",
    "Tottenham": "Tottenham",
    "West Ham": "West Ham",
    "Wolves": "Wolves",
}

TEAM_MAPPING = MissingDict(**TEAM_NAME_MAPPING)


def normalize_team_name(team: str) -> str:
    """
    Normalize team name using mapping.
    
    Args:
        team: Team name
    
    Returns:
        Normalized team name
    """
    return TEAM_MAPPING[team]


def get_team_form(team: str, 
                  matches_df: pd.DataFrame, 
                  n_matches: int = 5) -> Dict:
    """
    Get recent form statistics for a team.
    
    Args:
        team: Team name
        matches_df: DataFrame with match data
        n_matches: Number of recent matches to consider
    
    Returns:
        Dictionary with form statistics
    """
    # Normalize team name
    team = normalize_team_name(team)
    
    # Filter matches for this team
    team_matches = matches_df[matches_df['team'] == team].copy()
    
    if len(team_matches) == 0:
        return {
            'wins': 0,
            'draws': 0,
            'losses': 0,
            'goals_for': 0,
            'goals_against': 0,
            'points': 0
        }
    
    # Sort by date and get last n matches
    if not pd.api.types.is_datetime64_any_dtype(team_matches['date']):
        team_matches['date'] = pd.to_datetime(team_matches['date'], errors='coerce')
    
    team_matches = team_matches.sort_values('date', ascending=False).head(n_matches)
    
    # Count results
    wins = (team_matches['result'] == 'W').sum()
    draws = (team_matches['result'] == 'D').sum()
    losses = (team_matches['result'] == 'L').sum()
    
    # Goals
    goals_for = team_matches['gf'].sum() if 'gf' in team_matches.columns else 0
    goals_against = team_matches['ga'].sum() if 'ga' in team_matches.columns else 0
    
    # Points (3 for win, 1 for draw)
    points = wins * 3 + draws
    
    return {
        'wins': int(wins),
        'draws': int(draws),
        'losses': int(losses),
        'goals_for': float(goals_for),
        'goals_against': float(goals_against),
        'points': int(points),
        'form': f"{wins}W-{draws}D-{losses}L"
    }


def predict_match(model: object,
                 home_team: str,
                 away_team: str,
                 matches_df: pd.DataFrame,
                 date: Optional[str] = None,
                 predictors: Optional[List[str]] = None) -> Dict:
    """
    Predict outcome of a single match.
    
    Args:
        model: Trained model
        home_team: Home team name
        away_team: Away team name
        matches_df: Historical match data for feature engineering
        date: Optional match date (for temporal features)
        predictors: List of predictor column names
    
    Returns:
        Dictionary with prediction probabilities and outcome
    """
    # Normalize team names
    home_team = normalize_team_name(home_team)
    away_team = normalize_team_name(away_team)
    
    # Get the most recent match data for both teams to compute rolling features
    if not pd.api.types.is_datetime64_any_dtype(matches_df['date']):
        matches_df['date'] = pd.to_datetime(matches_df['date'], errors='coerce')
    
    # Filter to most recent matches before the prediction date
    if date:
        pred_date = pd.to_datetime(date)
        matches_df = matches_df[matches_df['date'] < pred_date].copy()
    
    # Prepare features for this match
    # We need to create a temporary row with the match data
    match_row = pd.DataFrame([{
        'date': pd.to_datetime(date) if date else pd.Timestamp.now(),
        'team': home_team,
        'opponent': away_team,
        'venue': 'Home',
        'result': 'W',  # Dummy value, won't be used
        'gf': 0,
        'ga': 0,
    }])
    
    # Add required columns if missing
    for col in ['sh', 'sot', 'dist', 'fk', 'pk', 'pkatt']:
        if col not in match_row.columns:
            match_row[col] = 0
    
    # Combine with historical data to compute rolling features
    temp_df = pd.concat([matches_df, match_row], ignore_index=True)
    
    # Engineer features
    temp_df = features.encode_categorical(temp_df)
    temp_df = features.extract_temporal_features(temp_df)
    temp_df = features.compute_rolling_averages(temp_df, window=3)
    
    # Get the last row (our match)
    match_features = temp_df.iloc[[-1]]
    
    # Get default predictors if not provided
    if predictors is None:
        base_predictors = ['venue_code', 'opp_code', 'hour', 'day_code']
        rolling_predictors = ['gf_rolling', 'ga_rolling', 'sh_rolling', 'sot_rolling',
                            'dist_rolling', 'fk_rolling', 'pk_rolling', 'pkatt_rolling']
        predictors = [p for p in base_predictors + rolling_predictors if p in match_features.columns]
    
    # Extract feature vector
    X = match_features[predictors]
    
    # Check for NaN values and fill with 0 or mean
    if X.isna().any().any():
        # Fill NaN with 0 for rolling features (no history)
        X = X.fillna(0)
    
    # Predict
    if hasattr(model, 'predict_proba'):
        proba = model.predict_proba(X)[0]
        # For binary classification, we only have [P(loss/draw), P(win)]
        # We need to estimate draw probability separately
        # For now, assume win probability and split remaining between draw and loss
        win_prob = proba[1] if len(proba) == 2 else proba[0]
        # Simple heuristic: draw is 25% of non-win probability
        draw_prob = (1 - win_prob) * 0.25
        away_win_prob = (1 - win_prob) * 0.15  # Away wins less common
        home_win_prob = win_prob - away_win_prob  # Adjust home win
        
        # Normalize to sum to 1
        total = home_win_prob + draw_prob + away_win_prob
        home_win_prob /= total
        draw_prob /= total
        away_win_prob /= total
    else:
        pred = model.predict(X)[0]
        # If no probabilities, use simple estimates
        if pred == 1:
            home_win_prob = 0.6
            draw_prob = 0.25
            away_win_prob = 0.15
        else:
            home_win_prob = 0.3
            draw_prob = 0.3
            away_win_prob = 0.4
    
    # Determine predicted outcome
    if home_win_prob > draw_prob and home_win_prob > away_win_prob:
        predicted = "Home Win"
    elif away_win_prob > draw_prob:
        predicted = "Away Win"
    else:
        predicted = "Draw"
    
    return {
        'home_team': home_team,
        'away_team': away_team,
        'home_win_prob': float(home_win_prob),
        'draw_prob': float(draw_prob),
        'away_win_prob': float(away_win_prob),
        'predicted': predicted
    }


def predict_fixtures(model: object,
                    fixtures_df: pd.DataFrame,
                    matches_df: pd.DataFrame,
                    predictors: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Predict outcomes for multiple fixtures.
    
    Args:
        model: Trained model
        fixtures_df: DataFrame with fixtures (columns: date, home, away)
        matches_df: Historical match data
        predictors: List of predictor column names
    
    Returns:
        DataFrame with predictions added
    """
    predictions = []
    
    for _, fixture in fixtures_df.iterrows():
        home = fixture.get('home', fixture.get('Home', fixture.get('home_team')))
        away = fixture.get('away', fixture.get('Away', fixture.get('away_team')))
        date = fixture.get('date', fixture.get('Date'))
        
        try:
            pred = predict_match(model, home, away, matches_df, date=str(date) if pd.notna(date) else None, predictors=predictors)
            predictions.append(pred)
        except Exception as e:
            print(f"Error predicting {home} vs {away}: {e}")
            predictions.append({
                'home_team': home,
                'away_team': away,
                'home_win_prob': 0.33,
                'draw_prob': 0.33,
                'away_win_prob': 0.34,
                'predicted': 'Unknown'
            })
    
    return pd.DataFrame(predictions)

