# EPL Match Predictor

A machine learning system for predicting Premier League match outcomes, featuring web scraping, feature engineering, model training, and a web interface.

## Features

- **Web Scraping**: Automatically scrapes match data from fbref.com
- **Feature Engineering**: Creates rolling averages and temporal features
- **Model Training**: Random Forest and Logistic Regression models
- **Prediction Interface**: Predict match outcomes with probabilities
- **CLI Tools**: Command-line interface for common operations
- **Web Frontend**: Next.js interface for viewing fixtures and predictions (Vercel-ready)

## Project Structure

```
EPLPredictor/
├── src/
│   ├── scraping.py          # Web scraping logic
│   ├── features.py          # Feature engineering pipeline
│   ├── model.py             # Model training and evaluation
│   ├── predict.py           # Prediction interface
│   └── cli.py               # Command-line interface
├── notebooks/
│   ├── scraping.ipynb       # Scraping demo
│   └── prediction.ipynb     # Training and prediction demo
├── data/
│   ├── raw/                 # Raw scraped data
│   └── processed/           # Processed matches
├── models/                  # Saved model files
└── requirements.txt
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd EPLPredictor
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Command-Line Interface

#### Scrape Match Data
```bash
python -m src scrape --years 2022 2021 --output data/raw/matches.csv
```

#### Train Model
```bash
python -m src train --data data/raw/matches.csv --output models/model.joblib
```

#### Predict Match
```bash
python -m src predict "Arsenal" "Liverpool" --model models/model.joblib --data data/raw/matches.csv
```

### Python API

```python
from src import scraping, features, model, predict

# Scrape data
matches_df = scraping.scrape_all_seasons([2022, 2021])
scraping.save_matches(matches_df, "data/raw/matches.csv")

# Engineer features
processed_df, X, y = features.prepare_features(matches_df)

# Train model
train_df, test_df = model.split_by_date(processed_df, '2022-01-01')
X_train = X.loc[train_df.index]
y_train = y.loc[train_df.index]
X_test = X.loc[test_df.index]
y_test = y.loc[test_df.index]

trained_model, metrics = model.train_and_evaluate(
    X_train, y_train, X_test, y_test,
    save_path="models/model.joblib"
)

# Make predictions
result = predict.predict_match(
    trained_model, "Arsenal", "Liverpool", processed_df
)
print(f"Predicted: {result['predicted']}")
print(f"Probabilities: Home {result['home_win_prob']:.2%}, "
      f"Draw {result['draw_prob']:.2%}, Away {result['away_win_prob']:.2%}")
```

### Jupyter Notebooks

See `notebooks/scraping.ipynb` and `notebooks/prediction.ipynb` for interactive examples.

## Features Used for Prediction

- **Venue**: Home vs Away (encoded)
- **Opponent**: Opponent team (encoded)
- **Temporal**: Hour of match, day of week
- **Rolling Averages** (3-match window):
  - Goals for/against
  - Shots, shots on target
  - Shot distance
  - Free kicks, penalties

## Model Performance

The default Random Forest model typically achieves:
- Accuracy: ~60-65%
- Precision: ~45-50%
- Recall: ~30-40%

Note: These metrics are for binary classification (win vs not-win). Draw predictions use heuristics.

## Frontend (Next.js)

The frontend interface is located in the `frontend/` directory. See the frontend README for setup and deployment instructions.

## Data Sources

Match data is scraped from [fbref.com](https://fbref.com), which provides comprehensive Premier League statistics.

## License

MIT License

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

