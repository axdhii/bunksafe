import React from 'react';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles, Phone, User, BookOpen } from 'lucide-react';
import { Modal } from './Modal';

interface RegistrationScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  student: {
    usn: string;
    name: string;
    phone?: string;
    branchCode?: string;
    semesterNumber?: number;
    sectionName?: string;
  };
}

export const RegistrationScanModal: React.FC<RegistrationScanModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  student,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-6 text-center py-2 relative overflow-hidden">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-3xl liquid-glass border border-white/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Registration Verified
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-sub font-light">
            Student account created & authenticated with active attendance tracking
          </p>
        </div>

        {/* Minimalist Identity Card with Light Scan Beam */}
        <div className="relative p-5 rounded-3xl liquid-glass-card border border-white/15 text-left space-y-4 overflow-hidden group shadow-2xl">
          {/* Shimmer Light Scan Sweep Animation */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span className="text-xs font-sans font-bold uppercase tracking-wider text-white">
                Student ID
              </span>
            </div>
            <span className="text-[10px] font-sub px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/20 font-medium">
              VERIFIED
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <span className="text-[10px] uppercase font-sub font-light text-zinc-400">Student Name</span>
              <h4 className="text-base font-bold text-white font-sans">{student.name}</h4>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] uppercase font-sub font-light text-zinc-400">USN</span>
                <p className="text-xs font-sans font-bold text-white">{student.usn}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-sub font-light text-zinc-400">Phone Number</span>
                <p className="text-xs font-sub text-zinc-300">{student.phone || '—'}</p>
              </div>
            </div>

            {student.branchCode && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-300 font-sub">
                <span>Cohort:</span>
                <span className="font-bold text-white font-sans">
                  {student.branchCode} • Sem {student.semesterNumber || 5} • Sec {student.sectionName || 'A'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Enter Dashboard Action */}
        <button
          onClick={onProceed}
          className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center gap-2 font-sans"
        >
          <span>Launch Student Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </Modal>
  );
};
