# EPL Match Predictor

A machine learning system for predicting Premier League match outcomes, featuring web scraping, feature engineering, model training, and a web interface.

## Features

- **Football-Data.org Pipeline**: Pull and process 5 years of EPL match data from API
- **Feature Engineering**: Recent form, head-to-head edge, home advantage, and goal differential
- **Prediction API**: FastAPI endpoint with Poisson-based probabilities and expected scoreline
- **Historical API**: FastAPI endpoint serving processed 5-year history table
- **Frontend Bridge**: Next.js API routes proxy to backend for fixtures, predictions, and history

## Project Structure

```
EPLPredictor/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI routes (fixtures, predict, history)
│   │   ├── data/            # Football-Data client + processing logic
│   │   ├── config.py        # Env + path settings
│   │   └── main.py          # FastAPI app entrypoint
│   └── scripts/
│       └── fetch_process_epl_data.py
├── frontend/                # Next.js dashboard app
├── src/                     # Legacy model/feature modules (kept for compatibility)
├── data/
│   ├── raw/                 # Raw API payload snapshots
│   └── processed/           # historical_matches.csv, training_matches.csv
├── models/
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

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required:

- `FOOTBALL_DATA_API_KEY`: API key from Football-Data.org
- `BACKEND_API_URL`: URL the Next.js routes use to reach FastAPI (default `http://localhost:8000`)
- `NEXT_PUBLIC_BASE_URL`: Base URL for frontend app self-calls (default `http://localhost:3000`)

## Usage

### 1) Fetch + Process EPL Data (5 years)

```bash
python -m backend.scripts.fetch_process_epl_data --seasons 5
```

Optional:

```bash
python -m backend.scripts.fetch_process_epl_data --seasons 5 --output-dir data/exports --force-refresh
```

This writes:
- `data/raw/football_data_raw_matches.json`
- `data/processed/historical_matches.csv`
- `data/processed/training_matches.csv`

### 2) Run FastAPI Backend

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Available backend endpoints:
- `GET /health`
- `GET /api/fixtures/week`
- `POST /api/predict`
- `GET /api/history?years=5`

### 3) Run Next.js Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend API routes:
- `GET /api/fixtures` (proxies to backend fixtures)
- `POST /api/predict` (proxies to backend prediction)
- `GET /api/predictions` (batches fixture predictions)
- `GET /api/history` (proxies to backend history)

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

## Data Sources

Primary source is [Football-Data.org](https://www.football-data.org/) via REST API.

## License

MIT License

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

