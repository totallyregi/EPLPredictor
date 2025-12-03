"""
Model training and evaluation module.
"""

import os
import joblib
from typing import Tuple, Dict, Optional
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix


def split_by_date(df: pd.DataFrame, cutoff_date: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split dataset into train and test sets based on date.
    
    Args:
        df: DataFrame with 'date' column
        cutoff_date: Date string (e.g., '2022-01-01') - train before, test after
    
    Returns:
        Tuple of (train_df, test_df)
    """
    if not pd.api.types.is_datetime64_any_dtype(df['date']):
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    
    cutoff = pd.to_datetime(cutoff_date)
    train = df[df['date'] < cutoff].copy()
    test = df[df['date'] >= cutoff].copy()
    
    return train, test


def train_model(X_train: pd.DataFrame, 
                y_train: pd.Series, 
                model_type: str = 'random_forest',
                **kwargs) -> object:
    """
    Train a machine learning model.
    
    Args:
        X_train: Training features
        y_train: Training target
        model_type: Type of model ('random_forest', 'logistic_regression')
        **kwargs: Additional model parameters
    
    Returns:
        Trained model
    """
    if model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=kwargs.get('n_estimators', 50),
            min_samples_split=kwargs.get('min_samples_split', 10),
            random_state=kwargs.get('random_state', 1),
            **{k: v for k, v in kwargs.items() if k not in ['n_estimators', 'min_samples_split', 'random_state']}
        )
    elif model_type == 'logistic_regression':
        model = LogisticRegression(
            random_state=kwargs.get('random_state', 1),
            max_iter=kwargs.get('max_iter', 1000),
            **{k: v for k, v in kwargs.items() if k not in ['random_state', 'max_iter']}
        )
    else:
        raise ValueError(f"Unknown model_type: {model_type}")
    
    model.fit(X_train, y_train)
    return model


def evaluate_model(model: object, 
                  X_test: pd.DataFrame, 
                  y_test: pd.Series) -> Dict:
    """
    Evaluate model performance on test set.
    
    Args:
        model: Trained model
        X_test: Test features
        y_test: Test target
    
    Returns:
        Dictionary with evaluation metrics
    """
    y_pred = model.predict(X_test)
    y_pred_proba = None
    
    # Get probabilities if available
    if hasattr(model, 'predict_proba'):
        y_pred_proba = model.predict_proba(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)
    
    metrics = {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'confusion_matrix': cm.tolist(),
        'predictions': y_pred.tolist(),
        'probabilities': y_pred_proba.tolist() if y_pred_proba is not None else None
    }
    
    return metrics


def save_model(model: object, path: str):
    """
    Save trained model to disk.
    
    Args:
        model: Trained model
        path: File path to save model (should end in .joblib or .pkl)
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(model, path)
    print(f"Model saved to {path}")


def load_model(path: str) -> object:
    """
    Load trained model from disk.
    
    Args:
        path: File path to load model from
    
    Returns:
        Loaded model
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found: {path}")
    
    model = joblib.load(path)
    return model


def train_and_evaluate(X_train: pd.DataFrame,
                       y_train: pd.Series,
                       X_test: pd.DataFrame,
                       y_test: pd.Series,
                       model_type: str = 'random_forest',
                       save_path: Optional[str] = None,
                       **model_kwargs) -> Tuple[object, Dict]:
    """
    Train model and evaluate on test set.
    
    Args:
        X_train: Training features
        y_train: Training target
        X_test: Test features
        y_test: Test target
        model_type: Type of model to train
        save_path: Optional path to save model
        **model_kwargs: Additional model parameters
    
    Returns:
        Tuple of (trained_model, evaluation_metrics)
    """
    # Train model
    model = train_model(X_train, y_train, model_type=model_type, **model_kwargs)
    
    # Evaluate
    metrics = evaluate_model(model, X_test, y_test)
    
    # Save if path provided
    if save_path:
        save_model(model, save_path)
    
    return model, metrics

