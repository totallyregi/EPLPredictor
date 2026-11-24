"""Match data store and Dixon-Coles adjusted Poisson model.

The deployed backend runs on an ephemeral disk, so data must never depend on a
manually-run pipeline. ``MatchStore`` fetches the last few EPL seasons from
Football-Data.org on demand, caches them in memory and on disk, and refreshes
them every few hours. The model is refit whenever the data changes.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from .config import settings
from .data.football_data_client import FootballDataClient
from .data.storage import processed_file_path

log = logging.getLogger("epl.model")

REFRESH_SECONDS = 3 * 3600          # fixtures/results refresh cadence
HALF_LIFE_DAYS = 240                # recency weighting for past matches
PRIOR_STRENGTH = 16.0               # pseudo expected-goals pulling ratings to the prior (tuned)
PROMOTED_PRIOR = (0.80, 1.20)       # (attack, defence weakness) for teams new to the data
RHO = -0.20                         # Dixon-Coles low-score dependence (tuned; boosts 0-0 / 1-1)
SIMULATIONS = 10000
MAX_GOALS = 10
CACHE_FILE = "matches.csv"

UPCOMING = {"SCHEDULED", "TIMED"}


# --------------------------------------------------------------------------- data
def _normalize(raw_matches: list[dict]) -> pd.DataFrame:
    rows = []
    for m in raw_matches:
        home, away = m.get("homeTeam") or {}, m.get("awayTeam") or {}
        full_time = (m.get("score") or {}).get("fullTime") or {}
        season = ((m.get("season") or {}).get("startDate") or "")[:4]
        if not m.get("utcDate") or not home.get("name") or not away.get("name"):
            continue
        rows.append(
            {
                "match_id": m.get("id"),
                "kickoff": m["utcDate"],
                "season": int(season) if season.isdigit() else None,
                "matchday": m.get("matchday"),
                "status": m.get("status"),
                "home_team": home.get("name"),
                "away_team": away.get("name"),
                "home_short": home.get("shortName") or home.get("name"),
                "away_short": away.get("shortName") or away.get("name"),
                "home_crest": home.get("crest"),
                "away_crest": away.get("crest"),
                "home_goals": full_time.get("home"),
                "away_goals": full_time.get("away"),
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, errors="coerce")
    df["home_goals"] = pd.to_numeric(df["home_goals"], errors="coerce")
    df["away_goals"] = pd.to_numeric(df["away_goals"], errors="coerce")
    return df.dropna(subset=["kickoff"]).sort_values("kickoff").reset_index(drop=True)


# --------------------------------------------------------------------------- model
@dataclass
class FittedModel:
    attack: dict[str, float]
    defence: dict[str, float]
    mu_home: float
    mu_away: float
    priors: dict[str, tuple[float, float]] = field(default_factory=dict)

    def expected_goals(self, home: str, away: str) -> tuple[float, float]:
        ha, hd = self.attack.get(home, PROMOTED_PRIOR[0]), self.defence.get(home, PROMOTED_PRIOR[1])
        aa, ad = self.attack.get(away, PROMOTED_PRIOR[0]), self.defence.get(away, PROMOTED_PRIOR[1])
        return max(0.15, self.mu_home * ha * ad), max(0.15, self.mu_away * aa * hd)


def fit_model(played: pd.DataFrame, as_of: pd.Timestamp) -> FittedModel:
    """Weighted attack/defence ratings with opponent adjustment and Bayesian shrinkage."""
    age_days = (as_of - played["kickoff"]).dt.total_seconds() / 86400
    w = np.power(0.5, age_days.clip(lower=0) / HALF_LIFE_DAYS).to_numpy()
    hg, ag = played["home_goals"].to_numpy(float), played["away_goals"].to_numpy(float)
    home, away = played["home_team"].to_numpy(), played["away_team"].to_numpy()

    mu_home = float((w * hg).sum() / w.sum())
    mu_away = float((w * ag).sum() / w.sum())

    teams = sorted(set(home) | set(away))
    idx = {t: i for i, t in enumerate(teams)}
    hi = np.array([idx[t] for t in home])
    ai = np.array([idx[t] for t in away])

    # Teams absent from the previous season in the data are treated as promoted.
    latest = int(played["season"].max())
    prev_teams = set(played.loc[played["season"] == latest - 1, ["home_team", "away_team"]].to_numpy().ravel())
    has_history = played["season"].nunique() > 1
    prior_att = np.ones(len(teams))
    prior_def = np.ones(len(teams))
    priors: dict[str, tuple[float, float]] = {}
    for t, i in idx.items():
        if has_history and t not in prev_teams:
            prior_att[i], prior_def[i] = PROMOTED_PRIOR
        priors[t] = (float(prior_att[i]), float(prior_def[i]))

    att = prior_att.copy()
    dfn = prior_def.copy()
    for _ in range(25):
        # Attack: goals scored vs. goals expected from opponent defence.
        g_for = np.bincount(hi, w * hg, len(teams)) + np.bincount(ai, w * ag, len(teams))
        e_for = np.bincount(hi, w * mu_home * dfn[ai], len(teams)) + np.bincount(ai, w * mu_away * dfn[hi], len(teams))
        att = (g_for + PRIOR_STRENGTH * prior_att) / (e_for + PRIOR_STRENGTH)
        att /= np.exp(np.mean(np.log(att)))
        # Defence: goals conceded vs. goals expected from opponent attack.
        g_ag = np.bincount(hi, w * ag, len(teams)) + np.bincount(ai, w * hg, len(teams))
        e_ag = np.bincount(hi, w * mu_away * att[ai], len(teams)) + np.bincount(ai, w * mu_home * att[hi], len(teams))
        dfn = (g_ag + PRIOR_STRENGTH * prior_def) / (e_ag + PRIOR_STRENGTH)
        dfn /= np.exp(np.mean(np.log(dfn)))

    return FittedModel(
        attack={t: float(att[i]) for t, i in idx.items()},
        defence={t: float(dfn[i]) for t, i in idx.items()},
        mu_home=mu_home,
        mu_away=mu_away,
        priors=priors,
    )


def score_matrix(lam_home: float, lam_away: float) -> np.ndarray:
    goals = np.arange(MAX_GOALS + 1)
    fact = np.array([math.factorial(int(k)) for k in goals], dtype=float)
    ph = np.exp(-lam_home) * lam_home**goals / fact
    pa = np.exp(-lam_away) * lam_away**goals / fact
    m = np.outer(ph, pa)
    # Dixon-Coles correction for low-scoring outcomes.
    m[0, 0] *= 1 - lam_home * lam_away * RHO
    m[0, 1] *= 1 + lam_home * RHO
    m[1, 0] *= 1 + lam_away * RHO
    m[1, 1] *= 1 - RHO
    m = np.clip(m, 0, None)
    return m / m.sum()


def predict(model: FittedModel, home: str, away: str) -> dict[str, Any]:
    lam_h, lam_a = model.expected_goals(home, away)
    m = score_matrix(lam_h, lam_a)
    home_win = float(np.tril(m, -1).sum())
    draw = float(np.trace(m))
    away_win = float(np.triu(m, 1).sum())
    probs = {"Home Win": home_win, "Draw": draw, "Away Win": away_win}
    predicted = max(probs, key=probs.get)
    # Most likely scoreline *consistent with* the predicted outcome (plain argmax is nearly always 1-1).
    i, j = np.indices(m.shape)
    region = {"Home Win": i > j, "Draw": i == j, "Away Win": i < j}[predicted]
    h, a = np.unravel_index(np.argmax(np.where(region, m, -1)), m.shape)
    top_scores = sorted(
        ((float(m[i, j]), f"{i}-{j}") for i in range(6) for j in range(6)), reverse=True
    )[:3]
    return {
        "home_win_prob": round(home_win, 4),
        "draw_prob": round(draw, 4),
        "away_win_prob": round(away_win, 4),
        "expected_home_goals": round(lam_h, 2),
        "expected_away_goals": round(lam_a, 2),
        "predicted": predicted,
        "predicted_score": f"{h}-{a}",
        "top_scores": [{"score": s, "prob": round(p, 4)} for p, s in top_scores],
        "both_teams_score_prob": round(float(m[1:, 1:].sum()), 4),
        "over_2_5_prob": round(float(sum(m[i, j] for i in range(MAX_GOALS + 1) for j in range(MAX_GOALS + 1) if i + j > 2)), 4),
        "score_matrix": [[round(float(m[r, c]), 4) for c in range(6)] for r in range(6)],
        "prediction_source": "dixon_coles_poisson",
        "match_odds": {"home_win": round(home_win, 4), "draw": round(draw, 4), "away_win": round(away_win, 4)},
    }


def _result(hg: float, ag: float) -> str:
    return "H" if hg > ag else ("A" if ag > hg else "D")


def backtest(played: pd.DataFrame, last_n: int = 300) -> dict[str, Any] | None:
    """Walk-forward check: predict each recent match using only data from before its date."""
    if len(played) < last_n + 200:
        last_n = max(0, len(played) - 200)
    if last_n < 50:
        return None
    test = played.tail(last_n)
    correct = home_baseline = exact = 0
    log_loss = brier = 0.0
    records: list[dict[str, Any]] = []
    bins = np.zeros((10, 2))  # [sum of predicted prob, hits] per 10% bucket
    counts = np.zeros(10)
    for _, group in test.groupby(test["kickoff"].dt.date):
        cutoff = group["kickoff"].min()
        model = fit_model(played[played["kickoff"] < cutoff], cutoff)
        for row in group.itertuples():
            p = predict(model, row.home_team, row.away_team)
            actual = _result(row.home_goals, row.away_goals)
            probs = {"H": p["home_win_prob"], "D": p["draw_prob"], "A": p["away_win_prob"]}
            pick = max(probs, key=probs.get)
            correct += int(pick == actual)
            home_baseline += int(actual == "H")
            exact += int(p["predicted_score"] == f"{int(row.home_goals)}-{int(row.away_goals)}")
            log_loss -= math.log(max(probs[actual], 1e-6))
            brier += sum((probs[k] - (k == actual)) ** 2 for k in probs)
            for k, v in probs.items():
                b_ = min(int(v * 10), 9)
                bins[b_, 0] += v
                bins[b_, 1] += int(k == actual)
                counts[b_] += 1
            records.append(
                {
                    "date": row.kickoff.strftime("%Y-%m-%d"),
                    "home": row.home_team, "away": row.away_team,
                    "home_short": row.home_short, "away_short": row.away_short,
                    "home_crest": row.home_crest, "away_crest": row.away_crest,
                    "score": f"{int(row.home_goals)}-{int(row.away_goals)}",
                    "predicted_score": p["predicted_score"],
                    "pick": pick, "actual": actual, "correct": pick == actual,
                    "probs": {k: round(v, 3) for k, v in probs.items()},
                }
            )
    calibration = [
        {"bucket": f"{i * 10}-{i * 10 + 10}%", "predicted": round(float(bins[i, 0] / counts[i]), 3), "observed": round(float(bins[i, 1] / counts[i]), 3), "n": int(counts[i])}
        for i in range(10) if counts[i] >= 8
    ]
    return {
        "matches": last_n,
        "accuracy": round(correct / last_n, 3),
        "home_win_baseline": round(home_baseline / last_n, 3),
        "exact_score_rate": round(exact / last_n, 3),
        "log_loss": round(log_loss / last_n, 3),
        "uniform_log_loss": round(math.log(3), 3),
        "brier": round(brier / last_n, 3),
        "calibration": calibration,
        "recent": list(reversed(records[-30:])),
    }


def walk_forward(played: pd.DataFrame, min_history: int = 250) -> list[dict[str, Any]]:
    """Predict every completed match using only matches played before that day.

    Seasons are included only when enough earlier data exists to fit the model fairly.
    """
    played = played.sort_values("kickoff")
    first_season = int(played["season"].min())
    candidates = played[played["season"] > first_season]
    out: list[dict[str, Any]] = []
    for _, group in candidates.groupby(candidates["kickoff"].dt.date):
        cutoff = group["kickoff"].min()
        history = played[played["kickoff"] < cutoff]
        if len(history) < min_history:
            continue
        model = fit_model(history, cutoff)
        for row in group.itertuples():
            p = predict(model, row.home_team, row.away_team)
            actual = _result(row.home_goals, row.away_goals)
            probs = {"H": p["home_win_prob"], "D": p["draw_prob"], "A": p["away_win_prob"]}
            pick = max(probs, key=probs.get)
            score = f"{int(row.home_goals)}-{int(row.away_goals)}"
            out.append(
                {
                    "match_id": row.match_id,
                    "season": int(row.season),
                    "matchday": None if row.matchday != row.matchday else int(row.matchday),
                    "date": row.kickoff.strftime("%Y-%m-%d"),
                    "kickoff": row.kickoff.isoformat(),
                    "home": row.home_team, "away": row.away_team,
                    "home_short": row.home_short, "away_short": row.away_short,
                    "home_crest": row.home_crest, "away_crest": row.away_crest,
                    "score": score,
                    "predicted_score": p["predicted_score"],
                    "xg": [p["expected_home_goals"], p["expected_away_goals"]],
                    "probs": {k: round(v, 3) for k, v in probs.items()},
                    "pick": pick,
                    "actual": actual,
                    "correct": pick == actual,
                    "exact": p["predicted_score"] == score,
                    "confidence": round(probs[pick], 3),
                    "actual_prob": round(probs[actual], 3),
                }
            )
    return out


def season_analysis(records: list[dict[str, Any]], season: int) -> dict[str, Any]:
    rows = [r for r in records if r["season"] == season]
    if not rows:
        return {"season": season, "matches": 0, "gameweeks": []}
    n = len(rows)
    correct = sum(r["correct"] for r in rows)
    exact = sum(r["exact"] for r in rows)
    home_base = sum(r["actual"] == "H" for r in rows)

    gameweeks = []
    cum_correct = cum_n = 0
    for md in sorted({r["matchday"] for r in rows if r["matchday"] is not None}):
        g = sorted([r for r in rows if r["matchday"] == md], key=lambda r: r["kickoff"])
        c = sum(r["correct"] for r in g)
        cum_correct += c
        cum_n += len(g)
        gameweeks.append(
            {
                "matchday": md,
                "matches": len(g),
                "correct": c,
                "exact": sum(r["exact"] for r in g),
                "accuracy": round(c / len(g), 3),
                "cumulative_accuracy": round(cum_correct / cum_n, 3),
                "start": g[0]["date"], "end": g[-1]["date"],
                "games": g,
            }
        )

    bands = []
    for lo, hi, label in ((0, 0.4, "Under 40%"), (0.4, 0.5, "40–50%"), (0.5, 0.6, "50–60%"), (0.6, 1.01, "60%+")):
        b = [r for r in rows if lo <= r["confidence"] < hi]
        if b:
            bands.append({"label": label, "matches": len(b), "accuracy": round(sum(r["correct"] for r in b) / len(b), 3), "avg_confidence": round(sum(r["confidence"] for r in b) / len(b), 3)})

    matrix = {p: {a: sum(1 for r in rows if r["pick"] == p and r["actual"] == a) for a in "HDA"} for p in "HDA"}
    upsets = sorted(rows, key=lambda r: r["actual_prob"])[:5]
    best = sorted([r for r in rows if r["correct"]], key=lambda r: -r["confidence"])[:5]
    best_gw = max(gameweeks, key=lambda g: (g["accuracy"], g["matches"])) if gameweeks else None
    worst_gw = min(gameweeks, key=lambda g: (g["accuracy"], -g["matches"])) if gameweeks else None
    return {
        "season": season,
        "label": f"{season}/{str(season + 1)[-2:]}",
        "matches": n,
        "correct": correct,
        "accuracy": round(correct / n, 3),
        "exact": exact,
        "exact_rate": round(exact / n, 3),
        "home_baseline": round(home_base / n, 3),
        "log_loss": round(sum(-math.log(max(r["actual_prob"], 1e-6)) for r in rows) / n, 3),
        "best_gameweek": {k: best_gw[k] for k in ("matchday", "accuracy", "correct", "matches")} if best_gw else None,
        "worst_gameweek": {k: worst_gw[k] for k in ("matchday", "accuracy", "correct", "matches")} if worst_gw else None,
        "confidence_bands": bands,
        "outcome_matrix": matrix,
        "upsets": upsets,
        "best_calls": best,
        "gameweeks": gameweeks,
    }


def standings(df: pd.DataFrame, season: int) -> pd.DataFrame:
    cur = df[df["season"] == season]
    teams = sorted(set(cur["home_team"]) | set(cur["away_team"]))
    t = pd.DataFrame(0, index=teams, columns=["P", "W", "D", "L", "GF", "GA", "Pts"])
    fin = cur[(cur["status"] == "FINISHED") & cur["home_goals"].notna()]
    for r in fin.itertuples():
        hg, ag = int(r.home_goals), int(r.away_goals)
        for team, gf, ga in ((r.home_team, hg, ag), (r.away_team, ag, hg)):
            t.loc[team, ["P", "GF", "GA"]] += [1, gf, ga]
            if gf > ga:
                t.loc[team, ["W", "Pts"]] += [1, 3]
            elif gf == ga:
                t.loc[team, ["D", "Pts"]] += [1, 1]
            else:
                t.loc[team, "L"] += 1
    t["GD"] = t["GF"] - t["GA"]
    return t.sort_values(["Pts", "GD", "GF"], ascending=False)


def simulate_season(df: pd.DataFrame, model: FittedModel, n: int = SIMULATIONS, seed: int = 7) -> list[dict[str, Any]]:
    """Monte Carlo the rest of the current season from the model's scoreline distributions."""
    season = int(df["season"].max())
    table = standings(df, season)
    teams = list(table.index)
    ix = {t: i for i, t in enumerate(teams)}
    cur = df[df["season"] == season]
    remaining = cur[cur["status"] != "FINISHED"]
    rng = np.random.default_rng(seed)
    pts = np.tile(table["Pts"].to_numpy(float), (n, 1))
    gd = np.tile(table["GD"].to_numpy(float), (n, 1))
    gf = np.tile(table["GF"].to_numpy(float), (n, 1))
    size = 7
    for r in remaining.itertuples():
        if r.home_team not in ix or r.away_team not in ix:
            continue
        m = score_matrix(*model.expected_goals(r.home_team, r.away_team))[:size, :size].ravel()
        draws = rng.choice(size * size, size=n, p=m / m.sum())
        hg, ag = draws // size, draws % size
        h, a = ix[r.home_team], ix[r.away_team]
        pts[:, h] += np.where(hg > ag, 3, np.where(hg == ag, 1, 0))
        pts[:, a] += np.where(ag > hg, 3, np.where(hg == ag, 1, 0))
        gd[:, h] += hg - ag
        gd[:, a] += ag - hg
        gf[:, h] += hg
        gf[:, a] += ag
    score = pts * 1e6 + (gd + 500) * 1e3 + gf + rng.random(pts.shape) * 0.1
    order = np.argsort(-score, axis=1)
    position = np.empty_like(order)
    position[np.arange(n)[:, None], order] = np.arange(len(teams))
    crests = {}
    shorts = {}
    for r in cur.itertuples():
        crests[r.home_team], crests[r.away_team] = r.home_crest, r.away_crest
        shorts[r.home_team], shorts[r.away_team] = r.home_short, r.away_short
    out = []
    for t in teams:
        i = ix[t]
        row = table.loc[t]
        out.append(
            {
                "team": t, "short": shorts.get(t, t), "crest": crests.get(t),
                "played": int(row.P), "won": int(row.W), "drawn": int(row.D), "lost": int(row.L),
                "gf": int(row.GF), "ga": int(row.GA), "gd": int(row.GD), "points": int(row.Pts),
                "projected_points": round(float(pts[:, i].mean()), 1),
                "projected_position": round(float(position[:, i].mean()) + 1, 1),
                "title": round(float((position[:, i] == 0).mean()), 4),
                "top4": round(float((position[:, i] < 4).mean()), 4),
                "relegation": round(float((position[:, i] >= len(teams) - 3).mean()), 4),
                "attack": round(model.attack.get(t, PROMOTED_PRIOR[0]), 3),
                "defence": round(model.defence.get(t, PROMOTED_PRIOR[1]), 3),
            }
        )
    out.sort(key=lambda x: (-x["projected_points"], x["projected_position"]))
    return out


