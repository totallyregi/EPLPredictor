'use client';

import { useMemo, useState } from 'react';

const TEAM_COLOR_MAP: Record<string, string> = {
  Arsenal: 'badge-red',
  'Aston Villa': 'badge-claret',
  Bournemouth: 'badge-red',
  Brentford: 'badge-red',
  Brighton: 'badge-blue',
  Burnley: 'badge-claret',
  Chelsea: 'badge-blue',
  'Crystal Palace': 'badge-blue',
  Everton: 'badge-blue',
  Fulham: 'badge-neutral',
  'Ipswich Town': 'badge-blue',
  Leicester: 'badge-blue',
  Liverpool: 'badge-red',
  'Manchester City': 'badge-sky',
  'Manchester United': 'badge-red',
  Newcastle: 'badge-neutral',
  'Nottingham Forest': 'badge-red',
  Southampton: 'badge-red',
  Tottenham: 'badge-navy',
  'West Ham': 'badge-claret',
  Wolves: 'badge-gold'
};

function normalizeTeamName(team: string): string {
  const aliasMap: Record<string, string> = {
    'Arsenal FC': 'Arsenal',
    'Aston Villa FC': 'Aston Villa',
    'AFC Bournemouth': 'Bournemouth',
    'Bournemouth FC': 'Bournemouth',
    'Brentford FC': 'Brentford',
    'Brighton & Hove Albion FC': 'Brighton',
    'Brighton and Hove Albion': 'Brighton',
    'Burnley FC': 'Burnley',
    'Chelsea FC': 'Chelsea',
    'Crystal Palace FC': 'Crystal Palace',
    'Everton FC': 'Everton',
    'Fulham FC': 'Fulham',
    'Leeds United FC': 'Leeds',
    'Leicester City FC': 'Leicester',
    'Liverpool FC': 'Liverpool',
    'Manchester City FC': 'Manchester City',
    'Manchester United FC': 'Manchester United',
    'Newcastle United FC': 'Newcastle',
    'Nottingham Forest FC': 'Nottingham Forest',
    'Southampton FC': 'Southampton',
    'Tottenham Hotspur FC': 'Tottenham',
    'Wolverhampton Wanderers FC': 'Wolves',
    'West Ham United FC': 'West Ham'
  };
  return aliasMap[team] || team;
}

function getTeamInitials(team: string): string {
  const normalized = normalizeTeamName(team);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

interface TeamBadgeProps {
  team: string;
  crestUrl?: string;
  compact?: boolean;
}

export default function TeamBadge({ team, crestUrl, compact = false }: TeamBadgeProps) {
  const normalized = normalizeTeamName(team);
  const themeClass = TEAM_COLOR_MAP[normalized] || 'badge-neutral';
  const initials = getTeamInitials(normalized);
  const [imgFailed, setImgFailed] = useState(false);

  const shouldShowImage = useMemo(() => {
    if (!crestUrl || imgFailed) {
      return false;
    }
    return crestUrl.startsWith('http://') || crestUrl.startsWith('https://');
  }, [crestUrl, imgFailed]);

  return (
    <span className={`team-badge ${themeClass} ${compact ? 'compact' : ''}`} aria-label={normalized}>
      {shouldShowImage ? (
        <img
          src={crestUrl}
          alt={`${normalized} badge`}
          className="team-badge-image"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="team-badge-initials">{initials}</span>
      )}
    </span>
  );
}

