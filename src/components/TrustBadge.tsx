import React from 'react';
import type { TrustBadge as TrustBadgeType } from '../types';

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

interface TrustBadgeProps {
  badge: TrustBadgeType;
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ badge }) => {
  const colorClass = colorMap[badge.l1.color] || colorMap.amber;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}
    >
      <span>{badge.l1.icon}</span>
      <span>{badge.l1.label}</span>
    </div>
  );
};

export default TrustBadge;
