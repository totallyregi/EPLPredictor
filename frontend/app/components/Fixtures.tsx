'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEntry, Prediction } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';
import { FormChips, ProbBar, ScoreHeatmap } from './Viz';

function verdict(p: Prediction) {
  const c = Math.max(p.home_win_prob, p.draw_prob, p.away_win_prob);
  return c >= 0.6 ? 'strong' : c >= 0.45 ? 'lean' : 'tossup';
}

function MatchRow({ m, form, open, onToggle, index }: { m: Prediction; form: Record<string, FormEntry[]>; open: boolean; onToggle: () => void; index: number }) {
  const v = verdict(m);
  const t = new Date(m.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.article
      layout
      id={`m-${m.match_id}`}
      className={`row glass ${open ? 'open' : ''}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className="row-main" onClick={onToggle} aria-expanded={open}>
        <span className="row-time">{t}</span>
        <span className={`side h ${m.predicted === 'Home Win' ? 'fav' : ''}`}>
          <span className="side-txt"><span className="tname">{m.home_short}</span><FormChips form={form[m.home]} reverse /></span>
          <Crest src={m.home_crest} name={m.home} size={38} />
        </span>
        <span className="mid">
          <span className="pscore">{m.predicted_score.replace('-', ' – ')}</span>
          <span className={`tag ${v}`}>{v === 'strong' ? 'Strong pick' : v === 'lean' ? 'Lean' : 'Toss-up'}</span>
        </span>
        <span className={`side a ${m.predicted === 'Away Win' ? 'fav' : ''}`}>
          <Crest src={m.away_crest} name={m.away} size={38} />
          <span className="side-txt"><span className="tname">{m.away_short}</span><FormChips form={form[m.away]} /></span>
        </span>
        <motion.span className="caret" animate={{ rotate: open ? 180 : 0 }}>⌄</motion.span>
      </button>
      <div className="row-bar"><ProbBar h={m.home_win_prob} d={m.draw_prob} a={m.away_win_prob} /></div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="row-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <div className="detail-grid">
              <ScoreHeatmap matrix={m.score_matrix} homeLabel={m.home_short} awayLabel={m.away_short} highlight={m.predicted_score} />
              <div className="markets">
                <div className="mk"><span>Expected goals</span><b>{m.expected_home_goals.toFixed(2)} – {m.expected_away_goals.toFixed(2)}</b></div>
                <div className="mk"><span>Likeliest scores</span><b>{m.top_scores.map((s) => `${s.score} ${pct(s.prob)}`).join('  ·  ')}</b></div>
                <div className="mk"><span>Both teams score</span><b>{pct(m.both_teams_score_prob)}</b><i style={{ width: pct(m.both_teams_score_prob) }} /></div>
                <div className="mk"><span>Over 2.5 goals</span><b>{pct(m.over_2_5_prob)}</b><i style={{ width: pct(m.over_2_5_prob) }} /></div>
                <div className="mk"><span>Win · Draw · Win</span><b>{pct(m.home_win_prob, 1)} · {pct(m.draw_prob, 1)} · {pct(m.away_win_prob, 1)}</b></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function Fixtures({ predictions, form, focusId }: { predictions: Prediction[]; form: Record<string, FormEntry[]>; focusId?: number | null }) {
  const matchdays = useMemo(() => Array.from(new Set(predictions.map((p) => p.matchday).filter((x): x is number => x != null))).sort((a, b) => a - b), [predictions]);
  const [md, setMd] = useState<number | null>(matchdays[0] ?? null);
  const [openId, setOpenId] = useState<number | string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId == null) return;
    const target = predictions.find((p) => p.match_id === focusId);
    if (!target) return;
    setMd(target.matchday ?? null);
    setOpenId(focusId);
    setTimeout(() => document.getElementById(`m-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  }, [focusId, predictions]);

  const groups = useMemo(() => {
    const list = predictions.filter((p) => md == null || p.matchday === md);
    const map = new Map<string, Prediction[]>();
    list.forEach((p) => {
      const k = new Date(p.kickoff).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      map.set(k, [...(map.get(k) || []), p]);
    });
    return Array.from(map.entries());
  }, [predictions, md]);

  const nudge = (dir: number) => scroller.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  let idx = 0;

  return (
    <div>
      <div className="md-bar">
        <button type="button" className="md-arrow" onClick={() => nudge(-1)} aria-label="Earlier matchdays">‹</button>
        <div className="md-scroll" ref={scroller}>
          {matchdays.map((d) => (
            <button key={d} type="button" className={`md ${d === md ? 'on' : ''}`} onClick={() => { setMd(d); setOpenId(null); }}>
              {d === md && <motion.span layoutId="md-pill" className="md-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="md-txt">MD {d}</span>
            </button>
          ))}
        </div>
        <button type="button" className="md-arrow" onClick={() => nudge(1)} aria-label="Later matchdays">›</button>
      </div>

      <div className="legend">
        <span><i className="home" />Home win</span><span><i className="draw" />Draw</span><span><i className="away" />Away win</span>
        <span className="legend-tip">Tap any match for the full scoreline heatmap</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={md ?? 'all'} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
          {groups.map(([day, games]) => (
            <div key={day} className="day">
              <h3>{day}</h3>
              {games.map((g) => {
                const id = g.match_id ?? `${g.home}-${g.away}`;
                return <MatchRow key={id} m={g} form={form} index={idx++} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)} />;
              })}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