# --------------------------------------------------------------------------- store
class MatchStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.df: pd.DataFrame | None = None
        self.model: FittedModel | None = None
        self.loaded_at: float = 0.0
        self.updated_at: datetime | None = None
        self.backtest: dict[str, Any] | None = None
        self.projection: list[dict[str, Any]] | None = None
        self.history_predictions: list[dict[str, Any]] = []
        self.last_error: str | None = None

    # -- loading
    def _load_disk(self) -> None:
        path = processed_file_path(CACHE_FILE)
        if not path.exists():
            return
        df = pd.read_csv(path)
        df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, errors="coerce")
        self._set(df, datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc))
        self.loaded_at = path.stat().st_mtime

    def _fetch(self) -> None:
        client = FootballDataClient()
        raw = client.fetch_last_n_years(years=settings.seasons_to_fetch)
        df = _normalize(raw)
        if df.empty:
            raise RuntimeError("Football-Data returned no matches")
        df.to_csv(processed_file_path(CACHE_FILE), index=False)
        self._set(df, datetime.now(timezone.utc))
        self.loaded_at = time.time()
        self.last_error = None
        log.info("Loaded %d matches from Football-Data", len(df))

    def _set(self, df: pd.DataFrame, updated_at: datetime) -> None:
        played = self.played(df)
        self.df = df
        self.updated_at = updated_at
        self.model = fit_model(played, pd.Timestamp.now(tz="UTC")) if not played.empty else None
        try:
            self.backtest = backtest(played)
        except Exception:  # noqa: BLE001
            log.exception("Backtest failed")
            self.backtest = None
        try:
            self.history_predictions = walk_forward(played)
        except Exception:  # noqa: BLE001
            log.exception("Walk-forward history failed")
            self.history_predictions = []
        try:
            self.projection = simulate_season(df, self.model) if self.model else None
        except Exception:  # noqa: BLE001
            log.exception("Season simulation failed")
            self.projection = None

    def ensure(self, force: bool = False) -> None:
        """Make sure data is loaded and reasonably fresh. Never raises if stale data exists."""
        if not force and self.df is not None and time.time() - self.loaded_at < REFRESH_SECONDS:
            return
        with self._lock:
            if not force and self.df is not None and time.time() - self.loaded_at < REFRESH_SECONDS:
                return
            if self.df is None and not force:
                try:
                    self._load_disk()
                except Exception:  # noqa: BLE001
                    log.exception("Could not read cached matches")
                if self.df is not None and time.time() - self.loaded_at < REFRESH_SECONDS:
                    return
            try:
                self._fetch()
            except Exception as exc:  # noqa: BLE001
                self.last_error = str(exc)
                log.exception("Refreshing match data failed")
                if self.df is None:
                    raise

    def warm_up_async(self) -> None:
        threading.Thread(target=lambda: self._safe_ensure(), daemon=True).start()

    def _safe_ensure(self) -> None:
        try:
            self.ensure()
        except Exception:  # noqa: BLE001
            pass

    # -- views
    @staticmethod
    def played(df: pd.DataFrame) -> pd.DataFrame:
        return df[(df["status"] == "FINISHED") & df["home_goals"].notna() & df["away_goals"].notna()].copy()

    def form(self, team: str, n: int = 5) -> list[dict[str, Any]]:
        played = self.played(self.df)
        rows = played[(played["home_team"] == team) | (played["away_team"] == team)].tail(n)
        out = []
        for r in rows.itertuples():
            is_home = r.home_team == team
            gf, ga = (r.home_goals, r.away_goals) if is_home else (r.away_goals, r.home_goals)
            out.append(
                {
                    "result": "W" if gf > ga else ("L" if gf < ga else "D"),
                    "score": f"{int(gf)}-{int(ga)}",
                    "opponent": r.away_short if is_home else r.home_short,
                    "home": bool(is_home),
                    "date": r.kickoff.strftime("%Y-%m-%d"),
                }
            )
        return list(reversed(out))  # most recent first

    def upcoming(self) -> pd.DataFrame:
        now = pd.Timestamp.now(tz="UTC") - pd.Timedelta(hours=3)
        df = self.df
        return df[df["status"].isin(UPCOMING) & (df["kickoff"] >= now)].sort_values("kickoff")

    def model_info(self) -> dict[str, Any]:
        played = self.played(self.df)
        return {
            "name": "Dixon-Coles adjusted Poisson",
            "trained_on_matches": int(len(played)),
            "seasons": sorted(int(s) for s in played["season"].dropna().unique()),
            "home_advantage": round(self.model.mu_home / self.model.mu_away, 3) if self.model else None,
            "avg_goals_per_match": round(self.model.mu_home + self.model.mu_away, 2) if self.model else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "backtest": {k: v for k, v in (self.backtest or {}).items() if k != "recent"} or None,
            "simulations": SIMULATIONS,
            "stale": self.last_error is not None,
        }


store = MatchStore()
