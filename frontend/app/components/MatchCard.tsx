'use client';

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

  const formatProbability = (prob: number | undefined) => {
    if (prob === undefined) return 'N/A';
    return `${(prob * 100).toFixed(1)}%`;
  };

  return (
    <div className="match-card">
      <div className="match-header">
        <div className="teams">
          <span className="team">{fixture.home}</span>
          <span className="vs">vs</span>
          <span className="team">{fixture.away}</span>
        </div>
        <div className="match-date">
          {formatDate(fixture.date)}
          {fixture.time && ` • ${fixture.time}`}
        </div>
      </div>

      {fixture.predicted && (
        <div className="prediction">
          <div className="prediction-label">Prediction Probabilities:</div>
          <div className="probabilities">
            <div className="prob-item">
              <div className="prob-label">Home Win</div>
              <div className="prob-value">
                {formatProbability(fixture.home_win_prob)}
              </div>
            </div>
            <div className="prob-item">
              <div className="prob-label">Draw</div>
              <div className="prob-value">
                {formatProbability(fixture.draw_prob)}
              </div>
            </div>
            <div className="prob-item">
              <div className="prob-label">Away Win</div>
              <div className="prob-value">
                {formatProbability(fixture.away_win_prob)}
              </div>
            </div>
          </div>
          <div className="predicted-outcome">
            Predicted: {fixture.predicted}
          </div>
        </div>
      )}
    </div>
  );
}

