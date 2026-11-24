'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Background from './components/Background';
import Fixtures from './components/Fixtures';
import Hero, { pickFeatured } from './components/Hero';
import Insights from './components/Insights';
import Predictor from './components/Predictor';
import TableView from './components/TableView';
import type { Dashboard } from './lib/types';

const TABS = [
  { id: 'fixtures', label: 'Fixtures', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'table', label: 'Table', icon: 'M4 5h16v14H4zM4 10h16M10 5v14' },
  { id: 'predictor', label: 'Predictor', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v18M3 12h18' },
  { id: 'insights', label: 'Insights', icon: 'M5 19V9m7 10V5m7 14v-7' },
] as const;
type Tab = (typeof TABS)[number]['id'];
const MAX_ATTEMPTS = 5;

function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 9l6 4.5-2.3 7h-7.4L10 13.5z" fill="currentColor" /></svg>
      <span>EPL<b>Predictor</b></span>
    </span>
  );
}

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [status, setStatus] = useState<'loading' | 'waking' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('fixtures');
  const [focusId, setFocusId] = useState<number | null>(null);

  const load = useCallback(async (n = 1) => {
    setAttempt(n);
    const slow = setTimeout(() => setStatus('waking'), 3500);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Prediction service unavailable');
      setData(json);
      setStatus('ready');
    } catch (e) {
      setError((e as Error).message);
      if (n < MAX_ATTEMPTS) { setStatus('waking'); setTimeout(() => load(n + 1), 4000); }
      else setStatus('error');
    } finally {
      clearTimeout(slow);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const featured = useMemo(() => (data ? pickFeatured(data.predictions, data.table) : null), [data]);

  const go = (t: Tab) => {
    setTab(t);
    document.getElementById('content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <header className="topbar">
        <Logo />
        {status === 'ready' && (
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                {tab === t.id && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        )}
        <span className="updated">{data?.model.updated_at ? `Updated ${new Date(data.model.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      </header>

      <main className="shell">
        <AnimatePresence mode="wait">
          {status !== 'ready' && (
            <motion.div key="boot" className="boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
              <div className="ball-wrap">
                <motion.svg className="ball" viewBox="0 0 64 64" animate={status === 'error' ? {} : { rotate: 360, y: [0, -24, 0] }} transition={{ rotate: { duration: 1.6, repeat: Infinity, ease: 'linear' }, y: { duration: 0.8, repeat: Infinity, ease: 'easeOut' } }}>
                  <circle cx="32" cy="32" r="29" fill="#f4f6fb" />
                  <path d="M32 18l10 7.5-3.8 11.7H25.8L22 25.5z" fill="#0a0d14" />
                  <path d="M32 3v15M42 25.5l14-4.5M38.2 37.2l8.7 12M25.8 37.2l-8.7 12M22 25.5L8 21" stroke="#0a0d14" strokeWidth="2.4" />
                </motion.svg>
                <div className="ball-shadow" />
              </div>
              {status === 'error' ? (
                <>
                  <h2>Predictions are offline right now</h2>
                  <p>{error}</p>
                  <button type="button" className="cta" onClick={() => { setStatus('loading'); load(1); }}>Try again</button>
                </>
              ) : (
                <>
                  <h2>{status === 'loading' ? 'Warming up the model…' : 'Waking the prediction server…'}</h2>
                  <p>{status === 'waking' ? `It sleeps on free hosting when idle, so the first visit can take up to a minute.${attempt > 1 ? ` Attempt ${attempt}/${MAX_ATTEMPTS}.` : ''}` : 'Pulling the latest results and fixtures.'}</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'ready' && data && (
          <>
            {featured && <Hero match={featured} model={data.model} form={data.form} onOpen={() => { setTab('fixtures'); setFocusId(featured.match_id ?? null); }} />}
            <div id="content" className="content">
              <AnimatePresence mode="wait">
                <motion.section key={tab} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                  {tab === 'fixtures' && <Fixtures predictions={data.predictions} form={data.form} focusId={focusId} />}
                  {tab === 'table' && <TableView table={data.table} sims={data.model.simulations} />}
                  {tab === 'predictor' && <Predictor teams={data.teams} />}
                  {tab === 'insights' && <Insights model={data.model} table={data.table} track={data.track_record} results={data.results} />}
                </motion.section>
              </AnimatePresence>
            </div>
            <footer className="foot">
              <span>Data: Football-Data.org · Model: Dixon-Coles Poisson · Built by Reginald Yang</span>
            </footer>
          </>
        )}
      </main>

      {status === 'ready' && (
        <nav className="bottom-nav" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
              {tab === t.id && <motion.span layoutId="bn-pill" className="bn-pill" />}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </MotionConfig>
  );
}
