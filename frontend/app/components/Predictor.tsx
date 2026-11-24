'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Prediction } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';
import { ProbRing, ScoreHeatmap } from './Viz';

type Team = { team: string; short: string; crest?: string };

export default function Predictor({ teams }: { teams: Team[] }) {
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!home || !away) { setResult(null); return; }
    let cancelled = false;
    setLoading(true); setError('');
    fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ home_team: home.team, away_team: away.team }) })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Prediction failed'); return d; })
      .then((d) => { if (!cancelled) setResult({ ...d, home_short: home.short, away_short: away.short }); })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [home, away]);

  function pick(t: Team) {
    if (home?.team === t.team) { setHome(null); return; }
    if (away?.team === t.team) { setAway(null); return; }
    if (!home) setHome(t);
    else if (!away) setAway(t);
    else { setAway(t); }
  }

  return (
    <div>
      <div className="panel-head">
        <div>
          <h2>Head-to-head predictor</h2>
          <p>Pick a home side, then an away side. Any pairing, any time.</p>
        </div>
        {(home || away) && <button type="button" className="ghost" onClick={() => { setHome(null); setAway(null); }}>Reset</button>}
      </div>

      <div className="slots">
        {[{ t: home, l: 'Home' }, { t: away, l: 'Away' }].map(({ t, l }, i) => (
          <motion.div key={l} className={`slot glass ${t ? 'filled' : ''} ${!t && (i === 0 ? true : !!home) ? 'next' : ''}`} layout>
            <AnimatePresence mode="wait">
              {t ? (
                <motion.div key={t.team} className="slot-in" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                  <Crest src={t.crest} name={t.team} size={64} className="glow-crest" /><b>{t.short}</b>
                </motion.div>
              ) : (
                <motion.span key="empty" className="slot-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Choose {l.toLowerCase()} team</motion.span>
              )}
            </AnimatePresence>
            <span className="slot-label">{l}</span>
          </motion.div>
        ))}
      </div>

      <div className="team-grid">
        {teams.map((t, i) => {
          const sel = home?.team === t.team ? 'home' : away?.team === t.team ? 'away' : '';
          return (
            <motion.button key={t.team} type="button" className={`tpick ${sel}`} onClick={() => pick(t)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
              <Crest src={t.crest} name={t.team} size={34} />
              <span>{t.short}</span>
              {sel && <i>{sel === 'home' ? 'H' : 'A'}</i>}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {(loading || error || result) && home && away && (
          <motion.div className="h2h glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            {loading && <div className="h2h-loading"><span className="spinner" /> Crunching {home.short} vs {away.short}…</div>}
            {error && !loading && <p className="err">{error}</p>}
            {result && !loading && (
              <div className="h2h-body">
                <div className="h2h-ring">
                  <ProbRing h={result.home_win_prob} d={result.draw_prob} a={result.away_win_prob} size={210}
                    label={<><span className="ring-score">{result.predicted_score.replace('-', '–')}</span><span className="ring-sub">most likely {result.predicted === 'Draw' ? 'draw' : 'win'} score</span></>} />
                  <div className="h2h-probs">
                    <span className="home">{home.short} {pct(result.home_win_prob)}</span>
                    <span className="draw">Draw {pct(result.draw_prob)}</span>
                    <span className="away">{away.short} {pct(result.away_win_prob)}</span>
                  </div>
                </div>
                <div>
                  <ScoreHeatmap matrix={result.score_matrix} homeLabel={home.short} awayLabel={away.short} highlight={result.predicted_score} />
                  <div className="h2h-stats">
                    <span>xG <b>{result.expected_home_goals.toFixed(2)} – {result.expected_away_goals.toFixed(2)}</b></span>
                    <span>BTTS <b>{pct(result.both_teams_score_prob)}</b></span>
                    <span>Over 2.5 <b>{pct(result.over_2_5_prob)}</b></span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
