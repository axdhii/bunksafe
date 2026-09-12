import React, { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen, AlertTriangle, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { PageHeader } from '../../components/common/PageHeader';

export const AdminAcademicStructure: React.FC = () => {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddSem, setShowAddSem] = useState(false);
  const [newSemNum, setNewSemNum] = useState<number>(1);
  const [newSemName, setNewSemName] = useState('');

  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSecName, setNewSecName] = useState('A');
  const [selectedSemId, setSelectedSemId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const loadAll = async () => {
    try {
      const [sRes, bRes, secRes] = await Promise.all([
        apiRequest<{ semesters: any[] }>('/academic/semesters'),
        apiRequest<{ branches: any[] }>('/academic/branches'),
        apiRequest<{ sections: any[] }>('/academic/sections'),
      ]);
      setSemesters(sRes.semesters || []);
      setBranches(bRes.branches || []);
      setSections(secRes.sections || []);
      if (sRes.semesters?.length > 0) setSelectedSemId(sRes.semesters[0].id);
      if (bRes.branches?.length > 0) setSelectedBranchId(bRes.branches[0].id);
    } catch (err) {
      console.error('Failed to load academic structure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/semesters', {
        method: 'POST',
        data: { number: newSemNum, name: newSemName || `Semester ${newSemNum}` },
      });
      setShowAddSem(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create semester.');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/branches', {
        method: 'POST',
        data: { code: newBranchCode, name: newBranchName },
      });
      setShowAddBranch(false);
      setNewBranchCode('');
      setNewBranchName('');
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create branch.');
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/sections', {
        method: 'POST',
        data: { name: newSecName, semesterId: selectedSemId, branchId: selectedBranchId },
      });
      setShowAddSection(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create section.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      let endpoint = '';
      if (deleteTarget.type === 'semester') endpoint = `/academic/semesters/${deleteTarget.id}`;
      else if (deleteTarget.type === 'branch') endpoint = `/academic/branches/${deleteTarget.id}`;
      else if (deleteTarget.type === 'section') endpoint = `/academic/sections/${deleteTarget.id}`;

      await apiRequest(endpoint, { method: 'DELETE' });
      setDeleteTarget(null);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Cannot delete item with linked records.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading academic structure...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Institutional Hierarchy"
        title="Academic Structure"
        subtitle="Configure dynamic academic trees: Semesters, Branches, and Sections"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Semesters Column */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-sans">Semesters</h3>
              <p className="text-xs text-zinc-400 font-sub font-light">{semesters.length} configured</p>
            </div>
            <button
              onClick={() => setShowAddSem(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {semesters.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-sm text-white font-sans">{s.name}</span>
                  <span className="text-xs text-zinc-400 ml-2 font-sub">(Num: {s.number})</span>
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: 'semester', id: s.id, name: s.name })}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Branches Column */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-sans">Branches / Departments</h3>
              <p className="text-xs text-zinc-400 font-sub font-light">{branches.length} configured</p>
            </div>
            <button
              onClick={() => setShowAddBranch(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {branches.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
              >
                <div>
                  <span className="font-sans font-bold text-white text-sm">{b.code}</span>
                  <div className="text-xs text-zinc-300 truncate max-w-[170px] font-sub font-light">{b.name}</div>
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: 'branch', id: b.id, name: b.code })}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Sections Column */}
        <div className="p-5 rounded-3xl liquid-glass-card border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-sans">Sections</h3>
              <p className="text-xs text-zinc-400 font-sub font-light">{sections.length} configured</p>
            </div>
            <button
              onClick={() => setShowAddSection(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-sm text-white font-sans">Section {sec.name}</span>
                  <div className="text-xs text-zinc-400 font-sub font-light">
                    {sec.branch?.code} • Sem {sec.semester?.number}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: 'section', id: sec.id, name: sec.name })}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Add Semester */}
      <Modal isOpen={showAddSem} onClose={() => setShowAddSem(false)} title="Add New Semester">
        <form onSubmit={handleCreateSemester} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Semester Number (1-8)</label>
            <input
              type="number"
              min={1}
              max={8}
              required
              value={newSemNum}
              onChange={(e) => setNewSemNum(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-sans"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Display Name</label>
            <input
              type="text"
              placeholder={`Semester ${newSemNum}`}
              value={newSemName}
              onChange={(e) => setNewSemName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-sans"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
          >
            Create Semester
          </button>
        </form>
      </Modal>

      {/* Modal Add Branch */}
      <Modal isOpen={showAddBranch} onClose={() => setShowAddBranch(false)} title="Add New Branch / Dept">
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Branch Code (e.g. CSE)</label>
            <input
              type="text"
              required
              value={newBranchCode}
              onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-sans uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Full Department Name</label>
            <input
              type="text"
              required
              placeholder="Computer Science & Engineering"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-sans"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
          >
            Create Branch
          </button>
        </form>
      </Modal>

      {/* Modal Add Section */}
      <Modal isOpen={showAddSection} onClose={() => setShowAddSection(false)} title="Add New Section">
        <form onSubmit={handleCreateSection} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Section Name (e.g. A, B, C)</label>
            <input
              type="text"
              required
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-sans uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Semester</label>
            <select
              value={selectedSemId}
              onChange={(e) => setSelectedSemId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white text-xs font-sub"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 font-sub">Branch</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white text-xs font-sub"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
          >
            Create Section
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Safety Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Are you sure you want to remove <span className="font-bold text-white">{deleteTarget?.name}</span>? This action cannot be undone if it has linked student or timetable records.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
