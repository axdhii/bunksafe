import React, { useState, useEffect } from 'react';
import { Settings, Shield, Check, Sparkles, History } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';

export const AdminSettings: React.FC = () => {
  const [threshold, setThreshold] = useState('85.0');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadSettingsAndLogs = async () => {
      try {
        const [setRes, logsRes] = await Promise.all([
          apiRequest<{ settings: any[]; academicYears: any[] }>('/academic/settings'),
          apiRequest<{ logs: any[] }>('/academic/audit-logs'),
        ]);

        const thresh = setRes.settings?.find((s: any) => s.key === 'MINIMUM_ATTENDANCE_THRESHOLD');
        if (thresh) setThreshold(thresh.value);
        setAcademicYears(setRes.academicYears || []);
        setAuditLogs(logsRes.logs || []);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettingsAndLogs();
  }, []);

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/academic/settings', {
        method: 'PUT',
        data: {
          key: 'MINIMUM_ATTENDANCE_THRESHOLD',
          value: threshold,
          description: 'Minimum required attendance percentage across all courses',
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading system governance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Institutional Governance"
        title="System Settings & Audit Trail"
        subtitle="Manage system-wide minimum thresholds, academic years, and inspect administrative audit logs"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Threshold Setting */}
        <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-sans">
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>Attendance Threshold Policy</span>
          </h3>
          <p className="text-xs text-zinc-400 font-sub font-light">
            This percentage defines the institutional benchmark. Calculations across all student dashboards adjust dynamically.
          </p>

          <form onSubmit={handleSaveThreshold} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Minimum Required Attendance (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="50"
                max="100"
                required
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Policy updated!
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-bold font-sans text-xs ml-auto hover:bg-zinc-200 active:scale-95 transition-all"
              >
                {saving ? 'Updating...' : 'Update Threshold'}
              </button>
            </div>
          </form>
        </div>

        {/* Academic Years */}
        <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-sans">
            <Shield className="w-4 h-4 text-white" />
            <span>Academic Years</span>
          </h3>
          <p className="text-xs text-zinc-400 font-sub font-light">
            Active academic term for timetable and enrollment bindings
          </p>

          <div className="space-y-2">
            {academicYears.map((ay) => (
              <div
                key={ay.id}
                className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-white font-sans">{ay.name}</div>
                  <div className="text-xs text-zinc-400 font-sub font-light">
                    {new Date(ay.startDate).toLocaleDateString()} —{' '}
                    {new Date(ay.endDate).toLocaleDateString()}
                  </div>
                </div>
                {ay.isCurrent && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20 font-sub font-medium">
                    Current Term
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white font-sans">Administrative Audit Log</h3>
          <p className="text-xs text-zinc-400 font-sub font-light">Security and data modification trail</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-sub">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500 font-sub">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 text-[11px] font-sub">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-white font-sans">{log.actorEmail}</td>
                    <td className="py-2 px-3 text-white font-bold font-sans">{log.action}</td>
                    <td className="py-2 px-3 text-zinc-300 font-sub">{log.targetEntity || '—'}</td>
                    <td className="py-2 px-3 text-zinc-400 text-[11px] truncate max-w-xs font-sub font-light">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
