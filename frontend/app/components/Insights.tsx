'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { ModelInfo, Result, TableRow, TrackRecord } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';

function Calibration({ data }: { data: { bucket: string; predicted: number; observed: number; n: number }[] }) {
  const W = 380, H = 270, P = 48;
  const x = (v: number) => P + v * (W - P * 1.4);
  const y = (v: number) => H - P - v * (H - P * 1.6);
  const maxN = Math.max(...data.map((d) => d.n));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="calib" role="img" aria-label="Calibration chart">
      {[0, 0.25, 0.5, 0.75].map((g) => (
        <g key={g}>
          <line x1={x(0)} x2={x(0.8)} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" />
          <text x={P - 6} y={y(g) + 4} textAnchor="end">{g * 100}%</text>
          <text x={x(g)} y={H - P + 16} textAnchor="middle">{g * 100}%</text>
        </g>
      ))}
      <motion.line x1={x(0)} y1={y(0)} x2={x(0.8)} y2={y(0.8)} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
      <text x={x(0.62)} y={y(0.72)} className="calib-note">perfect calibration</text>
      <motion.polyline fill="none" stroke="var(--accent)" strokeWidth={2.5}
        points={data.map((d) => `${x(d.predicted)},${y(d.observed)}`).join(' ')}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.3 }} />
      {data.map((d, i) => (
        <motion.circle key={d.bucket} cx={x(d.predicted)} cy={y(d.observed)} r={4 + (d.n / maxN) * 7} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.1 }}>
          <title>{`${d.bucket}: predicted ${pct(d.predicted)}, happened ${pct(d.observed)} (${d.n} outcomes)`}</title>
        </motion.circle>
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" className="axis">Model probability</text>
      <text x={11} y={H / 2 - 10} textAnchor="middle" className="axis" transform={`rotate(-90 11 ${H / 2 - 10})`}>How often it happened</text>
    </svg>
  );
}

