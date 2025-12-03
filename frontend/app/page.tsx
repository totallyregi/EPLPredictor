'use client';

import { useEffect, useState } from 'react';
import MatchCard from './components/MatchCard';

interface Fixture {
  date: string;
  home: string;
  away: string;
  time?: string;
  home_win_prob?: number;
  draw_prob?: number;
  away_win_prob?: number;
  predicted?: string;
}

export default function Home() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        setLoading(true);
        const response = await fetch('/api/predictions');
        if (!response.ok) {
          throw new Error('Failed to fetch predictions');
        }
        const data = await response.json();
        setFixtures(data.predictions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Premier League Match Predictor</h1>
        <p>AI-powered predictions for upcoming fixtures</p>
      </div>

      {loading && <div className="loading">Loading predictions...</div>}
      
      {error && <div className="error">Error: {error}</div>}

      {!loading && !error && fixtures.length === 0 && (
        <div className="loading">No fixtures available</div>
      )}

      {!loading && !error && fixtures.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Upcoming Fixtures</h2>
          {fixtures.map((fixture, index) => (
            <MatchCard key={index} fixture={fixture} />
          ))}
        </div>
      )}
    </div>
  );
}

