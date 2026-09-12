import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User as UserIcon,
  Flame,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCheck,
  Coffee,
  Utensils,
  Layers,
  Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../api/client';
import { DashboardData, TodayClass } from '../../types';
import { AttendanceRing } from '../../components/common/AttendanceRing';
import { RiskBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { calculateAttendance } from '../../utils/attendanceMath';
import { SpotlightCard } from '../../components/common/SpotlightCard';
import { TextGenerateEffect } from '../../components/common/TextGenerateEffect';

export const StudentDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState<string | null>(null);
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [markAllLoading, setMarkAllLoading] = useState(false);

  // Batch Filter for Split Labs (Default B1)
  const [activeBatchFilter, setActiveBatchFilter] = useState<'ALL' | 'B1' | 'B2'>('B1');

  const { isOnline, queueAttendance } = useOfflineSync();

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await apiRequest<DashboardData>('/attendance/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleMarkClass = async (item: TodayClass, status: 'PRESENT' | 'ABSENT') => {
    if (!data) return;
    setIsMarking(item.id);

    // Optimistic UI Update
    const previousTodayClasses = [...data.todayClasses];
    const previousStats = [...data.subjectStats];

    const updatedTodayClasses = data.todayClasses.map((c) =>
      c.id === item.id ? { ...c, status } : c
    );

    let updatedStats = [...data.subjectStats];
    if (item.subject) {
      updatedStats = data.subjectStats.map((sub) => {
        if (sub.id === item.subject.id) {
          const wasConductedBefore = item.status !== undefined;
          const wasAttendedBefore = item.status === 'PRESENT';

          let newAttended = sub.attended;
          let newConducted = sub.conducted;

          if (!wasConductedBefore) {
            newConducted += 1;
            if (status === 'PRESENT') newAttended += 1;
          } else {
            if (wasAttendedBefore && status === 'ABSENT') newAttended -= 1;
            if (!wasAttendedBefore && status === 'PRESENT') newAttended += 1;
          }

          const calc = calculateAttendance(newAttended, newConducted, sub.minimumThreshold);
          return { ...sub, ...calc };
        }
        return sub;
      });
    }

    setData({
      ...data,
      todayClasses: updatedTodayClasses,
      subjectStats: updatedStats,
    });

    if (status === 'PRESENT') {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#ffffff', '#a1a1aa', '#71717a'],
      });
    }

    try {
      if (!isOnline) {
        await queueAttendance({
          subjectId: item.subject.id,
          timetableEntryId: item.id,
          date: new Date().toISOString().split('T')[0],
          status,
        });
      } else {
        await apiRequest('/attendance/mark', {
          method: 'POST',
          data: {
            subjectId: item.subject.id,
            timetableEntryId: item.id,
            date: new Date().toISOString().split('T')[0],
            status,
          },
        });
      }
    } catch (err: any) {
      // Revert on error
      setData({
        ...data,
        todayClasses: previousTodayClasses,
        subjectStats: previousStats,
      });
      alert(err.message || 'Failed to record attendance.');
    } finally {
      setIsMarking(null);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!data) return;
    setMarkAllLoading(true);
    try {
      await apiRequest('/attendance/mark-all-today', {
        method: 'POST',
        data: { date: new Date().toISOString().split('T')[0] },
      });
      setShowMarkAllModal(false);
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ffffff', '#e4e4e7', '#a1a1aa'],
      });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to mark all present.');
    } finally {
      setMarkAllLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-2xl liquid-glass flex items-center justify-center border border-white/10">
          <Sparkles className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="text-sm font-sub font-light text-zinc-400">Loading attendance intelligence...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl liquid-glass-card text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white font-sans">Couldn't load dashboard</h3>
        <p className="text-sm font-sub font-light text-zinc-300">{error || 'Something went wrong.'}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  const atRiskSubjects = data.subjectStats.filter((s) => s.risk !== 'SAFE');
  const safeSubjects = data.subjectStats.filter((s) => s.risk === 'SAFE');

  // Filter today's classes by selected batch (supports section-specific codes like A1/A2, B1/B2)
  const filteredTodayClasses = data.todayClasses.filter((c: any) => {
    if (c.batch === 'ALL' || !c.batch) return true;
    if (activeBatchFilter === 'ALL') return true;
    if (c.batch === activeBatchFilter) return true;
    if (activeBatchFilter.endsWith('1') && c.batch.endsWith('1')) return true;
    if (activeBatchFilter.endsWith('2') && c.batch.endsWith('2')) return true;
    return false;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      {/* 1. Header Greeting & Streak */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass border border-white/10 text-[11px] font-sub font-light text-zinc-300 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>BunkSafe Attendance Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            Hello, {data.student.name.split(' ')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 font-sub font-light">
            Section {data.student.section.name} • {data.student.branch.code} Sem {data.student.semester.number} • {data.student.usn}
          </p>
        </div>

        {/* Quick Streak Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl liquid-glass-card border border-white/10 w-fit">
          <div className="p-2.5 rounded-xl bg-white/5 text-amber-400 border border-amber-500/20">
            <Flame className="w-6 h-6 fill-amber-400" />
          </div>
          <div>
            <div className="text-[10px] font-sub font-light text-zinc-400 uppercase tracking-wider">
              Current Streak
            </div>
            <div className="text-lg font-bold text-white flex items-center gap-1.5 font-sans">
              <span>{data.streaks.current} classes</span>
              <span className="text-xs text-amber-400 font-sub font-light">
                (Best: {data.streaks.longest})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Tier: Overall Gauge & Instant At-A-Glance Verdict */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Overall Ring Spotlight Card */}
        <SpotlightCard className="p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <AttendanceRing percentage={data.overall.percentage} risk={data.overall.risk} size={190} />

          <div className="mt-4 flex items-center gap-2">
            <RiskBadge level={data.overall.risk} size="md" />
            <span className="text-xs font-sub font-light text-zinc-400">
              Required Cutoff: {data.threshold}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full mt-6 pt-4 border-t border-white/[0.08] text-center">
            <div>
              <div className="text-[10px] font-sub uppercase tracking-wider text-zinc-400">Attended</div>
              <div className="text-lg font-bold text-white font-sans mt-0.5">{data.overall.attended}</div>
            </div>
            <div>
              <div className="text-[10px] font-sub uppercase tracking-wider text-zinc-400">Conducted</div>
              <div className="text-lg font-bold text-zinc-300 font-sans mt-0.5">{data.overall.conducted}</div>
            </div>
            <div>
              <div className="text-[10px] font-sub uppercase tracking-wider text-zinc-400">Absent</div>
              <div className="text-lg font-bold text-rose-400 font-sans mt-0.5">{data.overall.absent}</div>
            </div>
          </div>
        </SpotlightCard>

        {/* Right 2 Columns: Safe Skips Verdict & Quick Decision Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Safe Skips Buffer Card */}
          <SpotlightCard
            spotlightColor="rgba(255, 255, 255, 0.05)"
            className="p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-sub uppercase tracking-wider text-zinc-400">
                  Cutoff Buffer
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15 font-sub font-light">
                  {data.threshold}% Threshold
                </span>
              </div>
              <div className="mt-3">
                <div className="text-4xl font-bold text-white font-sans tracking-tight">
                  {data.overall.safeSkips}
                </div>
                <div className="text-xs sm:text-sm text-zinc-300 mt-1 font-sub font-light">
                  <TextGenerateEffect
                    words={
                      data.overall.safeSkips > 0
                        ? `You have a safety buffer of ${data.overall.safeSkips} skips across your courses.`
                        : `No safe skips available. Attending upcoming lectures is mandatory.`
                    }
                    highlightWords={[`${data.overall.safeSkips}`, 'mandatory']}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 font-sub">
              <span>{safeSubjects.length} safe subjects</span>
              <Link to="/subjects" className="text-white hover:underline flex items-center gap-0.5 font-medium">
                View subjects <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </SpotlightCard>

          {/* Card 2: Recovery Deficit Card */}
          <SpotlightCard
            spotlightColor="rgba(244, 63, 94, 0.08)"
            className="p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-sub uppercase tracking-wider text-rose-400">
                  Recovery Needed
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sub font-medium">
                  Action Required
                </span>
              </div>
              <div className="mt-3">
                <div className="text-4xl font-bold text-white font-sans tracking-tight">
                  {data.overall.recoveryRequired}
                </div>
                <div className="text-xs sm:text-sm text-zinc-300 mt-1 font-sub font-light">
                  <TextGenerateEffect
                    words={
                      data.overall.recoveryRequired > 0
                        ? `Consecutive classes required to climb back to ${data.threshold}%.`
                        : `No recovery needed! You are comfortably above the cutoff.`
                    }
                    highlightWords={[`${data.threshold}%`, 'comfortably']}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 font-sub">
              <span>{atRiskSubjects.length} at risk</span>
              {atRiskSubjects.length > 0 && (
                <Link to="/subjects" className="text-rose-400 hover:underline flex items-center gap-0.5 font-medium">
                  View risk list <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </SpotlightCard>

          {/* Quick "At Risk" Alert Banner */}
          {atRiskSubjects.length > 0 && (
            <div className="sm:col-span-2 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm font-sub">
                <span className="font-bold text-rose-300">Action Required: </span>
                <span className="text-zinc-300">
                  {atRiskSubjects.map((s) => `${s.code} (${s.percentage}%)`).join(', ')} need immediate attendance.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Today's Classes Section (Touch-Friendly, Batch Switcher) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2 font-sans">
              <span>Today's Classes & Labs</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-sub">
                {filteredTodayClasses.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-sub font-light">
              1-tap attendance marking with batch-split lab selection
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Batch Selector Pill */}
            <div className="flex items-center p-1 rounded-2xl liquid-glass border border-white/10 text-xs">
              <button
                onClick={() => setActiveBatchFilter('B1')}
                className={`px-3 py-1 rounded-xl text-xs transition-all ${
                  activeBatchFilter === 'B1'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white font-sub'
                }`}
              >
                Batch 1
              </button>
              <button
                onClick={() => setActiveBatchFilter('B2')}
                className={`px-3 py-1 rounded-xl text-xs transition-all ${
                  activeBatchFilter === 'B2'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white font-sub'
                }`}
              >
                Batch 2
              </button>
              <button
                onClick={() => setActiveBatchFilter('ALL')}
                className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                  activeBatchFilter === 'ALL'
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-zinc-400 hover:text-white font-sub'
                }`}
              >
                All
              </button>
            </div>

            {data.todayClasses.length > 0 && (
              <button
                onClick={() => setShowMarkAllModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-200 transition-all active:scale-95 font-sub"
              >
                <CheckCheck className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Mark All Present</span>
              </button>
            )}
          </div>
        </div>

        {filteredTodayClasses.length === 0 ? (
          <div className="p-8 rounded-3xl liquid-glass-card text-center space-y-2">
            <span className="text-3xl">🎉</span>
            <h4 className="text-base font-bold text-white font-sans">No classes scheduled today!</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sub font-light">
              Enjoy your day off or review your weekly schedule in the Timetable tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTodayClasses.map((item: any) => {
              const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(item.type?.toUpperCase());
              const isInterval = item.type === 'INTERVAL';
              const isLunch = item.type === 'LUNCH';

              // If it's a break entry (Tea break or Lunch break)
              if (isBreak) {
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      isLunch
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                        {isLunch ? <Utensils className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {item.title || (isLunch ? 'Lunch Break' : 'Tea / Short Break')}
                        </h4>
                        <span className="text-xs font-mono text-slate-300">
                          {item.startTime} – {item.endTime}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/10 uppercase tracking-wider font-bold">
                      CAMPUS BREAK
                    </span>
                  </div>
                );
              }

              const isSafe = item.safeSkips > 0;
              const hasBatchTag = item.batch && item.batch !== 'ALL';

              return (
                <SpotlightCard
                  key={item.id}
                  className={`p-4 transition-all flex flex-col justify-between gap-3 border ${
                    item.status === 'PRESENT'
                      ? 'border-white/30 bg-white/[0.04]'
                      : item.status === 'ABSENT'
                      ? 'border-rose-500/30 bg-rose-500/[0.04]'
                      : 'border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-xs font-bold text-white">
                          {item.subject?.code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-300 font-sub uppercase font-medium">
                          {item.type}
                        </span>
                        {hasBatchTag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20 font-sub font-medium">
                            {item.batch.endsWith('1') ? 'Batch 1' : item.batch.endsWith('2') ? 'Batch 2' : item.batch} ({item.batch})
                          </span>
                        )}
                        {/* Skip Verdict Pill */}
                        {isSafe ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sub font-medium">
                            ✓ Safe to skip ({item.safeSkips} buffer)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sub font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Don't miss!
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white mt-1 leading-snug font-sans">
                        {item.subject?.name}
                      </h4>
                    </div>

                    <RiskBadge level={item.risk} size="sm" />
                  </div>

                  {/* Metadata: Time, Room, Faculty */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-sub font-light">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {item.startTime} – {item.endTime}
                    </span>
                    {item.room && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        {item.room}
                      </span>
                    )}
                    {item.faculty && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                        {item.faculty}
                      </span>
                    )}
                  </div>

                  {/* 1-Tap Marking Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleMarkClass(item, 'PRESENT')}
                      disabled={isMarking === item.id}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        item.status === 'PRESENT'
                          ? 'bg-white text-black font-sans shadow-sm'
                          : 'bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 hover:border-white/20 font-sub'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{item.status === 'PRESENT' ? 'Present ✓' : 'Mark Present'}</span>
                    </button>

                    <button
                      onClick={() => handleMarkClass(item, 'ABSENT')}
                      disabled={isMarking === item.id}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        item.status === 'ABSENT'
                          ? 'bg-rose-500 text-white font-sans'
                          : 'bg-white/[0.05] hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 font-sub'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{item.status === 'ABSENT' ? 'Absent ✕' : 'Mark Absent'}</span>
                    </button>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Mark All Present Confirmation Modal */}
      <Modal isOpen={showMarkAllModal} onClose={() => setShowMarkAllModal(false)} title="Confirm Bulk Attendance">
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sub">
            Mark all <strong className="text-white font-sans">{data.todayClasses.filter((c: any) => c.subjectId).length} scheduled classes</strong> for today as <strong className="text-white font-sans">PRESENT</strong>?
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setShowMarkAllModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-white/10 font-sub"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkAllPresent}
              disabled={markAllLoading}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
            >
              {markAllLoading ? 'Marking All...' : 'Confirm Present'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