function Ratings({ table }: { table: TableRow[] }) {
  const W = 900, H = 500, P = 56;
  const atk = table.map((t) => t.attack), def = table.map((t) => t.defence);
  const [ax0, ax1] = [Math.min(...atk) * 0.92, Math.max(...atk) * 1.05];
  const [dy0, dy1] = [Math.min(...def) * 0.92, Math.max(...def) * 1.05];
  const x = (v: number) => P + ((v - ax0) / (ax1 - ax0)) * (W - P * 2);
  const y = (v: number) => P + ((v - dy0) / (dy1 - dy0)) * (H - P * 2); // low concede = top
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="ratings">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Team attack and defence ratings">
        <line x1={x(1)} x2={x(1)} y1={P / 2} y2={H - P / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
        <line y1={y(1)} y2={y(1)} x1={P / 2} x2={W - P / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
        <text x={W - P} y={P - 14} textAnchor="end" className="quad">Elite</text>
        <text x={P} y={P - 14} className="quad">Solid, blunt</text>
        <text x={W - P} y={H - 10} textAnchor="end" className="quad">Entertaining</text>
        <text x={P} y={H - 10} className="quad">In trouble</text>
        {table.map((t, i) => (
          <motion.g key={t.team} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.04, type: 'spring' }}
            onMouseEnter={() => setHover(t.team)} onMouseLeave={() => setHover(null)} style={{ transformOrigin: `${x(t.attack)}px ${y(t.defence)}px` }}>
            <circle cx={x(t.attack)} cy={y(t.defence)} r={15} fill="rgba(255,255,255,0.92)" />
            {t.crest && <image href={t.crest} x={x(t.attack) - 11} y={y(t.defence) - 11} width={22} height={22} />}
            {hover === t.team && (
              <g>
                <rect x={x(t.attack) + 18} y={y(t.defence) - 26} width={150} height={44} rx={8} fill="#0c111c" stroke="rgba(255,255,255,0.15)" />
                <text x={x(t.attack) + 28} y={y(t.defence) - 8} className="tip-b">{t.short}</text>
                <text x={x(t.attack) + 28} y={y(t.defence) + 9} className="tip">Attack {t.attack.toFixed(2)} · Def {t.defence.toFixed(2)}</text>
              </g>
            )}
          </motion.g>
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" className="axis">Attack rating → scores more</text>
        <text x={12} y={H / 2} textAnchor="middle" className="axis" transform={`rotate(-90 12 ${H / 2})`}>Concedes more ↓</text>
      </svg>
    </div>
  );
}

export default function Insights({ model, table, track, results }: { model: ModelInfo; table: TableRow[]; track: TrackRecord[]; results: Result[] }) {
  const bt = model.backtest;
  const hits = track.filter((t) => t.correct).length;
  return (
    <div className="insights">
      <div className="panel-head"><div><h2>How good is it?</h2><p>Every number below comes from a walk-forward backtest: each match is predicted using only data from before kick-off.</p></div></div>

      {bt && (
        <div className="bt-grid">
          <div className="glass bt-card">
            <span className="bt-l">Correct result</span>
            <div className="bt-bars">
              <div><span>This model</span><span className="bt-track"><motion.i className="acc" initial={{ width: 0 }} animate={{ width: pct(bt.accuracy) }} transition={{ duration: 1 }} /></span><b>{pct(bt.accuracy, 1)}</b></div>
              <div><span>Always pick home</span><span className="bt-track"><motion.i initial={{ width: 0 }} animate={{ width: pct(bt.home_win_baseline) }} transition={{ duration: 1, delay: 0.1 }} /></span><b>{pct(bt.home_win_baseline, 1)}</b></div>
              <div><span>Random guess</span><span className="bt-track"><motion.i initial={{ width: 0 }} animate={{ width: '33.3%' }} transition={{ duration: 1, delay: 0.2 }} /></span><b>33.3%</b></div>
            </div>
            <p className="bt-note">Over the last {bt.matches} matches. Bookmakers typically land around 50–53%; football is noisy.</p>
          </div>
          <div className="glass bt-card">
            <span className="bt-l">Calibration</span>
            <Calibration data={bt.calibration} />
            <p className="bt-note">When the model says 30%, it happens about 30% of the time. Log loss {bt.log_loss} vs {bt.uniform_log_loss} for guessing.</p>
          </div>
        </div>
      )}

      <div className="glass card-pad">
        <div className="sub-head"><h3>Recent calls</h3><span className="pill">{hits}/{track.length} correct</span></div>
        <div className="track">
          {track.slice(0, 16).map((t, i) => (
            <motion.div key={`${t.date}-${t.home}`} className={`tk ${t.correct ? 'ok' : 'no'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <span className="tk-mark">{t.correct ? '✓' : '✗'}</span>
              <span className="tk-teams"><Crest src={t.home_crest} name={t.home} size={20} />{t.home_short}<b>{t.score.replace('-', '–')}</b>{t.away_short}<Crest src={t.away_crest} name={t.away} size={20} /></span>
              <span className="tk-pick">Called {t.pick === 'H' ? 'home' : t.pick === 'A' ? 'away' : 'draw'} · {pct(t.probs[t.pick])}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="glass card-pad">
        <div className="sub-head"><h3>Team ratings</h3><span className="muted small">Hover a crest</span></div>
        <Ratings table={table} />
      </div>

      <div className="glass card-pad">
        <div className="sub-head"><h3>Latest results</h3></div>
        <div className="results">
          {results.map((r) => (
            <div key={`${r.date}-${r.home}`} className="res">
              <span className="muted small">{new Date(r.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
              <span className="res-t r">{r.home_short}<Crest src={r.home_crest} name={r.home} size={22} /></span>
              <b className="res-s">{r.score.replace('-', ' – ')}</b>
              <span className="res-t"><Crest src={r.away_crest} name={r.away} size={22} />{r.away_short}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass card-pad method">
        <h3>The model</h3>
        <ol>
          <li><b>Live data.</b> {model.seasons.length} seasons of results ({model.trained_on_matches.toLocaleString()} matches) pulled from Football-Data.org and refreshed every 3 hours.</li>
          <li><b>Team ratings.</b> Each side gets attack and defence strengths, adjusted for the quality of opponents faced and weighted toward recent games (240-day half-life). Promoted teams start from a weaker prior.</li>
          <li><b>Scorelines.</b> Ratings plus a data-driven home advantage give expected goals, which feed a Poisson model with a Dixon-Coles correction so 0–0 and 1–1 draws aren't underrated.</li>
          <li><b>Calling the result.</b> The pick is the likeliest outcome, but a draw is called whenever it&apos;s within 5 points of the favourite, because draws are rarely the single likeliest result even at 30%. Matches with a 30%+ draw chance get a draw alert.</li>
          <li><b>Season.</b> The rest of the season is simulated {model.simulations.toLocaleString()} times to produce title, top-four and relegation odds.</li>
          <li><b>Tuning.</b> Recency, shrinkage and draw correction were chosen by minimising log loss on a 300-match walk-forward backtest.</li>
        </ol>
      </div>
    </div>
  );
}
