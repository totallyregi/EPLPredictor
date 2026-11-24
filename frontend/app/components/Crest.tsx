'use client';

import { useState } from 'react';

export default function Crest({ src, name, size = 32, className = '' }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/ FC$| AFC$/, '').split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return (
    <span className={`crest ${className}`} style={{ width: size, height: size }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="crest-fallback" style={{ fontSize: size * 0.32 }}>{initials}</span>
      )}
    </span>
  );
}
