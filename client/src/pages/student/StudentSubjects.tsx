import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Sliders, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { SubjectStats, ProjectionAnalysis } from '../../types';
import { RiskBadge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';
import { simulateScenario } from '../../utils/attendanceMath';

export const StudentSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [projections, setProjections] = useState<ProjectionAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<SubjectStats | null>(null);

  // Simulation state for What-If simulator
  const [simAttendedDelta, setSimAttendedDelta] = useState(0);
  const [simMissedDelta, setSimMissedDelta] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, projRes] = await Promise.all([
          apiRequest<any>('/attendance/dashboard'),
          apiRequest<{ projections: ProjectionAnalysis[] }>('/attendance/projections'),
        ]);
        setSubjects(dashRes.subjectStats || []);
        setProjections(projRes.projections || []);
        if (dashRes.subjectStats?.length > 0) {
          setSelectedSubject(dashRes.subjectStats[0]);
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading course analytics...</p>
      </div>
    );
  }

  const activeProj = projections.find((p) => p.subjectId === selectedSubject?.id);

  // Simulated percentage
  const simulatedPercentage = selectedSubject
    ? simulateScenario(
        selectedSubject.attended,
        selectedSubject.conducted,
        simAttendedDelta,
        simMissedDelta
      )
    : 0;

  return (
    <div className="space-y-6 pb-28 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Academic Overview & Scenarios"
        title="Subject Attendance"
        subtitle="Explore individual subject health, safe skip buffers, and interactive future projections."
      />

      {/* Grid of Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sub) => {
          const isSelected = selectedSubject?.id === sub.id;
          return (
            <div
              key={sub.id}
              onClick={() => {
                setSelectedSubject(sub);
                setSimAttendedDelta(0);
                setSimMissedDelta(0);
              }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-200 border relative ${
                isSelected
                  ? 'liquid-glass-card border-white ring-1 ring-white/50'
                  : 'liquid-glass-card border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="font-sans text-xs font-bold text-white">
                    {sub.code}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5 leading-snug font-sans">
                    {sub.name}
                  </h3>
                </div>
                <RiskBadge level={sub.risk} size="sm" />
              </div>

              {/* Progress bar and numbers */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-sub font-light">
                    {sub.attended} / {sub.conducted} attended
                  </span>
                  <span className="font-bold text-white text-sm font-sans">{sub.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sub.risk === 'SAFE'
                        ? 'bg-white'
                        : sub.risk === 'WARNING'
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, sub.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Skips / Recovery Statement */}
              <div className="text-xs pt-3 border-t border-white/5 flex items-center justify-between font-sub">
                {sub.risk === 'SAFE' ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Can miss {sub.safeSkips} more
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Attend next {sub.recoveryRequired} to recover
                  </span>
                )}
                <span className="text-[11px] text-zinc-300 font-medium hover:text-white">Simulate →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Subject Detailed Scenario Simulator */}
      {selectedSubject && (
        <div className="mt-8 p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/5 text-white border border-white/10">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-sans">
                  Future Scenario Simulator: {selectedSubject.name} ({selectedSubject.code})
                </h3>
                <p className="text-xs text-zinc-400 font-sub font-light">
                  Current attendance: <span className="text-white font-bold">{selectedSubject.percentage}%</span> • Minimum threshold: {selectedSubject.minimumThreshold}%
                </p>
              </div>
            </div>
            <RiskBadge level={selectedSubject.risk} size="md" />
          </div>

          {/* Scenario Result Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Live Interactive Simulator */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1 font-sub">
                  Custom Simulation
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white font-sans">
                    {simulatedPercentage}%
                  </span>
                  <span className="text-xs text-zinc-400 font-sub font-light">
                    ({selectedSubject.attended + simAttendedDelta}/
                    {selectedSubject.conducted + simAttendedDelta + simMissedDelta})
                  </span>
                </div>
              </div>

              {/* Adjust buttons */}
              <div className="space-y-2 text-xs font-sub">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Classes Attended:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSimAttendedDelta(Math.max(0, simAttendedDelta - 1))}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold"
                    >
                      -
                    </button>
                    <span className="font-sans font-bold text-white w-6 text-center">
                      +{simAttendedDelta}
                    </span>
                    <button
                      onClick={() => setSimAttendedDelta(simAttendedDelta + 1)}
                      className="w-7 h-7 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Classes Missed:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSimMissedDelta(Math.max(0, simMissedDelta - 1))}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold"
                    >
                      -
                    </button>
                    <span className="font-sans font-bold text-white w-6 text-center">
                      +{simMissedDelta}
                    </span>
                    <button
                      onClick={() => setSimMissedDelta(simMissedDelta + 1)}
                      className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {(simAttendedDelta > 0 || simMissedDelta > 0) && (
                <button
                  onClick={() => {
                    setSimAttendedDelta(0);
                    setSimMissedDelta(0);
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/5 font-sub"
                >
                  Reset Simulation
                </button>
              )}
            </div>

            {/* Next Class Immediate Impact */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block font-sub">
                Next Class Impact
              </span>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="text-xs text-zinc-300 font-medium font-sub">If Attended:</span>
                  <span className="text-base font-bold text-white font-sans">
                    {selectedSubject.nextIfAttended}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-xs text-rose-300 font-medium font-sub">If Missed:</span>
                  <span className="text-base font-bold text-rose-400 font-sans">
                    {selectedSubject.nextIfMissed}%
                  </span>
                </div>
              </div>
            </div>

            {/* End of Semester Forecast */}
            {activeProj && (
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider block font-sub">
                  Remaining Classes Forecast (~{activeProj.totalRemaining} classes)
                </span>
                <div className="space-y-2 text-xs font-sub">
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-300">Attend 100% remaining:</span>
                    <span className="font-bold text-white font-sans">{activeProj.attendAllRemaining}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-300">Attend 90% remaining:</span>
                    <span className="font-bold text-white font-sans">{activeProj.attend90Remaining}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-zinc-300">Attend 85% remaining:</span>
                    <span className="font-bold text-amber-400 font-sans">{activeProj.attend85Remaining ?? activeProj.attend75Remaining}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-zinc-300">Miss next 2 classes:</span>
                    <span className="font-bold text-rose-400 font-sans">{activeProj.missNext2}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
