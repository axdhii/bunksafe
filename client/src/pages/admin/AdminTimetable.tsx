import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Coffee,
  Utensils,
  Clock,
  BookOpen,
  CheckCircle2,
  Layers,
  Save,
  Grid,
  Copy,
  ChevronRight,
  Users,
  Check,
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';
import { DayReplicatorModal } from '../../components/common/DayReplicatorModal';

export interface DaySlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: 'LECTURE' | 'LAB' | 'TUTORIAL' | 'INTERVAL' | 'LUNCH' | 'BREAK';
  title?: string;
  // Standard (non-split)
  subjectId?: string;
  faculty?: string;
  room?: string;
  batch?: 'ALL' | 'B1' | 'B2';
  // Parallel split batch lab
  isSplitBatch?: boolean;
  batch1?: {
    subjectId: string;
    faculty?: string;
    room?: string;
  };
  batch2?: {
    subjectId: string;
    faculty?: string;
    room?: string;
  };
}

export interface DaySchedule {
  dayOfWeek: number; // 1 = Mon ... 6 = Sat
  name: string;
  shortName: string;
  slots: DaySlot[];
}

const INITIAL_DAYS: { dayOfWeek: number; name: string; shortName: string }[] = [
  { dayOfWeek: 1, name: 'Monday', shortName: 'Mon' },
  { dayOfWeek: 2, name: 'Tuesday', shortName: 'Tue' },
  { dayOfWeek: 3, name: 'Wednesday', shortName: 'Wed' },
  { dayOfWeek: 4, name: 'Thursday', shortName: 'Thu' },
  { dayOfWeek: 5, name: 'Friday', shortName: 'Fri' },
  { dayOfWeek: 6, name: 'Saturday', shortName: 'Sat' },
];

