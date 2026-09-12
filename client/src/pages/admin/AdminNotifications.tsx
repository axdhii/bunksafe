import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, AlertTriangle, Users, BookOpen, Clock, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';

export const AdminNotifications: React.FC = () => {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetSem, setTargetSem] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [targetSec, setTargetSec] = useState('');
  const [sending, setSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadAcademicOptions = async () => {
      try {
        const [semRes, bRes, secRes] = await Promise.all([
          apiRequest<{ semesters: any[] }>('/academic/semesters'),
          apiRequest<{ branches: any[] }>('/academic/branches'),
          apiRequest<{ sections: any[] }>('/academic/sections'),
        ]);
        setSemesters(semRes.semesters || []);
        setBranches(bRes.branches || []);
        setSections(secRes.sections || []);
      } catch (err) {
        console.error('Failed to load options:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAcademicOptions();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSuccessNotice(null);

    try {
      const res = await apiRequest('/notifications/broadcast', {
        method: 'POST',
        data: {
          title,
          message,
          semesterId: targetSem || undefined,
          branchId: targetBranch || undefined,
          sectionId: targetSec || undefined,
        },
      });
      setSuccessNotice(`Successfully broadcasted announcement to ${res.count} students!`);
      setTitle('');
      setMessage('');
    } catch (err: any) {
      alert(err.message || 'Failed to broadcast announcement.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading announcement console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-4xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Institutional Announcements"
        title="Broadcast Announcements"
        subtitle="Dispatch official announcements and critical attendance circulars to student devices"
      />

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2 font-sub">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">{successNotice}</span>
        </div>
      )}

      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10">
        <form onSubmit={handleBroadcast} className="space-y-4 text-xs font-sub">
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Announcement Headline</label>
            <input
              type="text"
              required
              placeholder="e.g. Midterm Attendance Audit Notice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-sans"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 mb-1">Detailed Message Content</label>
            <textarea
              rows={4}
              required
              placeholder="Provide complete circular details, deadlines, and corrective actions..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-sans"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Target Semester (Optional)</label>
              <select
                value={targetSem}
                onChange={(e) => setTargetSem(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white font-sans"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Target Branch (Optional)</label>
              <select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white font-sans"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Target Section (Optional)</label>
              <select
                value={targetSec}
                onChange={(e) => setTargetSec(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white font-sans"
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Sec {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full mt-3 py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center gap-2 font-sans"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Broadcasting...' : 'Broadcast Announcement to Students'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
