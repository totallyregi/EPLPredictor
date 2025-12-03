"""
Command-line interface for EPL Match Predictor.
"""

import argparse
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import scraping, features, model, predict


def scrape_command(args):
    """Handle scrape command."""
    print(f"Scraping seasons: {args.years}")
    try:
        df = scraping.scrape_all_seasons(args.years, delay=args.delay)
        output_path = args.output or "data/raw/matches.csv"
        scraping.save_matches(df, output_path)
        print(f"Successfully scraped {len(df)} matches")
    except Exception as e:
        print(f"Error during scraping: {e}", file=sys.stderr)
        sys.exit(1)


def train_command(args):
    """Handle train command."""
    print(f"Training model from {args.data}")
    
    # Load data
    matches_df = features.load_matches(args.data)
    
    # Engineer features
    print("Engineering features...")
    processed_df, X, y = features.prepare_features(matches_df, window=args.window)
    
    # Split by date
    print(f"Splitting data at {args.cutoff_date}...")
    train_df, test_df = model.split_by_date(processed_df, args.cutoff_date)
    
    # Get features for train/test
    X_train = X.loc[train_df.index]
    y_train = y.loc[train_df.index]
    X_test = X.loc[test_df.index]
    y_test = y.loc[test_df.index]
    
    # Train and evaluate
    print(f"Training {args.model_type} model...")
    trained_model, metrics = model.train_and_evaluate(
        X_train, y_train, X_test, y_test,
        model_type=args.model_type,
        save_path=args.output,
        n_estimators=args.n_estimators,
        min_samples_split=args.min_samples_split
    )
    
    # Print results
    print("\n=== Model Evaluation ===")
    print(f"Accuracy: {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall: {metrics['recall']:.4f}")
    print(f"\nConfusion Matrix:")
    print(f"  True Neg: {metrics['confusion_matrix'][0][0]}, False Pos: {metrics['confusion_matrix'][0][1]}")
    print(f"  False Neg: {metrics['confusion_matrix'][1][0]}, True Pos: {metrics['confusion_matrix'][1][1]}")
    
    if args.output:
        print(f"\nModel saved to {args.output}")


def predict_command(args):
    """Handle predict command."""
    print(f"Loading model from {args.model}")
    
    # Load model
    trained_model = model.load_model(args.model)
    
    # Load matches data
    matches_df = features.load_matches(args.data)
    
    # Engineer features (needed for prediction)
    processed_df, _, _ = features.prepare_features(matches_df, window=3)
    
    # Make prediction
    result = predict.predict_match(
        trained_model,
        args.home_team,
        args.away_team,
        processed_df,
        date=args.date
    )
    
    # Print results
    print(f"\n=== Prediction: {result['home_team']} vs {result['away_team']} ===")
    print(f"Predicted Outcome: {result['predicted']}")
    print(f"\nProbabilities:")
    print(f"  Home Win: {result['home_win_prob']:.2%}")
    print(f"  Draw: {result['draw_prob']:.2%}")
    print(f"  Away Win: {result['away_win_prob']:.2%}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='EPL Match Predictor CLI')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Scrape command
    scrape_parser = subparsers.add_parser('scrape', help='Scrape match data from fbref')
    scrape_parser.add_argument('--years', nargs='+', type=int, default=[2022, 2021],
                              help='Years to scrape (default: 2022 2021)')
    scrape_parser.add_argument('--output', '-o', type=str, default='data/raw/matches.csv',
                              help='Output file path')
    scrape_parser.add_argument('--delay', type=float, default=1.0,
                              help='Delay between requests in seconds')
    
    # Train command
    train_parser = subparsers.add_parser('train', help='Train prediction model')
    train_parser.add_argument('--data', '-d', type=str, default='data/raw/matches.csv',
                             help='Input data file')
    train_parser.add_argument('--output', '-o', type=str, default='models/model.joblib',
                             help='Output model file')
    train_parser.add_argument('--cutoff-date', type=str, default='2022-01-01',
                             help='Train/test split date')
    train_parser.add_argument('--model-type', type=str, default='random_forest',
                             choices=['random_forest', 'logistic_regression'],
                             help='Model type to train')
    train_parser.add_argument('--window', type=int, default=3,
                             help='Rolling average window size')
    train_parser.add_argument('--n-estimators', type=int, default=50,
                             help='Number of trees (for random forest)')
    train_parser.add_argument('--min-samples-split', type=int, default=10,
                             help='Min samples split (for random forest)')
    
    # Predict command
    predict_parser = subparsers.add_parser('predict', help='Predict match outcome')
    predict_parser.add_argument('--model', '-m', type=str, default='models/model.joblib',
                               help='Model file path')
    predict_parser.add_argument('--data', '-d', type=str, default='data/raw/matches.csv',
                              help='Historical match data file')
    predict_parser.add_argument('home_team', type=str, help='Home team name')
    predict_parser.add_argument('away_team', type=str, help='Away team name')
    predict_parser.add_argument('--date', type=str, default=None,
                               help='Match date (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'scrape':
        scrape_command(args)
    elif args.command == 'train':
        train_command(args)
    elif args.command == 'predict':
        predict_command(args)


if __name__ == '__main__':
    main()

