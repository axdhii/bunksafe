import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Trash2, Edit2, AlertTriangle, Sparkles, Filter } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { PageHeader } from '../../components/common/PageHeader';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSec, setFilterSec] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Form State
  const [formUsn, setFormUsn] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSemId, setFormSemId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');
  const [formSecId, setFormSecId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [sRes, semRes, bRes, secRes] = await Promise.all([
        apiRequest<{ students: any[] }>('/academic/students'),
        apiRequest<{ semesters: any[] }>('/academic/semesters'),
        apiRequest<{ branches: any[] }>('/academic/branches'),
        apiRequest<{ sections: any[] }>('/academic/sections'),
      ]);
      setStudents(sRes.students || []);
      setSemesters(semRes.semesters || []);
      setBranches(bRes.branches || []);
      setSections(secRes.sections || []);

      if (semRes.semesters?.length > 0) setFormSemId(semRes.semesters[0].id);
      if (bRes.branches?.length > 0) setFormBranchId(bRes.branches[0].id);
      if (secRes.sections?.length > 0) setFormSecId(secRes.sections[0].id);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/academic/students', {
        method: 'POST',
        data: {
          usn: formUsn,
          name: formName,
          email: formEmail || undefined,
          semesterId: formSemId,
          branchId: formBranchId,
          sectionId: formSecId,
        },
      });
      setShowAddModal(false);
      setFormUsn('');
      setFormName('');
      setFormEmail('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create student.');
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await apiRequest(`/academic/students/${editingStudent.id}`, {
        method: 'PUT',
        data: {
          name: formName,
          email: formEmail || undefined,
          semesterId: formSemId,
          branchId: formBranchId,
          sectionId: formSecId,
        },
      });
      setEditingStudent(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update student.');
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/academic/students/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    }
  };

  const openEdit = (st: any) => {
    setEditingStudent(st);
    setFormUsn(st.usn);
    setFormName(st.name);
    setFormEmail(st.email || '');
    setFormSemId(st.semesterId);
    setFormBranchId(st.branchId);
    setFormSecId(st.sectionId);
  };

  const filteredStudents = students.filter((st) => {
    if (filterSem && st.semesterId !== filterSem) return false;
    if (filterBranch && st.branchId !== filterBranch) return false;
    if (filterSec && st.sectionId !== filterSec) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchUsn = st.usn?.toLowerCase().includes(term);
      const matchName = st.name?.toLowerCase().includes(term);
      const matchEmail = st.email?.toLowerCase().includes(term);
      if (!matchUsn && !matchName && !matchEmail) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading student registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Roster Governance"
        title="Student Management"
        subtitle="Search, filter, enroll and assign students to semesters, branches, and sections"
        actions={
          <button
            onClick={() => {
              setFormUsn('');
              setFormName('');
              setFormEmail('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-black font-bold font-sans text-xs hover:bg-zinc-200 active:scale-95 transition-all w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll New Student</span>
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl liquid-glass-card flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by USN, Name, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white font-sans"
          />
        </div>

        <select
          value={filterSem}
          onChange={(e) => setFilterSem(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none"
        >
          <option value="">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id} className="bg-slate-900 text-white">
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id} className="bg-slate-900 text-white">
              {b.code}
            </option>
          ))}
        </select>

        <select
          value={filterSec}
          onChange={(e) => setFilterSec(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white focus:outline-none"
        >
          <option value="">All Sections</option>
          {sections.map((sec) => (
            <option key={sec.id} value={sec.id} className="bg-slate-900 text-white">
              Sec {sec.name}
            </option>
          ))}
        </select>

        {(searchTerm || filterSem || filterBranch || filterSec) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterSem('');
              setFilterBranch('');
              setFilterSec('');
            }}
            className="text-xs text-slate-400 hover:text-white underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Student Registry Table */}
      <div className="liquid-glass-card rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-white/[0.02] border-b border-white/10">
              <tr>
                <th className="py-3 px-4">USN</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No students match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-white">{st.usn}</td>
                    <td className="py-3 px-4 font-semibold text-white font-sans">{st.name}</td>
                    <td className="py-3 px-4 text-zinc-400 font-sub">{st.email || '—'}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">Sem {st.semester?.number}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">{st.branch?.code}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sub">{st.section?.name}</td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(st)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        title="Edit Student"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(st)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                        title="Delete Student"
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

      {/* Modal Enroll Student */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Enroll Student">
        <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">USN (Unique)</label>
            <input
              type="text"
              required
              placeholder="1MS21CS001"
              value={formUsn}
              onChange={(e) => setFormUsn(e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="Aarav Sharma"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="student@college.edu"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
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
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Section</label>
              <select
                value={formSecId}
                onChange={(e) => setFormSecId(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
              >
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
            className="w-full mt-2 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
          >
            Confirm Enrolment
          </button>
        </form>
      </Modal>

      {/* Modal Edit Student */}
      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit Student Profile">
        <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-400 mb-1">USN (Immutable)</label>
            <input
              type="text"
              disabled
              value={formUsn}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
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
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Section</label>
              <select
                value={formSecId}
                onChange={(e) => setFormSecId(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
              >
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
            className="w-full mt-2 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all font-sans"
          >
            Save Changes
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Student Removal">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">
                You are about to delete student {deleteTarget?.usn} ({deleteTarget?.name})
              </p>
              <p className="mt-1 text-slate-300">
                This will permanently remove the student's account and all associated attendance records. This action cannot be reversed.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteStudent}
              className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600"
            >
              Confirm Deletion
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
