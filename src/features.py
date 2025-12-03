"""
Feature engineering module for Premier League match prediction.
"""

import pandas as pd
import numpy as np
from typing import Tuple


def load_matches(path: str) -> pd.DataFrame:
    """
    Load raw matches from CSV file.
    
    Args:
        path: Path to CSV file
    
    Returns:
        DataFrame with match data
    """
    df = pd.read_csv(path)
    return df


def create_target(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create binary target variable: 1 for win, 0 for draw or loss.
    
    Args:
        df: DataFrame with 'result' column (W, D, L)
    
    Returns:
        DataFrame with added 'target' column
    """
    df = df.copy()
    
    if 'result' not in df.columns:
        raise ValueError("DataFrame must contain 'result' column")
    
    df['target'] = (df['result'] == 'W').astype(int)
    return df


def encode_categorical(df: pd.DataFrame) -> pd.DataFrame:
    """
    Encode categorical variables: venue and opponent.
    
    Args:
        df: DataFrame with 'venue' and 'opponent' columns
    
    Returns:
        DataFrame with added 'venue_code' and 'opp_code' columns
    """
    df = df.copy()
    
    if 'venue' not in df.columns:
        raise ValueError("DataFrame must contain 'venue' column")
    if 'opponent' not in df.columns:
        raise ValueError("DataFrame must contain 'opponent' column")
    
    # Encode venue (Home=1, Away=0)
    df['venue_code'] = df['venue'].astype('category').cat.codes
    
    # Encode opponent
    df['opp_code'] = df['opponent'].astype('category').cat.codes
    
    return df


def extract_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract temporal features from date and time columns.
    
    Args:
        df: DataFrame with 'date' and 'time' columns
    
    Returns:
        DataFrame with added 'hour' and 'day_code' columns
    """
    df = df.copy()
    
    if 'date' not in df.columns:
        raise ValueError("DataFrame must contain 'date' column")
    
    # Convert date to datetime if not already
    if not pd.api.types.is_datetime64_any_dtype(df['date']):
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    
    # Extract day of week (0=Monday, 6=Sunday)
    df['day_code'] = df['date'].dt.dayofweek
    
    # Extract hour from time if available
    if 'time' in df.columns:
        # Handle time format (e.g., "15:00" or "15:00:00")
        df['hour'] = df['time'].str.replace(r':.+', '', regex=True).astype('Int64')
    else:
        df['hour'] = 15  # Default to 3 PM if time not available
    
    return df


def compute_rolling_averages(df: pd.DataFrame, window: int = 3) -> pd.DataFrame:
    """
    Compute rolling averages for key statistics per team.
    
    Args:
        df: DataFrame with match data, must be sorted by team and date
        window: Number of previous matches to include in rolling average
    
    Returns:
        DataFrame with added rolling average columns
    """
    df = df.copy()
    
    # Required columns for rolling averages
    rolling_cols = ['gf', 'ga', 'sh', 'sot', 'dist', 'fk', 'pk', 'pkatt']
    
    # Check which columns exist
    available_cols = [col for col in rolling_cols if col in df.columns]
    
    if not available_cols:
        print("Warning: No rolling columns found in DataFrame")
        return df
    
    # Ensure date is datetime and sort by team and date
    if not pd.api.types.is_datetime64_any_dtype(df['date']):
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    
    if 'team' not in df.columns:
        raise ValueError("DataFrame must contain 'team' column for rolling averages")
    
    df = df.sort_values(['team', 'date']).reset_index(drop=True)
    
    # Create new column names for rolling averages
    new_cols = [f"{col}_rolling" for col in available_cols]
    
    # Compute rolling averages per team
    for col, new_col in zip(available_cols, new_cols):
        # Rolling window with closed='left' (excludes current match)
        df[new_col] = df.groupby('team')[col].transform(
            lambda x: x.rolling(window=window, min_periods=1, closed='left').mean()
        )
    
    # Drop rows where rolling averages are NaN (first few matches per team)
    # Actually, we'll keep them but they'll have NaN values
    # The model training will handle NaN values appropriately
    
    return df


def build_feature_matrix(df: pd.DataFrame, 
                        predictors: list = None) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Build final feature matrix X and target vector y.
    
    Args:
        df: DataFrame with all engineered features
        predictors: List of predictor column names. If None, uses default set.
    
    Returns:
        Tuple of (X: DataFrame, y: Series)
    """
    if predictors is None:
        # Default predictors from the notebook
        base_predictors = ['venue_code', 'opp_code', 'hour', 'day_code']
        rolling_predictors = ['gf_rolling', 'ga_rolling', 'sh_rolling', 'sot_rolling', 
                            'dist_rolling', 'fk_rolling', 'pk_rolling', 'pkatt_rolling']
        
        # Only include predictors that exist in the DataFrame
        predictors = [p for p in base_predictors + rolling_predictors if p in df.columns]
    
    # Check that all predictors exist
    missing = [p for p in predictors if p not in df.columns]
    if missing:
        raise ValueError(f"Missing predictor columns: {missing}")
    
    # Check that target exists
    if 'target' not in df.columns:
        raise ValueError("DataFrame must contain 'target' column")
    
    X = df[predictors].copy()
    y = df['target'].copy()
    
    # Drop rows with NaN values in predictors or target
    mask = ~(X.isna().any(axis=1) | y.isna())
    X = X[mask]
    y = y[mask]
    
    return X, y


def prepare_features(df: pd.DataFrame, 
                    window: int = 3,
                    predictors: list = None) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    """
    Complete feature engineering pipeline.
    
    Args:
        df: Raw matches DataFrame
        window: Rolling average window size
        predictors: List of predictor columns. If None, uses default set.
    
    Returns:
        Tuple of (processed_df, X, y)
    """
    # Step 1: Create target
    df = create_target(df)
    
    # Step 2: Encode categorical variables
    df = encode_categorical(df)
    
    # Step 3: Extract temporal features
    df = extract_temporal_features(df)
    
    # Step 4: Compute rolling averages
    df = compute_rolling_averages(df, window=window)
    
    # Step 5: Build feature matrix
    X, y = build_feature_matrix(df, predictors=predictors)
    
    return df, X, y

