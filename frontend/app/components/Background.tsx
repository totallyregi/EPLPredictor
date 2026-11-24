'use client';

import { motion } from 'framer-motion';

/** Night-stadium backdrop: floodlight glows + faint pitch markings. */
export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <motion.div className="glow g1" animate={{ x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="glow g2" animate={{ x: [0, -50, 0], y: [0, 20, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="glow g3" animate={{ opacity: [0.35, 0.6, 0.35] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
      <svg className="pitch-lines" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="2">
          <rect x="40" y="40" width="1120" height="680" rx="4" />
          <line x1="600" y1="40" x2="600" y2="720" />
          <circle cx="600" cy="380" r="95" />
          <rect x="40" y="200" width="170" height="360" />
          <rect x="990" y="200" width="170" height="360" />
          <rect x="40" y="295" width="60" height="170" />
          <rect x="1100" y="295" width="60" height="170" />
          <path d="M210 315 A 95 95 0 0 1 210 445" />
          <path d="M990 315 A 95 95 0 0 0 990 445" />
        </g>
      </svg>
      <div className="grain" />
    </div>
  );
}
