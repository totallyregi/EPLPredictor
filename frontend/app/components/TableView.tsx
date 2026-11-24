'use client';

import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { TableRow } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';

function Heat({ v, tone }: { v: number; tone: 'title' | 'top4' | 'rel' }) {
  const rgb = tone === 'rel' ? '255,107,107' : tone === 'title' ? '245,196,81' : '61,220,151';
  const label = v === 0 ? '–' : v < 0.001 ? '<0.1%' : v > 0.999 ? '>99.9%' : pct(v, v < 0.1 ? 1 : 0);
  return <span className="heat" style={{ background: `rgba(${rgb},${v === 0 ? 0 : 0.1 + v * 0.75})`, color: v > 0.55 ? '#05070c' : undefined }}>{label}</span>;
}

export default function TableView({ table, sims }: { table: TableRow[]; sims: number }) {
  const [mode, setMode] = useState<'projected' | 'current'>('projected');
  const rows = useMemo(() => {
    const r = [...table];
    if (mode === 'current') r.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    return r;
  }, [table, mode]);
  const maxPts = Math.max(...table.map((t) => t.projected_points));

  return (
    <div>
      <div className="panel-head">
        <div>
          <h2>Season projection</h2>
          <p>{sims.toLocaleString()} simulations of every remaining fixture, each scoreline drawn from the model.</p>
        </div>
        <div className="seg">
          {(['projected', 'current'] as const).map((m) => (
            <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {mode === m && <motion.span layoutId="tbl-seg" className="seg-pill" />}
              <span>{m === 'projected' ? 'Projected finish' : 'Current table'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="table glass">
        <div className="tr th">
          <span>#</span><span>Team</span><span className="c">P</span><span className="c">GD</span><span className="c">Pts</span>
          <span className="proj-col">Projected pts</span><span className="c">Title</span><span className="c">Top 4</span><span className="c">Relegated</span>
        </div>
        {rows.map((t, i) => (
          <motion.div
            layout
            key={t.team}
            className={`tr ${i < 4 ? 'ucl' : ''} ${i >= rows.length - 3 ? 'rel' : ''}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, delay: i * 0.025 }}
          >
            <span className="pos">{i + 1}</span>
            <span className="team"><Crest src={t.crest} name={t.team} size={24} /><b>{t.short}</b></span>
            <span className="c muted">{t.played}</span>
            <span className={`c ${t.gd > 0 ? 'pos-gd' : t.gd < 0 ? 'neg-gd' : 'muted'}`}>{t.gd > 0 ? `+${t.gd}` : t.gd}</span>
            <span className="c strong">{t.points}</span>
            <span className="proj-col">
              <span className="proj-track"><motion.span className="proj-fill" initial={{ width: 0 }} animate={{ width: `${(t.projected_points / maxPts) * 100}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.03 }} /></span>
              <b>{t.projected_points.toFixed(0)}</b>
            </span>
            <span className="c"><Heat v={t.title} tone="title" /></span>
            <span className="c"><Heat v={t.top4} tone="top4" /></span>
            <span className="c"><Heat v={t.relegation} tone="rel" /></span>
          </motion.div>
        ))}
      </div>
      <p className="footnote">Green stripe: Champions League places. Red stripe: relegation zone. Tiebreakers: points, goal difference, goals scored.</p>
    </div>
  );
}
