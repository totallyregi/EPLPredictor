'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MatchCard, { type Prediction } from './components/MatchCard';
import TeamBadge from './components/TeamBadge';

interface ModelInfo {
  name: string;
  trained_on_matches: number;
  seasons: number[];
  home_advantage: number | null;
  avg_goals_per_match: number | null;
  updated_at: string | null;
  backtest: { matches: number; accuracy: number; home_win_baseline: number; log_loss: number } | null;
}

interface Result {
  date: string;
  matchday: number | null;
  home_team: string;
  away_team: string;
  home_crest?: string;
  away_crest?: string;
  home_goals: number;
  away_goals: number;
}

const MAX_ATTEMPTS = 4;

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export default function Home() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [matchday, setMatchday] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'waking' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (n = 1) => {
    setAttempt(n);
    setStatus(n === 1 ? 'loading' : 'waking');
    // If the free-tier server is asleep, the first request can take ~50s.
    const slow = setTimeout(() => setStatus('waking'), 4000);
    try {
      const res = await fetch('/api/predictions?matchdays=4', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data?.error || 'Prediction service unavailable'), { waking: data?.waking });
      const list: Prediction[] = data.predictions || [];
      setPredictions(list);
      setModel(data.model || null);
      setMatchday(list.find((p) => p.matchday != null)?.matchday ?? null);
      setStatus('ready');
      fetch('/api/history?limit=10', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { history: [] }))
        .then((h) => setResults(h.history || []))
        .catch(() => {});
    } catch (err) {
      const e = err as Error & { waking?: boolean };
      setMessage(e.message);
      if (n < MAX_ATTEMPTS) {
        setStatus('waking');
        setTimeout(() => load(n + 1), 5000);
      } else {
        setStatus('error');
      }
    } finally {
      clearTimeout(slow);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const matchdays = useMemo(
    () => Array.from(new Set(predictions.map((p) => p.matchday).filter((m): m is number => m != null))).sort((a, b) => a - b),
    [predictions]
  );

  const visible = useMemo(
    () => (matchday == null ? predictions : predictions.filter((p) => p.matchday === matchday)),
    [predictions, matchday]
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, Prediction[]>();
    visible.forEach((p) => {
      const key = new Date(p.kickoff || p.date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      groups.set(key, [...(groups.get(key) || []), p]);
    });
    return Array.from(groups.entries());
  }, [visible]);

  const homeAdv = model?.home_advantage ? Math.round((model.home_advantage - 1) * 100) : null;

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="hero-kicker"><span className="live-dot" /> Premier League · {model?.seasons?.length ? `${model.seasons[model.seasons.length - 1]}/${String(model.seasons[model.seasons.length - 1] + 1).slice(-2)}` : 'Live'}</p>
        <h1>EPL Match Predictor</h1>
        <p className="hero-subtitle">
          Win probabilities and likeliest scorelines for every upcoming fixture, from a Dixon-Coles Poisson model
          retrained on live results.
        </p>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat-value">{model?.backtest ? `${Math.round(model.backtest.accuracy * 100)}%` : '—'}</span>
          <span className="stat-label">
            Backtest accuracy{model?.backtest ? ` on last ${model.backtest.matches} matches (home-win baseline ${Math.round(model.backtest.home_win_baseline * 100)}%)` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="stat-value">{model ? model.trained_on_matches.toLocaleString() : '—'}</span>
          <span className="stat-label">Matches in training data</span>
        </div>
        <div className="stat">
          <span className="stat-value">{homeAdv != null ? `+${homeAdv}%` : '—'}</span>
          <span className="stat-label">Home advantage (goals)</span>
        </div>
        <div className="stat">
          <span className="stat-value">{timeAgo(model?.updated_at ?? null)}</span>
          <span className="stat-label">Data last refreshed</span>
        </div>
      </section>

      {(status === 'loading' || status === 'waking') && (
        <div className="state-box">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>{status === 'loading' ? 'Loading predictions…' : 'Waking up the model server…'}</strong>
            {status === 'waking' && (
              <p>It runs on free hosting and sleeps when idle, so the first visit can take up to a minute.{attempt > 1 ? ` Retrying (${attempt}/${MAX_ATTEMPTS})…` : ''}</p>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="state-box error">
          <div>
            <strong>Predictions are unavailable right now.</strong>
            <p>{message}</p>
          </div>
          <button type="button" className="retry" onClick={() => load(1)}>Try again</button>
        </div>
      )}

      {status === 'ready' && (
        <section>
          <div className="section-head">
            <h2>Upcoming fixtures</h2>
            {matchdays.length > 0 && (
              <div className="tabs" role="tablist" aria-label="Matchday">
                {matchdays.map((md) => (
                  <button key={md} type="button" role="tab" aria-selected={md === matchday} className={md === matchday ? 'active' : ''} onClick={() => setMatchday(md)}>
                    MD {md}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="legend">
            <span><i className="home" /> Home win</span>
            <span><i className="draw" /> Draw</span>
            <span><i className="away" /> Away win</span>
            <span className="legend-note">Tap a match for xG, likeliest scores and goal markets</span>
          </div>

          {byDay.length === 0 && <p className="muted">No upcoming fixtures found.</p>}
          {byDay.map(([day, games]) => (
            <div key={day} className="day-group">
              <h3 className="day-title">{day}</h3>
              {games.map((g) => <MatchCard key={g.match_id ?? `${g.home}-${g.away}`} fixture={g} />)}
            </div>
          ))}
        </section>
      )}

      {results.length > 0 && (
        <section>
          <div className="section-head"><h2>Latest results</h2></div>
          <div className="results">
            {results.map((r, i) => (
              <div className="result" key={`${r.date}-${r.home_team}-${i}`}>
                <span className="result-date">{new Date(r.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                <span className="result-team right">{r.home_team.replace(/ FC$/, '')} <TeamBadge team={r.home_team} crestUrl={r.home_crest} compact /></span>
                <span className="result-score">{r.home_goals} – {r.away_goals}</span>
                <span className="result-team"><TeamBadge team={r.away_team} crestUrl={r.away_crest} compact /> {r.away_team.replace(/ FC$/, '')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="method">
        <h2>How it works</h2>
        <p>
          Results for the last {model?.seasons?.length ?? 4} seasons are pulled from the Football-Data.org API every few hours. Each team gets an
          attack and defence rating, adjusted for opponent strength and weighted toward recent matches (240-day half-life).
          Newly promoted teams start from a weaker prior until they build a record. Expected goals feed a Poisson score model
          with a Dixon-Coles correction for low-scoring draws, giving probabilities for every scoreline from 0–0 to 10–10.
          Accuracy is measured walk-forward: each backtested match is predicted using only data from before it was played.
        </p>
      </section>
    </main>
  );
}
