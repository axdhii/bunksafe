import React, { useState } from 'react';
import { Copy, Check, X, ArrowRight } from 'lucide-react';

interface DayReplicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDayName: string;
  sourceDayOfWeek: number;
  availableDays: { dayOfWeek: number; name: string }[];
  onReplicate: (targetDays: number[], copySubjects: boolean) => void;
}

export const DayReplicatorModal: React.FC<DayReplicatorModalProps> = ({
  isOpen,
  onClose,
  sourceDayName,
  sourceDayOfWeek,
  availableDays,
  onReplicate,
}) => {
  const otherDays = availableDays.filter((d) => d.dayOfWeek !== sourceDayOfWeek);
  const [selectedTargets, setSelectedTargets] = useState<number[]>(
    otherDays.map((d) => d.dayOfWeek)
  );
  const [copySubjects, setCopySubjects] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleToggleDay = (dayNum: number) => {
    setSelectedTargets((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const handleSelectAll = () => {
    setSelectedTargets(otherDays.map((d) => d.dayOfWeek));
  };

  const handleSelectNone = () => {
    setSelectedTargets([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTargets.length === 0) {
      alert('Please select at least one target day to replicate.');
      return;
    }
    onReplicate(selectedTargets, copySubjects);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="w-full max-w-lg rounded-3xl liquid-glass border border-white/10 p-6 shadow-2xl relative font-sans">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15 text-white">
            <Copy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Replicate Schedule</h3>
            <p className="text-xs text-zinc-400 font-sub">
              Copy <span className="text-white font-semibold">{sourceDayName}</span>'s timing structure to other days
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target Days Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-sub uppercase tracking-wider text-zinc-400 font-semibold">
                Select Target Days:
              </label>
              <div className="flex items-center gap-2 text-[11px] font-sub">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-zinc-300 hover:text-white underline"
                >
                  Select All
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-zinc-500 hover:text-zinc-300 underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {otherDays.map((d) => {
                const isSelected = selectedTargets.includes(d.dayOfWeek);
                return (
                  <button
                    key={d.dayOfWeek}
                    type="button"
                    onClick={() => handleToggleDay(d.dayOfWeek)}
                    className={`p-3 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{d.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-black" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copy Mode */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <label className="text-xs font-sub uppercase tracking-wider text-zinc-400 font-semibold block">
              Replication Options:
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-200">
              <input
                type="radio"
                name="copyMode"
                checked={copySubjects}
                onChange={() => setCopySubjects(true)}
                className="w-4 h-4 accent-white cursor-pointer"
              />
              <div>
                <span className="font-semibold text-white">Full Duplicate</span>
                <span className="text-zinc-400 font-sub block text-[11px]">
                  Copy exact timings, break types, and assigned subjects/rooms
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-200">
              <input
                type="radio"
                name="copyMode"
                checked={!copySubjects}
                onChange={() => setCopySubjects(false)}
                className="w-4 h-4 accent-white cursor-pointer"
              />
              <div>
                <span className="font-semibold text-white">Structure & Timings Only</span>
                <span className="text-zinc-400 font-sub block text-[11px]">
                  Copy period hours and breaks, leaving subject dropdowns blank for fresh entry
                </span>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-sub font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
            >
              <span>Replicate to {selectedTargets.length} Day(s)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
