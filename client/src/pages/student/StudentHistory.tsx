import React, { useState, useEffect } from 'react';
import { History, Filter, CheckCircle2, XCircle, Calendar, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { AttendanceRecord, SubjectStats } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';

export const StudentHistory: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [histRes, dashRes] = await Promise.all([
          apiRequest<{ records: AttendanceRecord[] }>('/attendance/history'),
          apiRequest<any>('/attendance/dashboard'),
        ]);
        setRecords(histRes.records || []);
        setSubjects(dashRes.subjectStats || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInit();
  }, []);

  const filteredRecords = records.filter((r) => {
    if (filterSubject && r.subjectId !== filterSubject) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterDate && r.date !== filterDate) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading historical records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Chronological Audit"
        title="Attendance History"
        subtitle="Every marked session with date, status, and verification records."
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl liquid-glass-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-sub">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span>Filters:</span>
        </div>

        {/* Subject dropdown */}
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-white font-sub"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id} className="bg-black text-white">
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        {/* Status dropdown */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-white font-sub"
        >
          <option value="">All Statuses</option>
          <option value="PRESENT" className="bg-black text-white">Present Only</option>
          <option value="ABSENT" className="bg-black text-white">Absent Only</option>
        </select>

        {/* Date filter */}
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white focus:outline-none focus:border-white font-sub"
        />

        {(filterSubject || filterStatus || filterDate) && (
          <button
            onClick={() => {
              setFilterSubject('');
              setFilterStatus('');
              setFilterDate('');
            }}
            className="text-xs text-zinc-400 hover:text-white underline ml-auto font-sub"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Record Timeline */}
      {filteredRecords.length === 0 ? (
        <div className="p-12 rounded-3xl liquid-glass-card text-center space-y-2">
          <Calendar className="w-10 h-10 text-zinc-500 mx-auto" />
          <h4 className="text-base font-bold text-white font-sans">No records found</h4>
          <p className="text-xs text-zinc-400 font-sub font-light">
            Try adjusting your search filters to find historical sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRecords.map((r) => {
            const isPresent = r.status === 'PRESENT';
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl liquid-glass-card border border-white/[0.06] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isPresent
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isPresent ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs font-bold text-white">
                        {r.subjectCode}
                      </span>
                      <span className="text-xs font-bold text-white font-sans">{r.subjectName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5 font-sub font-light">
                      <span>{r.date}</span>
                      {r.startTime && (
                        <span>
                          {r.startTime} - {r.endTime}
                        </span>
                      )}
                      {r.remarks && <span className="italic text-zinc-500">• {r.remarks}</span>}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-xs font-sub font-medium px-2.5 py-1 rounded-full ${
                    isPresent
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
