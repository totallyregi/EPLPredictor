'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResponse, Gameweek, Outcome, PastGame, SeasonAnalysis } from '../lib/types';
import { pct } from '../lib/types';
import Crest from './Crest';
import { CountUp } from './Viz';

const OUTCOME_LABEL: Record<Outcome, string> = { H: 'Home win', D: 'Draw', A: 'Away win' };
const tone = (acc: number) => (acc >= 0.6 ? 'great' : acc >= 0.5 ? 'good' : acc >= 0.4 ? 'ok' : 'bad');
type Filter = 'all' | 'correct' | 'missed' | 'exact';

/* ---------- Accuracy by gameweek chart (click a bar to open that gameweek) ---------- */
function GameweekChart({ gws, selected, onSelect, baseline }: { gws: Gameweek[]; selected: number; onSelect: (md: number) => void; baseline: number }) {
  const W = 900, H = 220, PL = 34, PR = 10, PT = 14, PB = 26;
  const bw = (W - PL - PR) / gws.length;
  const y = (v: number) => PT + (1 - v) * (H - PT - PB);
  const [hover, setHover] = useState<Gameweek | null>(null);
  const line = gws.map((g, i) => `${PL + bw * i + bw / 2},${y(g.cumulative_accuracy)}`).join(' ');
  return (
    <div className="gw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Accuracy by gameweek">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={PL - 6} y={y(v) + 3} textAnchor="end">{v * 100}%</text>
          </g>
        ))}
        <line x1={PL} x2={W - PR} y1={y(baseline)} y2={y(baseline)} className="base-line" />
        <text x={PL + 4} y={y(baseline) + 12} className="base-label">always-home {pct(baseline)}</text>
        {gws.map((g, i) => (
          <g key={g.matchday} className="gw-bar-g" onClick={() => onSelect(g.matchday)} onMouseEnter={() => setHover(g)} onMouseLeave={() => setHover(null)}>
            <rect x={PL + bw * i} y={PT} width={bw} height={H - PT - PB} fill="transparent" />
            <motion.rect
              className={`gw-bar ${tone(g.accuracy)} ${g.matchday === selected ? 'sel' : ''}`}
              x={PL + bw * i + bw * 0.16} width={bw * 0.68} rx={Math.min(4, bw * 0.2)}
              initial={{ y: y(0), height: 0 }}
              animate={{ y: y(Math.max(g.accuracy, 0.015)), height: y(0) - y(Math.max(g.accuracy, 0.015)) }}
              transition={{ duration: 0.7, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
            />
            {(gws.length <= 20 || g.matchday % 5 === 0 || g.matchday === 1) && (
              <text x={PL + bw * i + bw / 2} y={H - 8} textAnchor="middle" className={g.matchday === selected ? 'sel-t' : ''}>{g.matchday}</text>
            )}
          </g>
        ))}
        <motion.polyline points={line} className="cum-line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.3 }} />
      </svg>
      <AnimatePresence>
        {hover && (
          <motion.div className="gw-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ left: `${((gws.indexOf(hover) + 0.5) / gws.length) * 100}%` }}>
            <b>Gameweek {hover.matchday}</b>
            <span>{hover.correct}/{hover.matches} correct · {pct(hover.accuracy)}</span>
            <span>Season so far {pct(hover.cumulative_accuracy)}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="chart-legend">
        <span><i className="sw great" />60%+</span><span><i className="sw good" />50–59%</span><span><i className="sw ok" />40–49%</span><span><i className="sw bad" />Under 40%</span>
        <span><i className="sw line" />Season-to-date accuracy</span>
        <span className="chart-hint">Click a bar to open that gameweek</span>
      </div>
    </div>
  );
}

/* ---------- One past match: predicted vs actual ---------- */
function PastRow({ g, index, flash }: { g: PastGame; index: number; flash: boolean }) {
  const status = g.exact ? 'exact' : g.correct ? 'correct' : 'missed';
  const t = new Date(g.kickoff);
  return (
    <motion.div
      id={`pg-${g.match_id}`}
      className={`past ${status} ${flash ? 'flash' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
      layout
    >
      <span className={`verdict-badge ${status}`} title={status === 'exact' ? 'Exact score' : status === 'correct' ? 'Correct result' : 'Missed'}>
        {status === 'exact' ? '★' : status === 'correct' ? '✓' : '✗'}
      </span>
      <div className="past-main">
        <div className="past-teams">
          <span className="pt home"><span className="pt-name">{g.home_short}</span><Crest src={g.home_crest} name={g.home} size={30} /></span>
          <span className="pt-scores">
            <span className="actual">{g.score.replace('-', ' – ')}</span>
            <span className="predicted">Predicted {g.predicted_score.replace('-', '–')}</span>
          </span>
          <span className="pt away"><Crest src={g.away_crest} name={g.away} size={30} /><span className="pt-name">{g.away_short}</span></span>
        </div>
        <div className="past-probs" aria-label={`Model gave home ${pct(g.probs.H)}, draw ${pct(g.probs.D)}, away ${pct(g.probs.A)}`}>
          {(['H', 'D', 'A'] as Outcome[]).map((o) => (
            <span key={o} className={`pp ${o} ${o === g.actual ? 'hit' : ''} ${o === g.pick ? 'pick' : ''}`} style={{ flexGrow: g.probs[o] }}>
              {g.probs[o] >= 0.14 && <>{pct(g.probs[o])}{o === g.actual && <i> ●</i>}</>}
            </span>
          ))}
        </div>
        <div className="past-meta">
          <span>{t.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span>Called <b>{OUTCOME_LABEL[g.pick].toLowerCase()}</b> ({pct(g.confidence)})</span>
          <span>Result <b>{OUTCOME_LABEL[g.actual].toLowerCase()}</b>{!g.correct && ` · model gave it ${pct(g.actual_prob)}`}</span>
          <span className="xg">xG {g.xg[0].toFixed(1)}–{g.xg[1].toFixed(1)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function MiniGame({ g, onOpen, note }: { g: PastGame; onOpen: () => void; note: string }) {
  return (
    <button type="button" className="mini" onClick={onOpen}>
      <span className="mini-teams"><Crest src={g.home_crest} name={g.home} size={20} />{g.home_short} <b>{g.score.replace('-', '–')}</b> {g.away_short}<Crest src={g.away_crest} name={g.away} size={20} /></span>
      <span className="mini-note">{note} · GW {g.matchday}</span>
    </button>
  );
}

export default function TrackRecord() {
  const [cache, setCache] = useState<Record<string, AnalysisResponse>>({});
  const [season, setSeason] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [md, setMd] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [flashId, setFlashId] = useState<number | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (s: number | null) => {
    const key = String(s ?? 'latest');
    if (cache[key]) { setStatus('ready'); return; }
    setStatus('loading');
    try {
      const res = await fetch(`/api/analysis${s ? `?season=${s}` : ''}`);
      const data: AnalysisResponse = await res.json();
      if (!res.ok || !data.analysis) throw new Error();
      setCache((c) => ({ ...c, [key]: data, [String(data.analysis!.season)]: data }));
      if (s == null) setSeason(data.analysis.season);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [cache]);

  useEffect(() => { load(season); }, [season]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = cache[String(season ?? 'latest')];
  const a: SeasonAnalysis | null = data?.analysis ?? null;
  const gws = useMemo(() => a?.gameweeks ?? [], [a]);

  useEffect(() => {
    if (!gws.length) return;
    setMd((cur) => (cur != null && gws.some((g) => g.matchday === cur) ? cur : gws[gws.length - 1].matchday));
  }, [gws]);

  const gw = gws.find((g) => g.matchday === md) ?? null;
  const gwIndex = gw ? gws.indexOf(gw) : -1;
  const step = useCallback((dir: number) => {
    const next = gws[gwIndex + dir];
    if (next) { setMd(next.matchday); setFilter('all'); }
  }, [gws, gwIndex]);

  // Keep the selected chip in view; ← / → keys move between gameweeks.
  useEffect(() => {
    // Scroll only the chip strip (scrollIntoView would also nudge the whole page sideways).
    const strip = chipsRef.current;
    const chip = strip?.querySelector<HTMLElement>('.on');
    if (strip && chip) strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [md]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const openGame = (g: PastGame) => {
    setMd(g.matchday);
    setFilter('all');
    setFlashId(g.match_id);
    setTimeout(() => document.getElementById(`pg-${g.match_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    setTimeout(() => setFlashId(null), 2200);
  };

  const selectFromChart = (m: number) => {
    setMd(m);
    setFilter('all');
    setTimeout(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const games = (gw?.games ?? []).filter((g) => filter === 'all' || (filter === 'correct' ? g.correct : filter === 'missed' ? !g.correct : g.exact));
  const confident = a?.confidence_bands.find((b) => b.label === '60%+');

  return (
    <div className="track-record">
      <div className="panel-head">
        <div>
          <h2>Track record</h2>
          <p>Every past match, predicted the way the model would have called it live: using only results from before kick-off. Then compared with what actually happened.</p>
        </div>
        {data && (
          <div className="seg season-seg" role="tablist" aria-label="Season">
            {data.seasons.slice().reverse().map((s) => (
              <button key={s.season} type="button" role="tab" aria-selected={s.season === season} className={s.season === season ? 'on' : ''} onClick={() => setSeason(s.season)}>
                {s.season === season && <motion.span layoutId="season-pill" className="seg-pill" />}
                <span>{s.label}<small>{pct(s.accuracy)}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {status === 'loading' && !a && <div className="glass card-pad tr-loading"><span className="spinner" /> Replaying past gameweeks…</div>}
      {status === 'error' && !a && <div className="glass card-pad">Couldn&apos;t load the track record right now. <button type="button" className="ghost" onClick={() => load(season)}>Retry</button></div>}

      {a && (
        <AnimatePresence mode="wait">
          <motion.div key={a.season} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {/* Headline numbers */}
            <div className="tr-kpis">
              <div className="glass tr-kpi hero-kpi">
                <span className="tr-kpi-l">Correct results · {a.label}</span>
                <span className="tr-kpi-v"><CountUp value={a.accuracy * 100} decimals={1} suffix="%" /></span>
                <span className="tr-kpi-s">{a.correct} of {a.matches} matches</span>
                <div className="vs-bars">
                  <div><span>Model</span><i><motion.b className="m" initial={{ width: 0 }} animate={{ width: pct(a.accuracy) }} transition={{ duration: 0.9 }} /></i><em>{pct(a.accuracy)}</em></div>
                  <div><span>Always home</span><i><motion.b initial={{ width: 0 }} animate={{ width: pct(a.home_baseline) }} transition={{ duration: 0.9, delay: 0.1 }} /></i><em>{pct(a.home_baseline)}</em></div>
                  <div><span>Coin flip ×3</span><i><motion.b initial={{ width: 0 }} animate={{ width: '33.3%' }} transition={{ duration: 0.9, delay: 0.2 }} /></i><em>33%</em></div>
                </div>
              </div>
              <div className="glass tr-kpi">
                <span className="tr-kpi-l">Exact scores</span>
                <span className="tr-kpi-v"><CountUp value={a.exact} /></span>
                <span className="tr-kpi-s">{pct(a.exact_rate, 1)} of matches, spot on</span>
              </div>
              <div className="glass tr-kpi">
                <span className="tr-kpi-l">Confident picks (60%+)</span>
                <span className="tr-kpi-v">{confident ? <CountUp value={confident.accuracy * 100} suffix="%" /> : '—'}</span>
                <span className="tr-kpi-s">{confident ? `right in ${Math.round(confident.accuracy * confident.matches)} of ${confident.matches}` : 'none this season'}</span>
              </div>
              <div className="glass tr-kpi">
                <span className="tr-kpi-l">Best gameweek</span>
                <span className="tr-kpi-v">{a.best_gameweek ? `GW ${a.best_gameweek.matchday}` : '—'}</span>
                <span className="tr-kpi-s">{a.best_gameweek ? `${a.best_gameweek.correct}/${a.best_gameweek.matches} correct` : ''}{a.worst_gameweek ? ` · toughest GW ${a.worst_gameweek.matchday} (${a.worst_gameweek.correct}/${a.worst_gameweek.matches})` : ''}</span>
              </div>
            </div>

            {/* Chart */}
            <div className="glass card-pad">
              <div className="sub-head"><h3>Accuracy by gameweek</h3><span className="muted small">{gws.length} gameweeks</span></div>
              <GameweekChart gws={gws} selected={md ?? -1} onSelect={selectFromChart} baseline={a.home_baseline} />
            </div>

            {/* Gameweek explorer */}
            <div className="glass explorer" ref={explorerRef}>
              <div className="ex-head">
                <button type="button" className="ex-arrow" onClick={() => step(-1)} disabled={gwIndex <= 0} aria-label="Previous gameweek">‹</button>
                <div className="ex-title">
                  <h3>Gameweek {gw?.matchday}</h3>
                  {gw && <span>{new Date(gw.start).toLocaleDateString([], { day: 'numeric', month: 'short' })}{gw.end !== gw.start ? ` – ${new Date(gw.end).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>}
                </div>
                <button type="button" className="ex-arrow" onClick={() => step(1)} disabled={gwIndex >= gws.length - 1} aria-label="Next gameweek">›</button>
              </div>

              <div className="gw-chips" ref={chipsRef}>
                {gws.map((g) => (
                  <button key={g.matchday} type="button" className={`gw-chip ${tone(g.accuracy)} ${g.matchday === md ? 'on' : ''}`} onClick={() => { setMd(g.matchday); setFilter('all'); }}>
                    <span>{g.matchday}</span><i>{g.correct}/{g.matches}</i>
                  </button>
                ))}
              </div>

              {gw && (
                <div className="ex-summary">
                  <div className={`ex-score ${tone(gw.accuracy)}`}>
                    <b>{gw.correct}<small>/{gw.matches}</small></b>
                    <span>correct · {pct(gw.accuracy)}</span>
                  </div>
                  <div className="ex-stats">
                    <span><b>{gw.exact}</b> exact score{gw.exact === 1 ? '' : 's'}</span>
                    <span>Season to date <b>{pct(gw.cumulative_accuracy)}</b></span>
                  </div>
                  <div className="filters" role="tablist" aria-label="Filter matches">
                    {([['all', 'All'], ['correct', '✓ Correct'], ['missed', '✗ Missed'], ['exact', '★ Exact']] as [Filter, string][]).map(([f, l]) => {
                      const n = f === 'all' ? gw.matches : f === 'correct' ? gw.correct : f === 'missed' ? gw.matches - gw.correct : gw.exact;
                      return (
                        <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} disabled={n === 0 && f !== 'all'}>
                          {l} <i>{n}</i>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div key={`${md}-${filter}`} className="past-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {games.map((g, i) => <PastRow key={g.match_id} g={g} index={i} flash={flashId === g.match_id} />)}
                  {!games.length && <p className="muted empty">No matches in this filter.</p>}
                </motion.div>
              </AnimatePresence>
              <p className="kbd-hint">Tip: use ← → to move between gameweeks</p>
            </div>

            {/* Deeper analysis */}
            <div className="an-grid">
              <div className="glass card-pad">
                <div className="sub-head"><h3>When the model is confident</h3></div>
                <div className="bands">
                  {a.confidence_bands.map((b, i) => (
                    <div key={b.label} className="band">
                      <span className="band-l">{b.label}<small>{b.matches} picks</small></span>
                      <span className="band-track">
                        <motion.i className={tone(b.accuracy)} initial={{ width: 0 }} animate={{ width: pct(b.accuracy) }} transition={{ duration: 0.8, delay: i * 0.08 }} />
                        <em style={{ left: pct(b.avg_confidence) }} title="Average confidence" />
                      </span>
                      <b>{pct(b.accuracy)}</b>
                    </div>
                  ))}
                </div>
                <p className="bt-note">Bars show how often each confidence level was right; the white tick marks the confidence the model claimed. Higher confidence really does mean more correct.</p>
              </div>

              <div className="glass card-pad">
                <div className="sub-head"><h3>Calls vs reality</h3></div>
                <div className="cm">
                  <span />
                  {(['H', 'D', 'A'] as Outcome[]).map((o) => <span key={o} className="cm-h">Was {OUTCOME_LABEL[o].toLowerCase()}</span>)}
                  {(['H', 'D', 'A'] as Outcome[]).map((p) => {
                    const row = a.outcome_matrix[p];
                    const max = Math.max(...Object.values(a.outcome_matrix).flatMap((r) => Object.values(r)));
                    return [
                      <span key={`l${p}`} className="cm-h left">Called {OUTCOME_LABEL[p].toLowerCase()}</span>,
                      ...(['H', 'D', 'A'] as Outcome[]).map((o) => (
                        <span key={`${p}${o}`} className={`cm-c ${p === o ? 'diag' : ''}`} style={{ opacity: row[o] ? 0.35 + 0.65 * (row[o] / max) : 0.25 }}>{row[o]}</span>
                      )),
                    ];
                  })}
                </div>
                <p className="bt-note">Green diagonal = correct. A draw is called when it&apos;s within 5 points of the favourite. Calling more draws than that was tested and lowered accuracy: even well-rated draws only land about 30% of the time.</p>
              </div>

              <div className="glass card-pad">
                <div className="sub-head"><h3>Biggest upsets</h3><span className="muted small">Model least expected these</span></div>
                <div className="minis">{a.upsets.map((g) => <MiniGame key={g.match_id} g={g} onOpen={() => openGame(g)} note={`${OUTCOME_LABEL[g.actual]} had ${pct(g.actual_prob)}`} />)}</div>
              </div>

              <div className="glass card-pad">
                <div className="sub-head"><h3>Best calls</h3><span className="muted small">Most confident and right</span></div>
                <div className="minis">{a.best_calls.map((g) => <MiniGame key={g.match_id} g={g} onOpen={() => openGame(g)} note={`Called ${OUTCOME_LABEL[g.pick].toLowerCase()} at ${pct(g.confidence)}`} />)}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
