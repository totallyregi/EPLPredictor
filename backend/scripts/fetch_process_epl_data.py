"""Fetch and process EPL data from Football-Data.org."""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

from backend.app.config import settings
from backend.app.data.football_data_client import FootballDataClient
from backend.app.data.processing import add_features, normalize_matches, validate_schema
from backend.app.data.storage import save_processed_csv, save_raw_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and process EPL data.")
    parser.add_argument(
        "--seasons",
        type=int,
        default=settings.seasons_to_fetch,
        help="Number of years of EPL data to fetch.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Optional custom output directory. Defaults to project data dirs.",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Always fetch fresh data from API.",
    )
    return parser.parse_args()


def _filter_date_window(raw_matches: list[dict], seasons: int) -> list[dict]:
    start = date.today() - timedelta(days=365 * seasons)
    filtered: list[dict] = []
    for match in raw_matches:
        utc_date = match.get("utcDate")
        if not utc_date:
            continue
        match_date = date.fromisoformat(utc_date[:10])
        if match_date >= start:
            filtered.append(match)
    return filtered


def _write_custom_outputs(output_dir: Path, historical_csv: str, training_csv: str, raw_json: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    # Files are already saved in standard paths; copy by reading/writing for explicit user path support.
    output_dir.joinpath("historical_matches.csv").write_text(Path(historical_csv).read_text(), encoding="utf-8")
    output_dir.joinpath("training_matches.csv").write_text(Path(training_csv).read_text(), encoding="utf-8")
    output_dir.joinpath("football_data_raw_matches.json").write_text(
        Path(raw_json).read_text(encoding="utf-8"),
        encoding="utf-8",
    )


def run_pipeline(seasons: int = settings.seasons_to_fetch, output_dir: str | None = None, force_refresh: bool = False) -> dict:
    """Fetch API data and regenerate processed datasets."""
    client = FootballDataClient()

    raw_matches = client.fetch_last_n_years(years=seasons)
    raw_matches = _filter_date_window(raw_matches, seasons)

    raw_file = save_raw_json(raw_matches, "football_data_raw_matches.json")
    normalized = normalize_matches(raw_matches)
    validate_schema(normalized)
    processed = add_features(normalized)

    historical_path = save_processed_csv(processed.historical_df, "historical_matches.csv")
    training_path = save_processed_csv(processed.training_df, "training_matches.csv")

    if output_dir:
        _write_custom_outputs(
            Path(output_dir),
            str(historical_path),
            str(training_path),
            str(raw_file),
        )

    return {
        "rows_raw": len(raw_matches),
        "rows_historical": len(processed.historical_df),
        "rows_training": len(processed.training_df),
        "historical_csv": str(historical_path),
        "training_csv": str(training_path),
        "raw_json": str(raw_file),
        "force_refresh": force_refresh,
    }


def main() -> None:
    args = parse_args()
    result = run_pipeline(
        seasons=args.seasons,
        output_dir=args.output_dir,
        force_refresh=args.force_refresh,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

