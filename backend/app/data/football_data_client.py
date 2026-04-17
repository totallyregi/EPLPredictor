"""Football-Data.org client for EPL match retrieval."""

from __future__ import annotations

import time
from datetime import date
from typing import Any

import requests

from ..config import settings


class FootballDataClient:
    """Thin client with retries and simple rate-limit backoff."""

    def __init__(self, api_key: str | None = None, timeout_seconds: int = 30) -> None:
        self.api_key = api_key or settings.football_data_api_key
        self.timeout_seconds = timeout_seconds
        self.base_url = settings.football_data_base_url.rstrip("/")

        if not self.api_key:
            raise ValueError("FOOTBALL_DATA_API_KEY is required to fetch match data.")

    def _headers(self) -> dict[str, str]:
        return {"X-Auth-Token": self.api_key}  # noqa: S105

    def _get(self, path: str, params: dict[str, Any], retries: int = 3) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        last_error: Exception | None = None

        for attempt in range(1, retries + 1):
            try:
                response = requests.get(
                    url,
                    headers=self._headers(),
                    params=params,
                    timeout=self.timeout_seconds,
                )
                if response.status_code == 429:
                    sleep_seconds = min(2**attempt, 10)
                    time.sleep(sleep_seconds)
                    continue
                response.raise_for_status()
                return response.json()
            except requests.RequestException as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(2**attempt)

        raise RuntimeError(f"Request failed for {url}: {last_error}") from last_error

    def fetch_matches(self, date_from: date, date_to: date, competition: str = "PL") -> list[dict[str, Any]]:
        """Fetch matches in the provided date range."""
        payload = self._get(
            f"competitions/{competition}/matches",
            params={"dateFrom": date_from.isoformat(), "dateTo": date_to.isoformat()},
        )
        return payload.get("matches", [])

    def fetch_matches_for_season(self, season_start_year: int, competition: str = "PL") -> list[dict[str, Any]]:
        """Fetch all matches for a specific EPL season start year."""
        payload = self._get(
            f"competitions/{competition}/matches",
            params={"season": season_start_year},
        )
        return payload.get("matches", [])

    def fetch_last_n_years(self, years: int = 5, competition: str = "PL") -> list[dict[str, Any]]:
        """Fetch last N EPL seasons using season-based API calls."""
        if years <= 0:
            return []

        today = date.today()
        current_season_start = today.year if today.month >= 8 else today.year - 1
        season_start_years = range(current_season_start - years + 1, current_season_start + 1)

        collected_matches: list[dict[str, Any]] = []
        seen_ids: set[int] = set()

        for season_start_year in season_start_years:
            matches = self.fetch_matches_for_season(season_start_year, competition=competition)
            for match in matches:
                match_id = match.get("id")
                if isinstance(match_id, int) and match_id in seen_ids:
                    continue
                if isinstance(match_id, int):
                    seen_ids.add(match_id)
                collected_matches.append(match)

        return collected_matches

