import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Search, Trash2, Edit2, AlertTriangle, Sparkles, Filter, Percent } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { PageHeader } from '../../components/common/PageHeader';

export const AdminSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCredits, setFormCredits] = useState(4);
  const [formThreshold, setFormThreshold] = useState(85.0);
  const [formSemId, setFormSemId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [subRes, semRes, bRes] = await Promise.all([
        apiRequest<{ subjects: any[] }>('/academic/subjects'),
        apiRequest<{ semesters: any[] }>('/academic/semesters'),
        apiRequest<{ branches: any[] }>('/academic/branches'),
      ]);
      setSubjects(subRes.subjects || []);
      setSemesters(semRes.semesters || []);
      setBranches(bRes.branches || []);

      if (semRes.semesters?.length > 0) setFormSemId(semRes.semesters[0].id);
      if (bRes.branches?.length > 0) setFormBranchId(bRes.branches[0].id);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/subjects', {
        method: 'POST',
        data: {
          code: formCode,
          name: formName,
          credits: formCredits,
          minimumThreshold: formThreshold,
          semesterId: formSemId,
          branchId: formBranchId,
        },
      });
      setShowAddModal(false);
      setFormCode('');
      setFormName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create subject.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    try {
      await apiRequest(`/academic/subjects/${editingSub.id}`, {
        method: 'PUT',
        data: {
          name: formName,
          credits: formCredits,
          minimumThreshold: formThreshold,
        },
      });
      setEditingSub(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update subject.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/academic/subjects/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Cannot delete subject with existing timetable or attendance entries.');
    }
  };

  const openEdit = (sub: any) => {
    setEditingSub(sub);
    setFormCode(sub.code);
    setFormName(sub.name);
    setFormCredits(sub.credits);
    setFormThreshold(sub.minimumThreshold);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading curriculum subjects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Curriculum Matrix"
        title="Subject Management"
        subtitle="Configure course codes, credit weightings, and customized minimum attendance thresholds"
        actions={
          <button
            onClick={() => {
              setFormCode('');
              setFormName('');
              setFormCredits(4);
              setFormThreshold(85.0);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-black font-bold font-sans text-xs hover:bg-zinc-200 active:scale-95 transition-all w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course / Subject</span>
          </button>
        }
      />

      {/* Subjects Table */}
      <div className="liquid-glass-card rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-white/[0.02] border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Subject Code</th>
                <th className="py-3 px-4">Subject Title</th>
                <th className="py-3 px-4">Credits</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Threshold</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No subjects defined yet.
                  </td>
                </tr>
              ) : (
                subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-white">{sub.code}</td>
                    <td className="py-3 px-4 font-semibold text-white font-sans">{sub.name}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">{sub.credits}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">Sem {sub.semester?.number}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">{sub.branch?.code}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sans font-bold">
                      {sub.minimumThreshold}%
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(sub)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
                        title="Edit Subject"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Subject */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Subject">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Subject Code</label>
            <input
              type="text"
              required
              placeholder="e.g. 21CS51"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Subject Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Database Management Systems"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Credits</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={formCredits}
                onChange={(e) => setFormCredits(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Min Threshold (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                step={0.5}
                required
                value={formThreshold}
                onChange={(e) => setFormThreshold(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Semester</label>
              <select
                value={formSemId}
                onChange={(e) => setFormSemId(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Branch</label>
              <select
                value={formBranchId}
                onChange={(e) => setFormBranchId(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 rounded-xl bg-white text-black font-bold font-sans text-xs hover:bg-zinc-200 transition-all"
          >
            Create Subject
          </button>
        </form>
      </Modal>

      {/* Modal Edit Subject */}
      <Modal isOpen={!!editingSub} onClose={() => setEditingSub(null)} title="Edit Subject">
        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-400 mb-1">Subject Code (Fixed)</label>
            <input
              type="text"
              disabled
              value={formCode}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Subject Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Credits</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={formCredits}
                onChange={(e) => setFormCredits(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Min Threshold (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                step={0.5}
                required
                value={formThreshold}
                onChange={(e) => setFormThreshold(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 rounded-xl bg-white text-black font-bold font-sans text-xs hover:bg-zinc-200 transition-all"
          >
            Save Subject Changes
          </button>
        </form>
      </Modal>

      {/* Delete Target Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Course Subject">
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <p className="font-bold text-white">
              Delete {deleteTarget?.code} ({deleteTarget?.name})?
            </p>
            <p className="mt-1">
              Ensure there are no scheduled timetable slots or existing student attendance marks for this course.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
