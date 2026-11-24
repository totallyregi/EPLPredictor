'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { FormEntry, ModelInfo, Prediction, TableRow } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';
import { CountUp, FormChips, ProbRing } from './Viz';

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
  return { d, h, m, s, live: diff === 0 };
}

/** Pick the marquee fixture of the next matchday: the two strongest sides by projected finish. */
export function pickFeatured(predictions: Prediction[], table: TableRow[]) {
  if (!predictions.length) return null;
  const md = predictions[0].matchday;
  const pos = new Map(table.map((t) => [t.team, t.projected_position]));
  const pool = predictions.filter((p) => p.matchday === md);
  return [...pool].sort((x, y) => ((pos.get(x.home) ?? 20) + (pos.get(x.away) ?? 20)) - ((pos.get(y.home) ?? 20) + (pos.get(y.away) ?? 20)))[0];
}

export default function Hero({ match, model, form, onOpen }: { match: Prediction; model: ModelInfo; form: Record<string, FormEntry[]>; onOpen: () => void }) {
  const cd = useCountdown(match.kickoff);
  const kickoff = new Date(match.kickoff);
  const bt = model.backtest;
  const fav = match.predicted;
  return (
    <section className="hero">
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        <p className="eyebrow"><span className="pulse" /> Live model · {model.trained_on_matches.toLocaleString()} matches · {model.simulations.toLocaleString()} season sims</p>
        <h1>Every Premier League match, <span className="grad">predicted.</span></h1>
        <p className="lede">Scorelines, win probabilities and the title race, from a Dixon-Coles model retrained on real results every few hours.</p>
      </motion.div>

      <motion.button
        type="button"
        className="feature glass"
        onClick={onOpen}
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -4 }}
      >
        <div className="feature-top">
          <span className="chip">Match of the week · MD {match.matchday}</span>
          <span className="countdown">
            {cd.live ? 'Kick-off!' : (<>{cd.d > 0 && <b>{cd.d}<i>d</i></b>}<b>{String(cd.h).padStart(2, '0')}<i>h</i></b><b>{String(cd.m).padStart(2, '0')}<i>m</i></b><b>{String(cd.s).padStart(2, '0')}<i>s</i></b></>)}
          </span>
        </div>
        <div className="feature-body">
          <div className={`ft-team ${fav === 'Home Win' ? 'fav' : ''}`}>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
              <Crest src={match.home_crest} name={match.home} size={88} className="glow-crest" />
            </motion.div>
            <strong>{match.home_short}</strong>
            <FormChips form={form[match.home]} />
            <span className="ft-prob home">{pct(match.home_win_prob)}</span>
          </div>
          <ProbRing
            h={match.home_win_prob} d={match.draw_prob} a={match.away_win_prob} size={190}
            label={<><span className="ring-score">{match.predicted_score.replace('-', '–')}</span><span className="ring-sub">predicted</span><span className="ring-draw">Draw {pct(match.draw_prob)}</span></>}
          />
          <div className={`ft-team ${fav === 'Away Win' ? 'fav' : ''}`}>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, delay: 2, repeat: Infinity, ease: 'easeInOut' }}>
              <Crest src={match.away_crest} name={match.away} size={88} className="glow-crest" />
            </motion.div>
            <strong>{match.away_short}</strong>
            <FormChips form={form[match.away]} />
            <span className="ft-prob away">{pct(match.away_win_prob)}</span>
          </div>
        </div>
        <div className="feature-foot">
          <span>{kickoff.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · {kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>xG {match.expected_home_goals.toFixed(2)} – {match.expected_away_goals.toFixed(2)}</span>
          <span className="feature-cta">See scoreline odds →</span>
        </div>
      </motion.button>

      <div className="kpis">
        {[
          { v: bt ? bt.accuracy * 100 : 0, s: '%', d: 1, l: `Correct result, last ${bt?.matches ?? 0} games`, sub: bt ? `vs ${pct(bt.home_win_baseline)} always-home baseline` : '' },
          { v: bt ? bt.exact_score_rate * 100 : 0, s: '%', d: 1, l: 'Exact scores nailed', sub: 'walk-forward backtest' },
          { v: model.home_advantage ? (model.home_advantage - 1) * 100 : 0, s: '%', d: 0, p: '+', l: 'Home advantage', sub: 'extra goals at home' },
          { v: model.avg_goals_per_match ?? 0, s: '', d: 2, l: 'Goals per match', sub: 'recency weighted' },
        ].map((k, i) => (
          <motion.div key={i} className="kpi glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.08 }}>
            <span className="kpi-v"><CountUp value={k.v} decimals={k.d} suffix={k.s} prefix={k.p} /></span>
            <span className="kpi-l">{k.l}</span>
            <span className="kpi-s">{k.sub}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
