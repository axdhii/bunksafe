import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  AlertCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { SparklesCore } from '../../components/common/Sparkles';

export const StudentLoginPage: React.FC = () => {
  const { loginStudent } = useAuth();
  const navigate = useNavigate();

  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Optional Academic Cohort
  const [showCohortDetails, setShowCohortDetails] = useState(false);
  const [semesterNumber, setSemesterNumber] = useState<number>(5);
  const [branchCode, setBranchCode] = useState('CSE');
  const [sectionName, setSectionName] = useState('A');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load remembered USN on mount
  useEffect(() => {
    const savedUsn = localStorage.getItem('bunk_remember_usn');
    if (savedUsn) {
      setUsn(savedUsn);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem('bunk_remember_usn', usn.trim().toUpperCase());
      } else {
        localStorage.removeItem('bunk_remember_usn');
      }

      await loginStudent(usn, semesterNumber, branchCode, sectionName, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your USN and credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col relative overflow-x-hidden font-sans">
      {/* Background Subtle Sparkles Canvas */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-40 z-0">
        <SparklesCore
          id="login-sparkles-bg"
          background="transparent"
          minSize={0.4}
          maxSize={1.6}
          particleDensity={40}
          particleColor="#ffffff"
          speed={0.8}
        />
      </div>

      {/* Ambient Dark Monochrome Glow */}
      <div className="fixed w-[600px] h-[600px] -top-32 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.02] blur-[100px] pointer-events-none" />

      {/* ================================================================== */}
      {/* TOP ZONE: BRAND + STARFIELD + ARCS                                 */}
      {/* ================================================================== */}
      <div className="w-full flex flex-col relative z-10">
        {/* Brand Header — shifted slightly further down on mobile, unchanged on desktop */}
        <div className="flex flex-col items-center justify-center text-center px-4 pt-14 sm:pt-16 md:pt-20 lg:pt-24 pb-6 sm:pb-10 md:pb-12 space-y-2 sm:space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg">
              B
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-sans">
              Bunk<span className="text-zinc-400 font-normal">Safe</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-zinc-400 font-sub font-light max-w-md mx-auto">
            Intelligent attendance tracker
          </p>
        </div>

        {/* ================================================================ */}
        {/* CONCENTRIC ARCS — 3 Equal-Thickness Graduated Bands              */}
        {/* ================================================================ */}
        <div className="w-full relative h-36 sm:h-56 md:h-64 overflow-hidden -mb-px pointer-events-none shrink-0">
          {/* MOBILE ARCS (< 640px): 3 equal ~40px bands, gentle upward planetary dome */}
          <svg
            viewBox="0 0 400 150"
            className="w-full h-full block sm:hidden"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Band: subtle atmosphere */}
            <path
              d="M 0,30 A 800 800 0 0 1 400,30 L 400,150 L 0,150 Z"
              fill="rgba(255, 255, 255, 0.08)"
            />
            {/* Middle Band: visible silver */}
            <path
              d="M 0,70 A 800 800 0 0 1 400,70 L 400,150 L 0,150 Z"
              fill="rgba(255, 255, 255, 0.18)"
            />
            {/* Base Band: planetary surface transition */}
            <path
              d="M 0,110 A 800 800 0 0 1 400,110 L 400,150 L 0,150 Z"
              fill="#22232a"
            />
          </svg>

          {/* DESKTOP ARCS (>= 640px): 3 equal ~75px bands, R=4000 upward planetary dome, apex safe at y=15 (no chopping) */}
          <svg
            viewBox="0 0 1440 320"
            className="w-full h-full hidden sm:block"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Band: subtle atmosphere */}
            <path
              d="M 0,80 A 4000 4000 0 0 1 1440,80 L 1440,320 L 0,320 Z"
              fill="rgba(255, 255, 255, 0.08)"
            />
            {/* Middle Band: visible silver */}
            <path
              d="M 0,155 A 4000 4000 0 0 1 1440,155 L 1440,320 L 0,320 Z"
              fill="rgba(255, 255, 255, 0.18)"
            />
            {/* Base Band: planetary surface transition */}
            <path
              d="M 0,230 A 4000 4000 0 0 1 1440,230 L 1440,320 L 0,320 Z"
              fill="#22232a"
            />
          </svg>
        </div>
      </div>

      {/* ================================================================== */}
      {/* NATIVE GREYISH BASE SURFACE: DIRECT LOGIN FORM (NO CARD STRUCTURE)  */}
      {/* ================================================================== */}
      <div className="w-full flex-1 bg-[#22232a] relative z-10 px-5 sm:px-6 pt-10 sm:pt-8 pb-10 sm:pb-16 flex flex-col items-center justify-between pb-safe">
        {/* Direct Form Area (No Card Box) */}
        <div className="w-full max-w-md mx-auto space-y-4">
          <div className="pb-2 border-b border-white/[0.08]">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-sans tracking-tight">Student Sign In</h2>
            <p className="text-xs text-zinc-400 font-sub font-light mt-0.5">Access your personal attendance dashboard</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5 font-sub animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* USN Field */}
            <div>
              <label className="block text-[11px] font-sub font-light text-zinc-400 uppercase tracking-wider mb-1.5">
                University Seat Number (USN)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={usn}
                  onChange={(e) => setUsn(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/15 text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all uppercase"
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label className="block text-[11px] font-sub font-light text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3.5 rounded-xl bg-white/[0.04] border border-white/15 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-white accent-white focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-zinc-300 font-sub font-light">Remember my USN</span>
              </label>

              {/* Optional Cohort Disclosure Toggle */}
              <button
                type="button"
                onClick={() => setShowCohortDetails(!showCohortDetails)}
                className="text-[11px] text-zinc-400 hover:text-white font-sub flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Cohort (Sem {semesterNumber}, {branchCode})</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showCohortDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Expandable Academic Cohort Details */}
            {showCohortDetails && (
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 animate-fade-in text-xs">
                <span className="text-[10px] text-zinc-500 font-sub uppercase tracking-wider block">
                  Academic Details (Auto-Bound to USN)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1 font-sub">Semester</label>
                    <select
                      value={semesterNumber}
                      onChange={(e) => setSemesterNumber(Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-xl bg-black border border-white/10 text-white text-xs outline-none font-sans"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num}>
                          Sem {num}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1 font-sub">Branch</label>
                    <input
                      type="text"
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      className="w-full px-2 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs uppercase outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1 font-sub">Section</label>
                    <input
                      type="text"
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value.toUpperCase())}
                      className="w-full px-2 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs uppercase outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-white text-black font-sans font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-3 shadow-lg cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Access Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Links */}
          <div className="pt-3 border-t border-white/[0.08] text-center space-y-2">
            <Link
              to="/register"
              className="text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors font-sans"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Student? Register Account Now →</span>
            </Link>

            <div>
              <Link
                to="/admin/login"
                className="text-[11px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1.5 transition-colors font-sub font-light"
              >
                <Shield className="w-3 h-3" />
                <span>Admin Authority Console →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
