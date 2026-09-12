import React from 'react';
import { motion } from 'framer-motion';
import { RiskLevel } from '../../types';

interface AttendanceRingProps {
  percentage: number;
  risk: RiskLevel;
  size?: number;
  strokeWidth?: number;
  subtitle?: string;
}

export const AttendanceRing: React.FC<AttendanceRingProps> = ({
  percentage,
  risk,
  size = 180,
  strokeWidth = 12,
  subtitle = 'Overall Attendance',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  // Choose stroke color gradient based on risk
  let gradientId = 'grad-safe';
  let textColor = 'text-white';

  if (risk === 'WARNING') {
    gradientId = 'grad-amber';
    textColor = 'text-amber-400';
  } else if (risk === 'CRITICAL') {
    gradientId = 'grad-ruby';
    textColor = 'text-rose-400';
  }

  return (
    <div className="relative inline-flex flex-col items-center justify-center select-none">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id="grad-safe" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
          <linearGradient id="grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="grad-ruby" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCA5A5" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/[0.06]"
        />

        {/* Dynamic Animated Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      {/* Centered Percentage & Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span
          key={percentage}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-sans ${textColor}`}
        >
          {percentage.toFixed(1)}%
        </motion.span>
        {subtitle && (
          <span className="text-[10px] sm:text-xs font-sub font-light text-zinc-400 uppercase tracking-widest mt-1">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
