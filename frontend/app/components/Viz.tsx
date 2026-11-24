'use client';

import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { Fragment, useEffect, useRef } from 'react';
import type { FormEntry } from '../lib/types';
import { pct } from '../lib/types';

/** Three-arc donut: home / draw / away. */
export function ProbRing({ h, d, a, size = 180, stroke = 14, label }: { h: number; d: number; a: number; size?: number; stroke?: number; label?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 0.012;
  const segs = [
    { v: h, color: 'var(--home)', start: 0 },
    { v: d, color: 'var(--draw)', start: h },
    { v: a, color: 'var(--away)', start: h + d },
  ];
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {segs.map((s, i) => (
          <motion.circle
            key={i}
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round"
            transform={`rotate(${s.start * 360 - 90} ${size / 2} ${size / 2})`}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${Math.max(0, s.v - gap) * c} ${c}` }}
            transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>
      <div className="ring-label">{label}</div>
    </div>
  );
}

/** Segmented home/draw/away bar that grows in when visible. */
export function ProbBar({ h, d, a, thin = false }: { h: number; d: number; a: number; thin?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const segs: [string, number][] = [['home', h], ['draw', d], ['away', a]];
  return (
    <div ref={ref} className={`pbar ${thin ? 'thin' : ''}`} role="img" aria-label={`Home ${pct(h)}, draw ${pct(d)}, away ${pct(a)}`}>
      {segs.map(([k, v], i) => (
        <motion.span
          key={k}
          className={`pseg ${k}`}
          initial={{ flexGrow: 0.0001 }}
          animate={inView ? { flexGrow: v } : {}}
          transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          {!thin && v >= 0.13 ? pct(v) : ''}
        </motion.span>
      ))}
    </div>
  );
}

/** 6x6 scoreline probability grid. */
export function ScoreHeatmap({ matrix, homeLabel, awayLabel, highlight }: { matrix: number[][]; homeLabel: string; awayLabel: string; highlight?: string }) {
  const max = Math.max(...matrix.flat());
  return (
    <div className="heatmap">
      <div className="heatmap-axis-x">{awayLabel} goals →</div>
      <div className="heatmap-axis-y">{homeLabel} goals →</div>
      <div className="heatmap-grid">
        <span />
        {matrix[0].map((_, j) => <span key={`c${j}`} className="hm-head">{j}</span>)}
        {matrix.map((row, i) => (
          <Fragment key={`row${i}`}>
            <span className="hm-head">{i}</span>
            {row.map((v, j) => {
              const t = v / max;
              const key = `${i}-${j}`;
              const tone = i > j ? '61,220,151' : i === j ? '245,196,81' : '91,140,255';
              return (
                <motion.span
                  key={key}
                  className={`hm-cell ${highlight === key ? 'hl' : ''}`}
                  style={{ background: `rgba(${tone},${0.08 + t * 0.85})`, color: t > 0.55 ? '#05070c' : 'var(--text)' }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i + j) * 0.025, duration: 0.3 }}
                  title={`${i}-${j}: ${pct(v, 1)}`}
                >
                  {v >= 0.005 ? (v * 100).toFixed(v >= 0.1 ? 0 : 1) : ''}
                </motion.span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function CountUp({ value, decimals = 0, suffix = '', prefix = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

export function FormChips({ form, reverse = false }: { form?: FormEntry[]; reverse?: boolean }) {
  if (!form?.length) return null;
  const items = reverse ? [...form].reverse() : form;
  return (
    <span className="form">
      {items.map((f, i) => (
        <span key={i} className={`fc ${f.result}`} title={`${f.result} ${f.score} ${f.home ? 'vs' : '@'} ${f.opponent}`}>{f.result}</span>
      ))}
    </span>
  );
}
