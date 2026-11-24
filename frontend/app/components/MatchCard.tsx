'use client';

import { useState } from 'react';
import TeamBadge from './TeamBadge';

export interface FormEntry {
  result: 'W' | 'D' | 'L';
  score: string;
  opponent: string;
  home: boolean;
  date: string;
}

export interface Prediction {
  match_id?: number;
  matchday?: number | null;
  kickoff?: string;
  date: string;
  home: string;
  away: string;
  home_short?: string;
  away_short?: string;
  home_crest?: string;
  away_crest?: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  expected_home_goals: number;
  expected_away_goals: number;
  predicted: 'Home Win' | 'Draw' | 'Away Win';
  predicted_score: string;
  top_scores?: { score: string; prob: number }[];
  both_teams_score_prob?: number;
  over_2_5_prob?: number;
  home_form?: FormEntry[];
  away_form?: FormEntry[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Form({ form, align }: { form?: FormEntry[]; align: 'left' | 'right' }) {
  if (!form?.length) return null;
  const items = align === 'right' ? [...form].reverse() : form;
  return (
    <span className={`form-row ${align}`} aria-label="Last five results">
      {items.map((f, i) => (
        <span key={i} className={`form-chip ${f.result}`} title={`${f.result} ${f.score} ${f.home ? 'vs' : '@'} ${f.opponent} (${f.date})`}>
          {f.result}
        </span>
      ))}
    </span>
  );
}

export default function MatchCard({ fixture }: { fixture: Prediction }) {
  const [open, setOpen] = useState(false);
  const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : new Date(fixture.date);
  const time = kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const { home_win_prob: h, draw_prob: d, away_win_prob: a } = fixture;
  const favourite = fixture.predicted;
  const confidence = Math.max(h, d, a);
  const strength = confidence >= 0.6 ? 'Strong' : confidence >= 0.45 ? 'Lean' : 'Toss-up';

  return (
    <article className={`match ${open ? 'open' : ''}`}>
      <button type="button" className="match-main" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="match-time">{time}</span>

        <span className={`side home ${favourite === 'Home Win' ? 'fav' : ''}`}>
          <span className="side-name">
            <span className="team-name">{fixture.home_short || fixture.home}</span>
            <Form form={fixture.home_form} align="right" />
          </span>
          <TeamBadge team={fixture.home} crestUrl={fixture.home_crest} />
        </span>

        <span className="scoreline">
          <span className="score">{fixture.predicted_score.replace('-', ' – ')}</span>
          <span className={`verdict ${strength.toLowerCase().replace('-', '')}`}>{strength}</span>
        </span>

        <span className={`side away ${favourite === 'Away Win' ? 'fav' : ''}`}>
          <TeamBadge team={fixture.away} crestUrl={fixture.away_crest} />
          <span className="side-name">
            <span className="team-name">{fixture.away_short || fixture.away}</span>
            <Form form={fixture.away_form} align="left" />
          </span>
        </span>

        <span className="chevron" aria-hidden="true">⌄</span>
      </button>

      <div className="prob-bar" role="img" aria-label={`Home ${pct(h)}, draw ${pct(d)}, away ${pct(a)}`}>
        <span className="seg home" style={{ flexGrow: h }}>{h >= 0.12 ? pct(h) : ''}</span>
        <span className="seg draw" style={{ flexGrow: d }}>{d >= 0.12 ? pct(d) : ''}</span>
        <span className="seg away" style={{ flexGrow: a }}>{a >= 0.12 ? pct(a) : ''}</span>
      </div>

      {open && (
        <div className="match-details">
          <div className="detail">
            <span className="detail-label">Expected goals</span>
            <span className="detail-value">{fixture.expected_home_goals.toFixed(2)} – {fixture.expected_away_goals.toFixed(2)}</span>
          </div>
          {fixture.top_scores && (
            <div className="detail">
              <span className="detail-label">Likeliest scores</span>
              <span className="detail-value">
                {fixture.top_scores.map((s) => `${s.score} (${pct(s.prob)})`).join(' · ')}
              </span>
            </div>
          )}
          {fixture.both_teams_score_prob !== undefined && (
            <div className="detail">
              <span className="detail-label">Both teams score</span>
              <span className="detail-value">{pct(fixture.both_teams_score_prob)}</span>
            </div>
          )}
          {fixture.over_2_5_prob !== undefined && (
            <div className="detail">
              <span className="detail-label">Over 2.5 goals</span>
              <span className="detail-value">{pct(fixture.over_2_5_prob)}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
