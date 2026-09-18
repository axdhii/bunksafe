import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Clock,
  BookOpen,
  MapPin,
  Users,
  RotateCcw,
} from 'lucide-react';
import { Modal } from './Modal';
import { apiRequest } from '../../api/client';

interface ExtractedSubject {
  code: string;
  name: string;
  abbreviation?: string;
  credits?: number;
  type?: string;
}

interface ExtractedScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName?: string;
  faculty?: string;
  room?: string;
  type?: string;
  batch?: string;
  title?: string;
}

interface AiScanResponse {
  success: boolean;
  metadata?: {
    semesterNumber?: number;
    sectionName?: string;
    branchCode?: string;
    classroom?: string;
    classAdvisor?: string;
  };
  subjects: ExtractedSubject[];
  schedule: ExtractedScheduleEntry[];
}

interface AiTimetableScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  branchId: string;
  sectionId: string;
  onSuccess: () => void;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AiTimetableScanModal: React.FC<AiTimetableScanModalProps> = ({
  isOpen,
  onClose,
  semesterId,
  branchId,
  sectionId,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AiScanResponse | null>(null);
  const [activePreviewDay, setActivePreviewDay] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleScan = async () => {
    if (!file) {
      setError('Please choose a timetable image or PDF to scan.');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest<AiScanResponse>('/timetable/ai-scan', {
        method: 'POST',
        data: formData,
      });

      if (res.schedule && res.schedule.length > 0) {
        setScanResult(res);
      } else {
        setError('No timetable schedule was detected in this document. Please verify the image is clear.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze timetable. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmAndApply = async () => {
    if (!scanResult) return;

    setApplying(true);
    setError(null);

    try {
      await apiRequest('/timetable/ai-confirm', {
        method: 'POST',
        data: {
          sectionId,
          semesterId,
          branchId,
          subjects: scanResult.subjects,
          schedule: scanResult.schedule,
        },
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save timetable to database.');
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewUrl(null);
    setScanning(false);
    setApplying(false);
    setError(null);
    setScanResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Smart AI Timetable Scanner" maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD & SCAN */}
        {!scanResult && (
          <div className="space-y-4">
            <p className="text-zinc-400 font-sub font-light">
              Upload a photo or PDF of your department timetable. Gemini AI will automatically extract all course codes,
              subject names, faculty names, room numbers, and period allocations.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-emerald-400/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 bg-white/[0.02] hover:bg-emerald-500/[0.03] transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="relative w-full max-h-48 overflow-hidden rounded-xl border border-white/10 flex items-center justify-center bg-black">
                  <img src={previewUrl} alt="Timetable preview" className="max-h-48 object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold text-xs">
                    Click to change image
                  </div>
                </div>
              ) : file ? (
                <div className="flex items-center gap-2 text-white font-medium py-4">
                  <FileText className="w-6 h-6 text-emerald-400" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-emerald-400 group-hover:scale-105 transition-all">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-zinc-200">Click to upload timetable sheet</p>
                    <p className="text-[11px] text-zinc-500 font-sub">Supports JPEG, PNG, WEBP, or PDF up to 10MB</p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={!file || scanning}
              onClick={handleScan}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.99]"
            >
              {scanning ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  <span>Analyzing document with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Extract Timetable with Gemini</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: REVIEW EXTRACTED PREVIEW */}
        {scanResult && (
          <div className="space-y-4 animate-fade-in">
            {/* Header Summary */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">
                  Extracted {scanResult.schedule.length} timetable entries and {scanResult.subjects.length} subjects!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 font-sub"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-scan</span>
              </button>
            </div>

            {/* Extracted Subjects Pill List */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-sub text-zinc-400 uppercase tracking-wider block">
                Detected Subjects & Codes ({scanResult.subjects.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-white/[0.02] border border-white/5">
                {scanResult.subjects.map((sub, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[11px]"
                  >
                    <span className="font-mono font-bold text-emerald-400">{sub.code}</span>
                    <span className="text-zinc-300 truncate max-w-[140px]">{sub.name}</span>
                    <span className="text-[10px] px-1 rounded bg-white/10 text-zinc-400">{sub.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
              {[1, 2, 3, 4, 5, 6].map((dayNum) => {
                const count = scanResult.schedule.filter((e) => e.dayOfWeek === dayNum).length;
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setActivePreviewDay(dayNum)}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-[11px] transition-all shrink-0 cursor-pointer ${
                      activePreviewDay === dayNum
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{DAY_NAMES[dayNum]}</span>
                    <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Schedule Slot Cards for Selected Day */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {scanResult.schedule
                .filter((e) => e.dayOfWeek === activePreviewDay)
                .map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 shrink-0 font-mono text-zinc-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{slot.startTime} - {slot.endTime}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {slot.subjectCode ? (
                          <span className="font-mono font-bold text-emerald-400 shrink-0">{slot.subjectCode}</span>
                        ) : null}
                        <span className="font-medium text-white truncate">
                          {slot.subjectName || slot.title || 'Period'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-sub mt-0.5">
                        {slot.faculty && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{slot.faculty}</span>
                          </span>
                        )}
                        {slot.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{slot.room}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          slot.batch === 'ALL'
                            ? 'bg-white/10 text-zinc-300'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {slot.batch}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Confirm and Apply Button */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold hover:bg-white/5 transition-colors cursor-pointer"
              >
                Back / Change Image
              </button>

              <button
                type="button"
                disabled={applying}
                onClick={handleConfirmAndApply}
                className="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <span>{applying ? 'Applying to Timetable...' : 'Approve & Save Timetable'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
