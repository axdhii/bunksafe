import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { apiRequest } from '../../api/client';

export const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminOverview = async () => {
      try {
        const res = await apiRequest('/analytics/admin/overview');
        setOverview(res);
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminOverview();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading administrator control center...</p>
      </div>
    );
  }

  const { totalStudents, distribution, atRiskStudents, threshold } = overview || {
    totalStudents: 0,
    distribution: { safe: 0, warning: 0, critical: 0 },
    atRiskStudents: [],
    threshold: 85.0,
  };

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Administrative Console
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold font-sub">
              Master Authority
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5 font-sans">
            Institutional Control Center
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-sub font-light">
            Global attendance health, academic structure, and timetable orchestration
          </p>
        </div>

        {/* Timetable Import Action Shortcut */}
        <Link
          to="/admin/timetable"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-black font-bold text-xs hover:bg-zinc-200 active:scale-95 transition-all w-fit font-sans"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Upload & Preview Timetable (CSV/Excel)</span>
        </Link>
      </div>

      {/* Cohort Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-sub">
            Total Enrolled
          </span>
          <div className="text-3xl font-bold text-white font-sans">{totalStudents}</div>
          <p className="text-xs text-zinc-400 font-sub font-light">Active student accounts</p>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-2">
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider font-sub">
            Safe Standing (≥{threshold}%)
          </span>
          <div className="text-3xl font-bold text-emerald-400 font-sans">{distribution.safe}</div>
          <p className="text-xs text-zinc-400 font-sub font-light">Compliant with attendance norms</p>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-2">
          <span className="text-xs font-medium text-amber-400 uppercase tracking-wider font-sub">
            Close to Limit
          </span>
          <div className="text-3xl font-bold text-amber-400 font-sans">{distribution.warning}</div>
          <p className="text-xs text-zinc-400 font-sub font-light">Within 3% of threshold</p>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-2">
          <span className="text-xs font-medium text-rose-400 uppercase tracking-wider font-sub">
            Critical Deficit (&lt;{threshold}%)
          </span>
          <div className="text-3xl font-bold text-rose-400 font-sans">{distribution.critical}</div>
          <p className="text-xs text-zinc-400 font-sub font-light">Recovery intervention required</p>
        </div>
      </div>

      {/* Control Grid Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          to="/admin/structure"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Academic Tree</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">Sem, Branch, Sec</span>
        </Link>

        <Link
          to="/admin/students"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Students</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">Enrolment & USN</span>
        </Link>

        <Link
          to="/admin/subjects"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Subjects</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">Codes & Credits</span>
        </Link>

        <Link
          to="/admin/timetable"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Timetables</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">Smart Timeline Builder</span>
        </Link>

        <Link
          to="/admin/notifications"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Broadcast</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">Announcements</span>
        </Link>

        <Link
          to="/admin/settings"
          className="p-4 rounded-2xl liquid-glass-card hover:border-white/30 text-center transition-all flex flex-col items-center gap-2 group"
        >
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform">
            <Settings className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white font-sans">Settings</span>
          <span className="text-[10px] text-zinc-400 font-sub font-light">System & Audits</span>
        </Link>
      </div>

      {/* Critical Deficit Action Ledger */}
      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white font-sans">Critical Deficit Ledger</h3>
          <p className="text-xs text-zinc-400 font-sub font-light">
            Students falling below the {threshold}% statutory threshold
          </p>
        </div>

        {atRiskStudents.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs font-sub font-light">
            No students currently in critical deficit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10 font-sub">
                <tr>
                  <th className="py-2.5 px-3">USN</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Sem / Branch / Sec</th>
                  <th className="py-2.5 px-3">Attendance %</th>
                  <th className="py-2.5 px-3">Recovery Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {atRiskStudents.map((st: any) => (
                  <tr key={st.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-sans font-bold text-white">
                      {st.usn}
                    </td>
                    <td className="py-2.5 px-3 text-white font-sans font-medium">{st.name}</td>
                    <td className="py-2.5 px-3 text-zinc-400 font-sub font-light">
                      Sem {st.semester} • {st.branch} • Sec {st.section}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-rose-400">
                      {st.percentage}%
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 font-sub">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">
                        +{st.recoveryRequired} classes
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