function timeToMins(t: string): number {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToTime(m: number): string {
  const total = Math.max(0, m % 1440);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getDurationBadge(start: string, end: string): string {
  const diff = timeToMins(end) - timeToMins(start);
  if (diff <= 0) return '0 min';
  if (diff < 60) return `${diff} min`;
  const h = Math.floor(diff / 60);
  const rem = diff % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export const AdminTimetable: React.FC = () => {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cohort Selection
  const [selectedSemId, setSelectedSemId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedSecId, setSelectedSecId] = useState('');

  // Active View: 'day' (Timeline Builder) or 'matrix' (Weekly Grid)
  const [viewMode, setViewMode] = useState<'day' | 'matrix'>('day');
  const [activeDayOfWeek, setActiveDayOfWeek] = useState<number>(1);

  // Day Schedules (Clean-slate, zero forced presets)
  const [days, setDays] = useState<DaySchedule[]>(() =>
    INITIAL_DAYS.map((d) => ({
      ...d,
      slots: [],
    }))
  );

  // Replicator Modal State
  const [replicatorOpen, setReplicatorOpen] = useState(false);

  // Status & Saving State
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load academic metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [semRes, bRes, secRes] = await Promise.all([
          apiRequest<{ semesters: any[] }>('/academic/semesters'),
          apiRequest<{ branches: any[] }>('/academic/branches'),
          apiRequest<{ sections: any[] }>('/academic/sections'),
        ]);
        setSemesters(semRes.semesters || []);
        setBranches(bRes.branches || []);
        setSections(secRes.sections || []);

        if (semRes.semesters?.length > 0) setSelectedSemId(semRes.semesters[0].id);
        if (bRes.branches?.length > 0) setSelectedBranchId(bRes.branches[0].id);
        if (secRes.sections?.length > 0) setSelectedSecId(secRes.sections[0].id);
      } catch (err) {
        console.error('Failed to load academic data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMetadata();
  }, []);

  // Fetch subjects whenever semester/branch changes
  useEffect(() => {
    if (!selectedSemId || !selectedBranchId) return;
    const fetchSubjects = async () => {
      try {
        const res = await apiRequest<{ subjects: any[] }>(
          `/academic/subjects?semesterId=${selectedSemId}&branchId=${selectedBranchId}`
        );
        setSubjects(res.subjects || []);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      }
    };
    fetchSubjects();
  }, [selectedSemId, selectedBranchId]);

  // Load existing section timetable into clean dynamic days
  const fetchSectionTimetable = async () => {
    if (!selectedSemId || !selectedBranchId || !selectedSecId) return;
    try {
      const res = await apiRequest<{ entries: any[] }>(
        `/timetable/section?semesterId=${selectedSemId}&branchId=${selectedBranchId}&sectionId=${selectedSecId}`
      );

      const newDays: DaySchedule[] = INITIAL_DAYS.map((d) => {
        const dayEntries = (res.entries || [])
          .filter((e) => e.dayOfWeek === d.dayOfWeek)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        const groupedSlots: DaySlot[] = [];
        const processedIds = new Set<string>();

        dayEntries.forEach((entry) => {
          if (processedIds.has(entry.id)) return;

          const partner = dayEntries.find(
            (other) =>
              other.id !== entry.id &&
              !processedIds.has(other.id) &&
              other.startTime === entry.startTime &&
              other.endTime === entry.endTime &&
              ((entry.batch === 'B1' && other.batch === 'B2') ||
                (entry.batch === 'B2' && other.batch === 'B1'))
          );

          if (partner) {
            processedIds.add(entry.id);
            processedIds.add(partner.id);

            const b1Entry = entry.batch === 'B1' ? entry : partner;
            const b2Entry = entry.batch === 'B2' ? entry : partner;

            groupedSlots.push({
              id: `slot-${entry.id}-${partner.id}`,
              name: `Lab / Period`,
              startTime: entry.startTime,
              endTime: entry.endTime,
              type: entry.type === 'LAB' ? 'LAB' : 'LECTURE',
              isSplitBatch: true,
              batch1: {
                subjectId: b1Entry.subjectId || '',
                faculty: b1Entry.faculty || '',
                room: b1Entry.room || '',
              },
              batch2: {
                subjectId: b2Entry.subjectId || '',
                faculty: b2Entry.faculty || '',
                room: b2Entry.room || '',
              },
            });
          } else {
            processedIds.add(entry.id);
            const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(entry.type);
            groupedSlots.push({
              id: `slot-${entry.id}`,
              name: isBreak
                ? entry.title || (entry.type === 'LUNCH' ? 'Lunch Break' : 'Tea Break')
                : `Period ${groupedSlots.length + 1}`,
              startTime: entry.startTime,
              endTime: entry.endTime,
              type: entry.type as any,
              title: entry.title || undefined,
              subjectId: entry.subjectId || undefined,
              faculty: entry.faculty || undefined,
              room: entry.room || undefined,
              batch: entry.batch || 'ALL',
            });
          }
        });

        return {
          ...d,
          slots: groupedSlots,
        };
      });

      setDays(newDays);
    } catch (err) {
      console.error('Failed to load timetable:', err);
    }
  };

  useEffect(() => {
    fetchSectionTimetable();
  }, [selectedSemId, selectedBranchId, selectedSecId]);

  const activeDay = useMemo(
    () => days.find((d) => d.dayOfWeek === activeDayOfWeek) || days[0],
    [days, activeDayOfWeek]
  );

  const subjectHourCounts = useMemo(() => {
    const counts: { [subjectId: string]: number } = {};
    days.forEach((d) => {
      d.slots.forEach((s) => {
        const durHours = Math.max(1, Math.round((timeToMins(s.endTime) - timeToMins(s.startTime)) / 60));
        if (s.isSplitBatch) {
          if (s.batch1?.subjectId) counts[s.batch1.subjectId] = (counts[s.batch1.subjectId] || 0) + durHours;
          if (s.batch2?.subjectId) counts[s.batch2.subjectId] = (counts[s.batch2.subjectId] || 0) + durHours;
        } else if (s.subjectId) {
          counts[s.subjectId] = (counts[s.subjectId] || 0) + durHours;
        }
      });
    });
    return counts;
  }, [days]);

  const handleAddSlot = (
    type: 'LECTURE' | 'LAB' | 'TUTORIAL' | 'INTERVAL' | 'LUNCH' | 'BREAK',
    defaultDurationMinutes: number = 60
  ) => {
    setDays((prevDays) =>
      prevDays.map((d) => {
        if (d.dayOfWeek !== activeDayOfWeek) return d;

        let nextStart = '09:00';
        let defaultName = 'Period 1';

        if (d.slots.length > 0) {
          const lastSlot = d.slots[d.slots.length - 1];
          nextStart = lastSlot.endTime;
          const classSlotCount = d.slots.filter(
            (s) => !['INTERVAL', 'LUNCH', 'BREAK'].includes(s.type)
          ).length;
          defaultName = `Period ${classSlotCount + 1}`;
        }

        const nextEnd = minsToTime(timeToMins(nextStart) + defaultDurationMinutes);
        const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(type);

        const newSlot: DaySlot = {
          id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: isBreak
            ? type === 'LUNCH'
              ? 'Lunch Break'
              : type === 'INTERVAL'
              ? 'Tea Break'
              : 'Break'
            : defaultName,
          startTime: nextStart,
          endTime: nextEnd,
          type,
          title: isBreak
            ? type === 'LUNCH'
              ? 'Lunch Break'
              : type === 'INTERVAL'
              ? 'Tea / Short Interval'
              : 'Custom Break'
            : undefined,
          batch: 'ALL',
          isSplitBatch: type === 'LAB',
          batch1: type === 'LAB' ? { subjectId: '', room: '', faculty: '' } : undefined,
          batch2: type === 'LAB' ? { subjectId: '', room: '', faculty: '' } : undefined,
        };

        return {
          ...d,
          slots: [...d.slots, newSlot],
        };
      })
    );
  };

  const handleUpdateSlot = (slotId: string, updates: Partial<DaySlot>) => {
    setDays((prevDays) =>
      prevDays.map((d) => {
        if (d.dayOfWeek !== activeDayOfWeek) return d;
        return {
          ...d,
          slots: d.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
        };
      })
    );
  };

  const handleAdjustDuration = (slotId: string, deltaMinutes: number, rippleLater: boolean = true) => {
    setDays((prevDays) =>
      prevDays.map((d) => {
        if (d.dayOfWeek !== activeDayOfWeek) return d;

        const slotIndex = d.slots.findIndex((s) => s.id === slotId);
        if (slotIndex === -1) return d;

        const targetSlot = d.slots[slotIndex];
        const curStart = timeToMins(targetSlot.startTime);
        const curEnd = timeToMins(targetSlot.endTime);
        const newEndMins = Math.max(curStart + 15, curEnd + deltaMinutes);
        const actualDelta = newEndMins - curEnd;

        const updatedSlots = d.slots.map((s, idx) => {
          if (idx === slotIndex) {
            return { ...s, endTime: minsToTime(newEndMins) };
          }
          if (rippleLater && idx > slotIndex) {
            const sStart = timeToMins(s.startTime) + actualDelta;
            const sEnd = timeToMins(s.endTime) + actualDelta;
            return {
              ...s,
              startTime: minsToTime(sStart),
              endTime: minsToTime(sEnd),
            };
          }
          return s;
        });

        return { ...d, slots: updatedSlots };
      })
    );
  };

  const handleDeleteSlot = (slotId: string) => {
    setDays((prevDays) =>
      prevDays.map((d) => {
        if (d.dayOfWeek !== activeDayOfWeek) return d;
        return {
          ...d,
          slots: d.slots.filter((s) => s.id !== slotId),
        };
      })
    );
  };

  const handleClearDay = () => {
    if (!window.confirm(`Clear all periods for ${activeDay.name}?`)) return;
    setDays((prevDays) =>
      prevDays.map((d) => (d.dayOfWeek === activeDayOfWeek ? { ...d, slots: [] } : d))
    );
  };

  const handleReplicateDay = (targetDays: number[], copySubjects: boolean) => {
    const sourceSlots = activeDay.slots;
    setDays((prevDays) =>
      prevDays.map((d) => {
        if (!targetDays.includes(d.dayOfWeek)) return d;
        const clonedSlots: DaySlot[] = sourceSlots.map((s, idx) => ({
          ...s,
          id: `slot-cloned-${Date.now()}-${d.dayOfWeek}-${idx}`,
          subjectId: copySubjects ? s.subjectId : '',
          faculty: copySubjects ? s.faculty : '',
          room: copySubjects ? s.room : '',
          batch1: s.isSplitBatch
            ? {
                subjectId: copySubjects ? s.batch1?.subjectId || '' : '',
                faculty: copySubjects ? s.batch1?.faculty || '' : '',
                room: copySubjects ? s.batch1?.room || '' : '',
              }
            : undefined,
          batch2: s.isSplitBatch
            ? {
                subjectId: copySubjects ? s.batch2?.subjectId || '' : '',
                faculty: copySubjects ? s.batch2?.faculty || '' : '',
                room: copySubjects ? s.batch2?.room || '' : '',
              }
            : undefined,
        }));
        return {
          ...d,
          slots: clonedSlots,
        };
      })
    );
    setStatusMessage({
      type: 'success',
      text: `Successfully replicated ${activeDay.name}'s structure to ${targetDays.length} day(s)!`,
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const entriesToSave: any[] = [];

      days.forEach((day) => {
        day.slots.forEach((slot) => {
          const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(slot.type);

          if (isBreak) {
            entriesToSave.push({
              dayOfWeek: day.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              type: slot.type,
              title: slot.title || slot.name,
              batch: 'ALL',
            });
          } else if (slot.isSplitBatch) {
            if (slot.batch1?.subjectId) {
              entriesToSave.push({
                dayOfWeek: day.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                type: slot.type || 'LAB',
                batch: 'B1',
                subjectId: slot.batch1.subjectId,
                room: slot.batch1.room || null,
                faculty: slot.batch1.faculty || null,
              });
            }
            if (slot.batch2?.subjectId) {
              entriesToSave.push({
                dayOfWeek: day.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                type: slot.type || 'LAB',
                batch: 'B2',
                subjectId: slot.batch2.subjectId,
                room: slot.batch2.room || null,
                faculty: slot.batch2.faculty || null,
              });
            }
          } else if (slot.subjectId) {
            entriesToSave.push({
              dayOfWeek: day.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              type: slot.type || 'LECTURE',
              batch: slot.batch || 'ALL',
              subjectId: slot.subjectId,
              room: slot.room || null,
              faculty: slot.faculty || null,
            });
          }
        });
      });

      await apiRequest('/timetable/confirm-import', {
        method: 'POST',
        data: {
          sectionId: selectedSecId,
          semesterId: selectedSemId,
          branchId: selectedBranchId,
          entries: entriesToSave,
        },
      });

      setStatusMessage({
        type: 'success',
        text: `Timetable saved successfully (${entriesToSave.length} total active slots configured)!`,
      });
      fetchSectionTimetable();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to save timetable.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-xs text-zinc-400 font-sub">Loading Timetable Orchestrator...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-[98rem] mx-auto px-4 sm:px-6 pt-4 font-sans">
      {/* Header */}
      <PageHeader
        category="Admin Control Center"
        title="Dynamic Timetable Orchestrator"
        subtitle="100% customizable schedule builder. Define each day, every period, custom breaks, and parallel batch-split labs with zero rigid templates."
        actions={
          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 rounded-2xl liquid-glass border border-white/10">
              <button
                onClick={() => setViewMode('day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'day'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Day Timeline</span>
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Weekly Grid</span>
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
            >
              {saving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Schedule'}</span>
            </button>
          </div>
        }
      />

      {/* Cohort Selector Bar */}
      <div className="p-4 rounded-3xl liquid-glass-card flex flex-wrap items-center justify-between gap-4 border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-sub uppercase tracking-wider text-zinc-400">Target Cohort:</span>

          <select
            value={selectedSemId}
            onChange={(e) => setSelectedSemId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white outline-none focus:border-white/30"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white outline-none focus:border-white/30"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSecId}
            onChange={(e) => setSelectedSecId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white outline-none focus:border-white/30"
          >
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                Section {sec.name}
              </option>
            ))}
          </select>
        </div>

        {/* Replicate Tool Trigger */}
        {viewMode === 'day' && activeDay.slots.length > 0 && (
          <button
            onClick={() => setReplicatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-xs font-semibold text-zinc-200 transition-all active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Replicate {activeDay.name} to Other Days</span>
          </button>
        )}
      </div>

      {/* Live Status Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-2 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* SUBJECT CREDIT ALLOCATION PILL BAR */}
      {subjects.length > 0 && (
        <div className="p-3.5 rounded-2xl liquid-glass border border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-[11px] font-sub uppercase tracking-wider text-zinc-500 shrink-0 mr-1">
            Weekly Hours Tracked:
          </span>
          {subjects.map((sub) => {
            const scheduled = subjectHourCounts[sub.id] || 0;
            const target = sub.credits || 4;
            const isFilled = scheduled >= target;
            return (
              <div
                key={sub.id}
                className={`px-3 py-1 rounded-xl border shrink-0 flex items-center gap-2 font-mono text-[11px] transition-all ${
                  isFilled
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : scheduled > 0
                    ? 'bg-white/[0.08] border-white/15 text-white'
                    : 'bg-white/[0.02] border-white/5 text-zinc-500'
                }`}
              >
                <span className="font-semibold">{sub.code}</span>
                <span className="text-zinc-600">•</span>
                <span className="font-sub">
                  {scheduled} / {target} hrs
                </span>
                {isFilled && <Check className="w-3 h-3 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 1: DAY TIMELINE BUILDER */}
      {viewMode === 'day' && (
        <div className="space-y-5">
          {/* Day Navigation Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-2">
              {days.map((d) => {
                const isSelected = d.dayOfWeek === activeDayOfWeek;
                const slotCount = d.slots.length;
                return (
                  <button
                    key={d.dayOfWeek}
                    onClick={() => setActiveDayOfWeek(d.dayOfWeek)}
                    className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{d.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                        isSelected ? 'bg-black text-white' : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {slotCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeDay.slots.length > 0 && (
              <button
                onClick={handleClearDay}
                className="text-xs text-zinc-500 hover:text-rose-400 transition-colors px-2 py-1 shrink-0 font-sub"
              >
                Clear Day
              </button>
            )}
          </div>

          {/* Day Slots List */}
          {activeDay.slots.length === 0 ? (
            <div className="p-12 rounded-3xl liquid-glass-card text-center space-y-4 border border-dashed border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-300">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No periods scheduled for {activeDay.name}</h3>
                <p className="text-xs text-zinc-400 font-sub max-w-md mx-auto mt-1">
                  Start fresh with your college's exact timing. Click below to add your first period, break, or lab.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleAddSlot('LECTURE', 60)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add First Period (Lecture)</span>
                </button>
                <button
                  onClick={() => handleAddSlot('LAB', 120)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-xs hover:bg-white/20 active:scale-95 transition-all"
                >
                  <Layers className="w-4 h-4" />
                  <span>+ Add Lab Session (2 Hours)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {activeDay.slots.map((slot, index) => {
                const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(slot.type);
                const isLunch = slot.type === 'LUNCH';
                const durationBadge = getDurationBadge(slot.startTime, slot.endTime);

                return (
                  <div
                    key={slot.id}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                      isBreak
                        ? isLunch
                          ? 'bg-amber-500/[0.04] border-amber-500/20'
                          : 'bg-emerald-500/[0.04] border-emerald-500/20'
                        : slot.isSplitBatch
                        ? 'bg-white/[0.04] border-white/15'
                        : 'liquid-glass-card border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Time & Duration Adjusters */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div className="min-w-[120px]">
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => handleUpdateSlot(slot.id, { name: e.target.value })}
                            className="font-bold text-white text-sm bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 outline-none w-full"
                          />
                          <span className="text-[10px] font-sub text-zinc-400 block mt-0.5">
                            Slot #{index + 1} • {durationBadge}
                          </span>
                        </div>

                        {/* Start & End Time Inputs */}
                        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950 border border-white/10 font-mono text-xs text-white">
                          <Clock className="w-3.5 h-3.5 text-zinc-400 ml-1" />
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleUpdateSlot(slot.id, { startTime: e.target.value })}
                            className="bg-transparent text-white outline-none w-16 text-center cursor-pointer"
                          />
                          <span className="text-zinc-600">–</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleUpdateSlot(slot.id, { endTime: e.target.value })}
                            className="bg-transparent text-white outline-none w-16 text-center cursor-pointer"
                          />
                        </div>

                        {/* Quick Duration Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustDuration(slot.id, -15)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
                            title="Shorten by 15 mins (ripple shifts later periods)"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustDuration(slot.id, 15)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
                            title="Extend by 15 mins (ripple shifts later periods)"
                          >
                            +15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustDuration(slot.id, 30)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
                            title="Extend by 30 mins (ripple shifts later periods)"
                          >
                            +30m
                          </button>
                        </div>
                      </div>

                      {/* Middle: Content */}
                      <div className="flex-1 min-w-[280px]">
                        {isBreak ? (
                          <div className="flex items-center gap-3">
                            {isLunch ? (
                              <Utensils className="w-5 h-5 text-amber-400 shrink-0" />
                            ) : (
                              <Coffee className="w-5 h-5 text-emerald-400 shrink-0" />
                            )}
                            <input
                              type="text"
                              value={slot.title || ''}
                              onChange={(e) => handleUpdateSlot(slot.id, { title: e.target.value })}
                              placeholder="Break Description (e.g. Lunch Break, Campus Dining)"
                              className="w-full bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white font-medium outline-none focus:border-white/30"
                            />
                          </div>
                        ) : slot.isSplitBatch ? (
                          /* PARALLEL DUAL-TRACK LAB */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10">
                            {/* Track 1 (Batch 1) */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-sub font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                                <Users className="w-3 h-3" /> Batch 1 (B1)
                              </span>
                              <select
                                value={slot.batch1?.subjectId || ''}
                                onChange={(e) =>
                                  handleUpdateSlot(slot.id, {
                                    batch1: { ...(slot.batch1 || { room: '', faculty: '' }), subjectId: e.target.value },
                                  })
                                }
                                className="w-full bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-white/15 text-xs text-white outline-none focus:border-white/30"
                              >
                                <option value="">— Select Lab Subject —</option>
                                {subjects.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} — {s.name}
                                  </option>
                                ))}
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Lab Room"
                                  value={slot.batch1?.room || ''}
                                  onChange={(e) =>
                                    handleUpdateSlot(slot.id, {
                                      batch1: { ...(slot.batch1 || { subjectId: '', faculty: '' }), room: e.target.value },
                                    })
                                  }
                                  className="bg-zinc-950 px-2 py-1 rounded-lg text-[11px] text-zinc-300 border border-white/10 outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Faculty"
                                  value={slot.batch1?.faculty || ''}
                                  onChange={(e) =>
                                    handleUpdateSlot(slot.id, {
                                      batch1: { ...(slot.batch1 || { subjectId: '', room: '' }), faculty: e.target.value },
                                    })
                                  }
                                  className="bg-zinc-950 px-2 py-1 rounded-lg text-[11px] text-zinc-300 border border-white/10 outline-none"
                                />
                              </div>
                            </div>

                            {/* Track 2 (Batch 2) */}
                            <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-white/10 sm:pl-3 pt-2 sm:pt-0">
                              <span className="text-[10px] font-sub font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                                <Users className="w-3 h-3" /> Batch 2 (B2)
                              </span>
                              <select
                                value={slot.batch2?.subjectId || ''}
                                onChange={(e) =>
                                  handleUpdateSlot(slot.id, {
                                    batch2: { ...(slot.batch2 || { room: '', faculty: '' }), subjectId: e.target.value },
                                  })
                                }
                                className="w-full bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-white/15 text-xs text-white outline-none focus:border-white/30"
                              >
                                <option value="">— Select Lab Subject —</option>
                                {subjects.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} — {s.name}
                                  </option>
                                ))}
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Lab Room"
                                  value={slot.batch2?.room || ''}
                                  onChange={(e) =>
                                    handleUpdateSlot(slot.id, {
                                      batch2: { ...(slot.batch2 || { subjectId: '', faculty: '' }), room: e.target.value },
                                    })
                                  }
                                  className="bg-zinc-950 px-2 py-1 rounded-lg text-[11px] text-zinc-300 border border-white/10 outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Faculty"
                                  value={slot.batch2?.faculty || ''}
                                  onChange={(e) =>
                                    handleUpdateSlot(slot.id, {
                                      batch2: { ...(slot.batch2 || { subjectId: '', room: '' }), faculty: e.target.value },
                                    })
                                  }
                                  className="bg-zinc-950 px-2 py-1 rounded-lg text-[11px] text-zinc-300 border border-white/10 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* STANDARD CLASS SLOT */
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={slot.subjectId || ''}
                              onChange={(e) => handleUpdateSlot(slot.id, { subjectId: e.target.value })}
                              className="w-full bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white outline-none focus:border-white/30"
                            >
                              <option value="">— Select Subject —</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.code} — {s.name}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Room / Classroom"
                              value={slot.room || ''}
                              onChange={(e) => handleUpdateSlot(slot.id, { room: e.target.value })}
                              className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-300 outline-none focus:border-white/30"
                            />

                            <input
                              type="text"
                              placeholder="Faculty Name"
                              value={slot.faculty || ''}
                              onChange={(e) => handleUpdateSlot(slot.id, { faculty: e.target.value })}
                              className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-300 outline-none focus:border-white/30"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: Controls & Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        {!isBreak && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSlot(slot.id, {
                                isSplitBatch: !slot.isSplitBatch,
                                type: !slot.isSplitBatch ? 'LAB' : 'LECTURE',
                                batch1: !slot.isSplitBatch ? { subjectId: '', room: '', faculty: '' } : undefined,
                                batch2: !slot.isSplitBatch ? { subjectId: '', room: '', faculty: '' } : undefined,
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-sub font-semibold transition-all flex items-center gap-1 ${
                              slot.isSplitBatch
                                ? 'bg-white/15 border-white/30 text-white'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                            title="Toggle between Single Class and Parallel B1 + B2 Lab Batches"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{slot.isSplitBatch ? 'Split Labs (B1 & B2)' : 'Split Batches'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Period"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick Add Bottom Bar */}
              <div className="p-4 rounded-3xl liquid-glass-card border border-white/10 flex flex-wrap items-center justify-between gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-sub text-zinc-400">Next Slot for {activeDay.name}:</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {activeDay.slots.length > 0 ? activeDay.slots[activeDay.slots.length - 1].endTime : '09:00'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAddSlot('LECTURE', 60)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Period (1 hr)</span>
                  </button>

                  <button
                    onClick={() => handleAddSlot('LAB', 120)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-all active:scale-95"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>+ Add Lab (2 hrs)</span>
                  </button>

                  <button
                    onClick={() => handleAddSlot('INTERVAL', 15)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 transition-all active:scale-95"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>+ Tea Break (15m)</span>
                  </button>

                  <button
                    onClick={() => handleAddSlot('LUNCH', 45)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 transition-all active:scale-95"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>+ Lunch Break (45m)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WEEKLY MASTER GRID */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {days.map((d) => (
              <div
                key={d.dayOfWeek}
                className="rounded-3xl liquid-glass-card border border-white/10 p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div>
                      <h4 className="font-bold text-white text-sm">{d.name}</h4>
                      <span className="text-[10px] font-sub text-zinc-400">
                        {d.slots.length} scheduled slot(s)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveDayOfWeek(d.dayOfWeek);
                        setViewMode('day');
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 text-[11px] font-sub flex items-center gap-0.5 transition-colors"
                    >
                      <span>Edit</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Day Slot Timeline Snippets */}
                  {d.slots.length === 0 ? (
                    <div className="py-12 text-center text-zinc-600 text-xs font-sub italic">
                      No periods scheduled
                    </div>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {d.slots.map((s) => {
                        const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(s.type);
                        const isLunch = s.type === 'LUNCH';
                        const subjectObj = subjects.find((sub) => sub.id === s.subjectId);
                        const b1Sub = subjects.find((sub) => sub.id === s.batch1?.subjectId);
                        const b2Sub = subjects.find((sub) => sub.id === s.batch2?.subjectId);

                        return (
                          <div
                            key={s.id}
                            className={`p-2.5 rounded-2xl border text-xs transition-all ${
                              isBreak
                                ? isLunch
                                  ? 'bg-amber-500/[0.05] border-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/[0.05] border-emerald-500/20 text-emerald-300'
                                : s.isSplitBatch
                                ? 'bg-white/[0.04] border-white/15 text-zinc-200'
                                : 'bg-white/[0.02] border-white/5 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                              <span>
                                {s.startTime}–{s.endTime}
                              </span>
                              <span className="font-semibold text-zinc-400">{s.name}</span>
                            </div>

                            {isBreak ? (
                              <div className="font-semibold flex items-center gap-1 text-[11px]">
                                {isLunch ? (
                                  <Utensils className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <Coffee className="w-3 h-3 text-emerald-400" />
                                )}
                                <span className="font-sub">{s.title || 'Break'}</span>
                              </div>
                            ) : s.isSplitBatch ? (
                              <div className="space-y-1 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-zinc-400 font-bold">B1:</span>
                                  <span className="truncate font-semibold text-white ml-1">
                                    {b1Sub ? b1Sub.code : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-zinc-400 font-bold">B2:</span>
                                  <span className="truncate font-semibold text-white ml-1">
                                    {b2Sub ? b2Sub.code : '—'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-white text-xs truncate">
                                  {subjectObj ? subjectObj.code : '— Free —'}
                                </div>
                                {s.room && <div className="text-[10px] text-zinc-500 font-sub">Room: {s.room}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setActiveDayOfWeek(d.dayOfWeek);
                    setViewMode('day');
                  }}
                  className="w-full mt-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-zinc-300 text-xs font-sub font-semibold transition-colors text-center"
                >
                  + Add / Customize
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Replicator Modal */}
      <DayReplicatorModal
        isOpen={replicatorOpen}
        onClose={() => setReplicatorOpen(false)}
        sourceDayName={activeDay.name}
        sourceDayOfWeek={activeDay.dayOfWeek}
        availableDays={INITIAL_DAYS}
        onReplicate={handleReplicateDay}
      />
    </div>
  );
};
