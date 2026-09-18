import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Shield,
  BookOpen,
  Lock,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { SparklesCore } from '../../components/common/Sparkles';
import { RegistrationScanModal } from '../../components/common/RegistrationScanModal';

// Standard academic fallback defaults so cohort dropdowns are ALWAYS populated and functional
const DEFAULT_BRANCHES = [
  { id: 'branch-cse', code: 'CSE', name: 'Computer Science & Engineering' },
  { id: 'branch-ise', code: 'ISE', name: 'Information Science & Engineering' },
  { id: 'branch-ece', code: 'ECE', name: 'Electronics & Communication' },
  { id: 'branch-aiml', code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
  { id: 'branch-me', code: 'ME', name: 'Mechanical Engineering' },
  { id: 'branch-cv', code: 'CV', name: 'Civil Engineering' },
];

const DEFAULT_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8].map((num) => ({
  id: `sem-${num}`,
  number: num,
  name: `Semester ${num}`,
}));

const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D'].map((name) => ({
  id: `sec-${name.toLowerCase()}`,
  name,
}));

export const StudentRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: setAuthUser } = useAuth();

  // Academic Dropdowns initialized with dependable defaults
  const [semesters, setSemesters] = useState<any[]>(DEFAULT_SEMESTERS);
  const [branches, setBranches] = useState<any[]>(DEFAULT_BRANCHES);
  const [sections, setSections] = useState<any[]>(DEFAULT_SECTIONS);
  const [loadingAcademic, setLoadingAcademic] = useState(false);

  // Form State
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [phone, setPhone] = useState('');
  const [batch, setBatch] = useState('A1');
  const [semesterId, setSemesterId] = useState('sem-5');
  const [branchId, setBranchId] = useState('branch-cse');
  const [sectionId, setSectionId] = useState('sec-a');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredStudent, setRegisteredStudent] = useState<any | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [semRes, bRes, secRes] = await Promise.allSettled([
          apiRequest<{ semesters: any[] }>('/academic/semesters'),
          apiRequest<{ branches: any[] }>('/academic/branches'),
          apiRequest<{ sections: any[] }>('/academic/sections'),
        ]);

        if (semRes.status === 'fulfilled' && semRes.value?.semesters?.length) {
          setSemesters(semRes.value.semesters);
          setSemesterId(semRes.value.semesters[0].id);
        }
        if (bRes.status === 'fulfilled' && bRes.value?.branches?.length) {
          setBranches(bRes.value.branches);
          setBranchId(bRes.value.branches[0].id);
        }
        if (secRes.status === 'fulfilled' && secRes.value?.sections?.length) {
          setSections(secRes.value.sections);
          setSectionId(secRes.value.sections[0].id);
        }
      } catch (err) {
        console.warn('Using local academic defaults:', err);
      } finally {
        setLoadingAcademic(false);
      }
    };
    fetchOptions();

    const params = new URLSearchParams(window.location.search);
    const prefillUsn = params.get('usn');
    if (prefillUsn) {
      setUsn(prefillUsn.trim().toUpperCase());
    }
  }, []);

  const availableSections = sections.filter(
    (sec) => (!sec.semesterId || sec.semesterId === semesterId) && (!sec.branchId || sec.branchId === branchId)
  );
  const displayedSections = availableSections.length > 0 ? availableSections : sections;

  // Auto-align sectionId if displayedSections change
  useEffect(() => {
    if (displayedSections.length > 0 && !displayedSections.some((s) => s.id === sectionId)) {
      setSectionId(displayedSections[0].id);
    }
  }, [branchId, semesterId, displayedSections, sectionId]);

  // Derive section letter and dynamic batch codes (e.g. A1/A2 for Section A, B1/B2 for Section B)
  const currentSection = displayedSections.find((s) => s.id === sectionId) || sections.find((s) => s.id === sectionId);
  const sectionLetter = (currentSection?.name || 'A').trim().toUpperCase();
  const batch1 = `${sectionLetter}1`;
  const batch2 = `${sectionLetter}2`;

  // Auto-sync batch code when section changes, preserving Batch 1 vs Batch 2 preference
  useEffect(() => {
    const sec = displayedSections.find((s) => s.id === sectionId) || sections.find((s) => s.id === sectionId);
    const letter = (sec?.name || 'A').trim().toUpperCase();
    setBatch((prev) => {
      const num = prev.endsWith('2') ? 2 : 1;
      return `${letter}${num}`;
    });
  }, [sectionId, displayedSections, sections]);

  const calculatePasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const pwdStrength = calculatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters for security.');
      return;
    }

    setSubmitting(true);
    const selectedSem = semesters.find((s) => s.id === semesterId);
    const selectedBranch = branches.find((b) => b.id === branchId);
    const selectedSec = displayedSections.find((s) => s.id === sectionId) || sections.find((s) => s.id === sectionId);

    try {
      const res = await apiRequest<{ token?: string; user: any; student: any }>('/auth/student/register', {
        method: 'POST',
        data: {
          name,
          usn,
          phone,
          password,
          batch,
          semesterId,
          branchId,
          sectionId,
        },
      });

      setAuthUser(res.token || '', res.user, res.student);

      setRegisteredStudent({
        usn: res.student.usn,
        name: res.student.name,
        phone: res.student.phone || phone,
        branchCode: selectedBranch?.code || 'CSE',
        semesterNumber: selectedSem?.number || 5,
        sectionName: selectedSec?.name || 'A',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col lg:flex-row overflow-hidden relative font-sans">
      {/* Background SVG Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* LEFT SIDE: Clean Registration Form Area */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 z-20 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 my-auto">
          {/* Mobile Header (Only on small screens) */}
          <div className="lg:hidden text-center space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>BunkSafe</span>
            </h1>
            <p className="text-xs text-zinc-400 font-sub">Create your verified student account</p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl liquid-glass-card border border-white/10 shadow-2xl space-y-5">
            <div>
              <span className="text-[10px] font-sub uppercase tracking-wider text-zinc-400 font-semibold">
                Student Onboarding
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">Register Account</h2>
              <p className="text-xs text-zinc-400 font-sub">
                Setup your USN identity and link your semester timetable
              </p>
            </div>

            {/* Step Progress Pills */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { num: 1, label: 'Identity' },
                { num: 2, label: 'Cohort' },
                { num: 3, label: 'Password' },
              ].map((s) => (
                <div
                  key={s.num}
                  className={`py-1.5 px-2 rounded-xl text-center border text-[11px] font-semibold transition-all ${
                    step === s.num
                      ? 'bg-white text-black border-white shadow-sm'
                      : step > s.num
                      ? 'bg-white/10 border-white/15 text-white'
                      : 'bg-white/[0.02] border-white/5 text-zinc-500'
                  }`}
                >
                  <span className="font-mono mr-1">0{s.num}.</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* STEP 1: IDENTITY */}
              {step === 1 && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Full Name</label>
                    <div className="mt-1 relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder-zinc-500 focus:border-white/30 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300">University Seat Number (USN)</label>
                    <div className="mt-1 relative">
                      <Shield className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={usn}
                        onChange={(e) => setUsn(e.target.value.toUpperCase())}
                        placeholder="e.g. 1MS21CS001"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder-zinc-500 focus:border-white/30 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Phone Number</label>
                    <div className="mt-1 relative">
                      <Phone className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono placeholder-zinc-500 focus:border-white/30 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!name || !usn || !phone) {
                        setErrorMessage('Please fill in your Name, USN, and Phone Number.');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(2);
                    }}
                    className="w-full py-3 rounded-xl bg-white text-black font-semibold text-xs shadow-md hover:bg-zinc-200 active:scale-95 flex items-center justify-center gap-1.5 transition-all mt-2"
                  >
                    <span>Next: Select Academic Cohort</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: COHORT & BATCH */}
              {step === 2 && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Academic Branch</label>
                    <div className="mt-1 relative">
                      <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-zinc-950/80 border border-white/15 text-xs text-white outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id} className="bg-zinc-950 text-white py-1.5">
                            {b.code} — {b.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300">Semester</label>
                      <div className="mt-1 relative">
                        <select
                          value={semesterId}
                          onChange={(e) => setSemesterId(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-zinc-950/80 border border-white/15 text-xs text-white outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                        >
                          {semesters.map((s) => (
                            <option key={s.id} value={s.id} className="bg-zinc-950 text-white py-1.5">
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300">Section</label>
                      <div className="mt-1 relative">
                        <select
                          value={sectionId}
                          onChange={(e) => setSectionId(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-zinc-950/80 border border-white/15 text-xs text-white outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                        >
                          {displayedSections.map((sec) => (
                            <option key={sec.id} value={sec.id} className="bg-zinc-950 text-white py-1.5">
                              Section {sec.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Batch Selection for Labs */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 font-sub">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Assigned Lab Batch</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => setBatch(batch1)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          batch === batch1
                            ? 'bg-white text-black border-white shadow-sm'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Batch 1 ({batch1})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatch(batch2)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          batch === batch2
                            ? 'bg-white text-black border-white shadow-sm'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Batch 2 ({batch2})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-1/3 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1 font-sub"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep(3);
                      }}
                      className="w-2/3 py-3 rounded-xl bg-white text-black font-semibold text-xs shadow-md hover:bg-zinc-200 active:scale-95 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Next: Set Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SECURITY */}
              {step === 3 && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Account Password</label>
                    <div className="mt-1 relative flex items-center">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder-zinc-500 focus:border-white/30 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-2 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              idx <= pwdStrength
                                ? pwdStrength >= 4
                                  ? 'bg-emerald-400'
                                  : pwdStrength >= 2
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Confirm Password</label>
                    <div className="mt-1 relative flex items-center">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder-zinc-500 focus:border-white/30 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-1/3 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1 font-sub"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-2/3 py-3 rounded-xl bg-white text-black font-semibold text-xs shadow-md hover:bg-zinc-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 animate-spin" />
                          <span>Registering...</span>
                        </span>
                      ) : (
                        <span>Complete Registration</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="pt-3 border-t border-white/10 text-center">
              <p className="text-xs text-zinc-400 font-sub">
                Already have an account?{' '}
                <Link to="/login" className="text-white font-bold hover:underline ml-1">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Aceternity Sparkles Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-black border-l border-white/10 overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <SparklesCore
            id="register-sparkles"
            background="transparent"
            minSize={0.6}
            maxSize={2.0}
            particleDensity={60}
            particleColor="#ffffff"
            speed={1.0}
          />
        </div>

        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-lg text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-sub text-zinc-300 uppercase tracking-wider backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
            <span>Join BunkSafe Today</span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-white">
            BunkSafe
          </h1>

          <p className="text-base text-zinc-400 leading-relaxed max-w-md mx-auto font-sub font-light">
            Experience peace of mind with intelligent attendance tracking, split-lab schedule support, and instant safe-skip counts.
          </p>

          <div className="pt-4 grid grid-cols-1 gap-3 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-sub">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Assigned Lab Batch (B1 / B2) support</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-sub">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero-detention 85% cutoff threshold alerts</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-sub">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full offline caching & PWA service worker</span>
            </div>
          </div>
        </div>
      </div>

      {registeredStudent && (
        <RegistrationScanModal
          isOpen={!!registeredStudent}
          onClose={() => navigate('/dashboard')}
          onProceed={() => navigate('/dashboard')}
          student={registeredStudent}
        />
      )}
    </div>
  );
};
