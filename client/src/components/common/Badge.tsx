import React from 'react';
import { RiskLevel } from '../../types';

interface BadgeProps {
  level: RiskLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<BadgeProps> = ({ level, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-sub font-medium',
    md: 'text-xs px-2.5 py-1 font-sub font-medium',
    lg: 'text-sm px-3.5 py-1.5 font-sub font-medium',
  }[size];

  if (level === 'SAFE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 ${sizeClasses} ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Safe
      </span>
    );
  }

  if (level === 'WARNING') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-400 ${sizeClasses} ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Close to Limit
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-400 ${sizeClasses} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      Critical Danger
    </span>
  );
};
