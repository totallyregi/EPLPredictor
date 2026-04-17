'use client';

import TeamBadge from './TeamBadge';

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
  match_odds?: {
    home_win: number;
    draw: number;
    away_win: number;
  };
}

interface MatchCardProps {
  fixture: Fixture;
}

export default function MatchCard({ fixture }: MatchCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const homeWin = fixture.match_odds?.home_win ?? fixture.home_win_prob ?? 0;
  const draw = fixture.match_odds?.draw ?? fixture.draw_prob ?? 0;
  const awayWin = fixture.match_odds?.away_win ?? fixture.away_win_prob ?? 0;

  const probabilityRows = [
    { label: fixture.home, value: homeWin, tone: 'home', team: fixture.home, crest: fixture.home_crest },
    { label: 'Draw', value: draw, tone: 'draw' },
    { label: fixture.away, value: awayWin, tone: 'away', team: fixture.away, crest: fixture.away_crest }
  ];

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const confidence = Math.max(homeWin, draw, awayWin);
  const predictedScore = fixture.predicted_score || 'N/A';

  const expectedGoals =
    fixture.expected_home_goals !== undefined && fixture.expected_away_goals !== undefined
      ? `${fixture.expected_home_goals.toFixed(2)} - ${fixture.expected_away_goals.toFixed(2)} xG`
      : 'N/A';

  const predictionLabel = fixture.predicted || 'Prediction unavailable';
  const predictionSubtitle =
    fixture.prediction_source === 'fallback'
      ? 'Estimated from fallback model'
      : 'Generated from backend model';

  return (
    <article className="match-card">
      <div className="match-card-top">
        <div>
          <div className="match-teams">
            <span className="match-team-with-badge">
              <TeamBadge team={fixture.home} crestUrl={fixture.home_crest} />
              <span>{fixture.home}</span>
            </span>
            <span className="match-vs">vs</span>
            <span className="match-team-with-badge">
              <TeamBadge team={fixture.away} crestUrl={fixture.away_crest} />
              <span>{fixture.away}</span>
            </span>
          </div>
          <p className="match-meta">
            {formatDate(fixture.date)}
            {fixture.time ? ` • ${fixture.time}` : ''}
          </p>
        </div>
        <div className="prediction-pill">
          <span className="prediction-pill-label">{predictionLabel}</span>
          <span className="prediction-pill-confidence">{formatPercent(confidence)} confidence</span>
        </div>
      </div>

      <div className="score-strip">
        <div className="score-item">
          <p className="score-item-label">Predicted Score</p>
          <p className="score-item-value">{predictedScore}</p>
        </div>
        <div className="score-item">
          <p className="score-item-label">Expected Goals</p>
          <p className="score-item-value">{expectedGoals}</p>
        </div>
        <div className="score-item">
          <p className="score-item-label">Model Source</p>
          <p className="score-item-value">{predictionSubtitle}</p>
        </div>
      </div>

      <div className="probability-block">
        {probabilityRows.map((row) => (
          <div className="probability-row" key={row.label}>
            <div className="probability-row-head">
              <span className="probability-row-label">
                {'team' in row && row.team ? <TeamBadge team={row.team} crestUrl={'crest' in row ? row.crest : undefined} compact /> : null}
                <span>{row.label}</span>
              </span>
              <span className="probability-row-value">{formatPercent(row.value)}</span>
            </div>
            <div className="probability-track">
              <div
                className={`probability-fill ${row.tone}`}
                style={{ width: `${Math.max(0, Math.min(100, row.value * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

