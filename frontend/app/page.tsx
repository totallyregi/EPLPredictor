'use client';

import { useEffect, useState } from 'react';
import MatchCard from './components/MatchCard';

interface Fixture {
  date: string;
  home: string;
  away: string;
  home_crest?: string;
  away_crest?: string;
  time?: string;
  home_win_prob?: number;
  draw_prob?: number;
  away_win_prob?: number;
  predicted?: string;
  predicted_score?: string;
  expected_home_goals?: number;
  expected_away_goals?: number;
  prediction_source?: string;
}

interface HistoryMatch {
  date: string;
  season: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  result: string;
}

export default function Home() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [predictionsResponse, historyResponse] = await Promise.all([
          fetch('/api/predictions', { cache: 'no-store' }),
          fetch('/api/history?years=5', { cache: 'no-store' })
        ]);

        if (!predictionsResponse.ok) {
          throw new Error('Failed to load predictions');
        }

        const predictionData = await predictionsResponse.json();
        const historyData = historyResponse.ok ? await historyResponse.json() : { history: [] };

        const sortedFixtures = (predictionData.predictions || []).sort(
          (a: Fixture, b: Fixture) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        setFixtures(sortedFixtures);
        setHistory((historyData.history || []).slice(0, 12));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const predictedHomeWins = fixtures.filter((fixture) => fixture.predicted === 'Home Win').length;
  const predictedDraws = fixtures.filter((fixture) => fixture.predicted === 'Draw').length;
  const predictedAwayWins = fixtures.filter((fixture) => fixture.predicted === 'Away Win').length;

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="hero-kicker">EPL Forecast Desk</p>
          <h1>Premier League Match Predictor</h1>
          <p className="hero-subtitle">Professional match forecasts with winner probabilities and expected scorelines.</p>
        </div>
        <button
          type="button"
          className="refresh-button"
          onClick={() => window.location.reload()}
        >
          Refresh Data
        </button>
      </section>

      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-label">Upcoming Fixtures</p>
          <p className="summary-value">{fixtures.length}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Predicted Home Wins</p>
          <p className="summary-value">{predictedHomeWins}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Predicted Draws</p>
          <p className="summary-value">{predictedDraws}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Predicted Away Wins</p>
          <p className="summary-value">{predictedAwayWins}</p>
        </div>
      </section>

      {loading && <div className="loading">Loading predictions...</div>}

      {error && <div className="error">Error: {error}</div>}

      {!loading && !error && fixtures.length === 0 && (
        <div className="empty-state">
          <h2>No fixtures available</h2>
          <p>Try refreshing the dashboard or checking backend API connectivity.</p>
        </div>
      )}

      {!loading && !error && fixtures.length > 0 && (
        <section className="section-block">
          <div className="section-header">
            <h2>Season Fixture Predictions</h2>
            <p>Winner probabilities and score projections for remaining EPL matches.</p>
          </div>
          {fixtures.map((fixture, index) => (
            <MatchCard key={index} fixture={fixture} />
          ))}
        </section>
      )}

      <section className="section-block">
        <div className="section-header">
          <h2>Historical Matches (5 Years)</h2>
          <p>Latest records from the training data used by the prediction service.</p>
        </div>
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Season</th>
                <th>Fixture</th>
                <th>Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="history-empty">
                    No historical data available yet.
                  </td>
                </tr>
              )}
              {history.map((row, index) => (
                <tr key={`${row.date}-${row.home_team}-${index}`}>
                  <td>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                  <td>{row.season}</td>
                  <td>{row.home_team} vs {row.away_team}</td>
                  <td>{row.home_goals}-{row.away_goals}</td>
                  <td>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

