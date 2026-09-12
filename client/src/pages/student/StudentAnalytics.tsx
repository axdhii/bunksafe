import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Award, Flame, Calendar, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { WeeklyAnalytics, DashboardData } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';

export const StudentAnalytics: React.FC = () => {
  const [weekly, setWeekly] = useState<WeeklyAnalytics | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wRes, dRes] = await Promise.all([
          apiRequest<WeeklyAnalytics>('/analytics/weekly'),
          apiRequest<DashboardData>('/attendance/dashboard'),
        ]);
        setWeekly(wRes);
        setDash(dRes);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !weekly || !dash) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Computing analytics & trends...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Academic Intelligence"
        title="Analytics & Streaks"
        subtitle="Deep-dive into your weekly consistency, day-wise trends, and subject health."
      />

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Streak & Consistency */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-sub">
              Consistency Score
            </span>
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <div className="text-3xl font-bold text-white font-sans">
              {dash.streaks.consistencyScore}%
            </div>
            <p className="text-xs text-zinc-300 mt-1 font-sub font-light">
              Active streak: <span className="text-amber-400 font-bold">{dash.streaks.current} classes</span> • All-time peak: <span className="font-bold text-white">{dash.streaks.longest}</span>
            </p>
          </div>
        </div>

        {/* Best Subject */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-sub">
              Highest Standing
            </span>
            <Award className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 font-sans">
              {weekly.bestSubject ? `${weekly.bestSubject.percentage}%` : 'N/A'}
            </div>
            <p className="text-xs text-zinc-200 font-medium mt-1 truncate font-sub">
              {weekly.bestSubject ? `${weekly.bestSubject.code} — ${weekly.bestSubject.name}` : 'No records yet'}
            </p>
          </div>
        </div>

        {/* Needs Attention */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-sub">
              Needs Attention
            </span>
            <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400 font-sans">
              {weekly.worstSubject ? `${weekly.worstSubject.percentage}%` : 'N/A'}
            </div>
            <p className="text-xs text-zinc-200 font-medium mt-1 truncate font-sub">
              {weekly.worstSubject ? `${weekly.worstSubject.code} — ${weekly.worstSubject.name}` : 'All subjects safe'}
            </p>
          </div>
        </div>
      </div>

      {/* Day-of-Week Distribution (Mon to Sat) */}
      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-sans">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span>Day-of-Week Attendance Distribution</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sub font-light">
            Compare your historical attendance rate across each weekday
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
          {weekly.dayWiseDistribution.map((item) => (
            <div
              key={item.day}
              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center space-y-2 flex flex-col justify-between"
            >
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sub">
                {item.day}
              </span>

              {/* Mini vertical bar */}
              <div className="h-24 w-full flex items-end justify-center py-1">
                <div className="w-6 rounded-t-lg bg-white/10 relative overflow-hidden h-full flex items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ${
                      item.percentage >= 85
                        ? 'bg-white'
                        : item.percentage > 0
                        ? 'bg-gradient-to-t from-amber-500 to-rose-500'
                        : 'bg-transparent'
                    }`}
                    style={{ height: `${item.percentage}%` }}
                  />
                </div>
              </div>

              <div>
                <span className="text-sm font-bold text-white block font-sans">
                  {item.percentage}%
                </span>
                <span className="text-[10px] text-zinc-400 font-sub font-light">
                  {item.attended}/{item.conducted}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subject-by-Subject Comparative Breakdown */}
      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-sans">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <span>Comparative Subject Ledger</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sub font-light">
            Full semester standing relative to the {dash.threshold}% institutional minimum
          </p>
        </div>

        <div className="space-y-3">
          {dash.subjectStats.map((sub) => (
            <div key={sub.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-xs font-bold text-white mr-2">{sub.code}</span>
                  <span className="font-bold text-sm text-white font-sans">{sub.name}</span>
                </div>
                <span className={`font-sans font-bold text-sm ${
                  sub.percentage >= sub.minimumThreshold ? 'text-white' : 'text-rose-400'
                }`}>
                  {sub.percentage}%
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden relative">
                {/* Threshold indicator line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                  style={{ left: `${sub.minimumThreshold}%` }}
                  title={`Threshold: ${sub.minimumThreshold}%`}
                />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sub.risk === 'SAFE'
                      ? 'bg-white'
                      : sub.risk === 'WARNING'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, sub.percentage)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 font-sub font-light">
                <span>
                  {sub.attended} attended • {sub.absent} absent • {sub.cancelled} cancelled
                </span>
                <span>
                  {sub.safeSkips > 0 ? `+${sub.safeSkips} safe skips` : `${sub.recoveryRequired} required to recover`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
