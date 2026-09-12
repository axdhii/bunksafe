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
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Calendar,
  Layers,
  Zap,
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

  const handleFillDemo = () => {
    setUsn('1MS21CS001');
    setSemesterNumber(5);
    setBranchCode('CSE');
    setSectionName('A');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-x-hidden font-sans">
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

      {/* Main Container */}
      <div className="w-full max-w-xl flex flex-col items-center z-10 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* ================================================================== */}
        {/* BRAND HEADER (ABOVE LOGIN CARD)                                    */}
        {/* ================================================================== */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-sub font-light text-zinc-300 tracking-wider uppercase backdrop-blur-xl">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span>Institutional Student Portal • 85% Safety Matrix</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-white font-black text-xl shadow-lg">
              B
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-sans">
              Bunk<span className="text-zinc-400 font-normal">Safe</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-zinc-400 font-sub font-light max-w-md mx-auto">
            Intelligent attendance tracking, mathematical safe-skip predictions, and dynamic timetable governance.
          </p>
        </div>

        {/* ================================================================== */}
        {/* CENTERED LIQUID GLASS LOGIN CARD                                   */}
        {/* ================================================================== */}
        <div className="w-full max-w-md liquid-glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
            <div>
              <h2 className="text-lg font-bold text-white font-sans">Student Sign In</h2>
              <p className="text-[11px] text-zinc-400 font-sub font-light">Access your personal attendance dashboard</p>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-sub text-zinc-400 hover:text-white flex items-center gap-1 shrink-0 p-1.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              title="Auto-fill Demo Student account"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              <span>Fill Demo</span>
            </button>
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
                  placeholder="e.g. 1MS21CS001"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all uppercase"
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
                  placeholder="•••••••• (if configured)"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
                      placeholder="CSE"
                      className="w-full px-2 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono text-xs uppercase outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1 font-sub">Section</label>
                    <input
                      type="text"
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value.toUpperCase())}
                      placeholder="A"
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
              className="w-full py-3.5 rounded-xl bg-white text-black font-sans font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Access Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Links */}
          <div className="pt-3 border-t border-white/[0.06] text-center space-y-2">
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

        {/* ================================================================== */}
        {/* FEATURES SHOWCASE (UNDER LOGIN CARD)                               */}
        {/* ================================================================== */}
        <div className="w-full max-w-xl space-y-3 pt-2">
          <div className="text-center">
            <span className="text-[11px] font-sub uppercase tracking-wider text-zinc-500 font-light">
              Key Academic Capabilities
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl liquid-glass-card border border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white font-sans">Deterministic 85% Safety</h3>
                <p className="text-[11px] text-zinc-400 font-sub font-light leading-relaxed">
                  Calculated against statutory institutional benchmarks with strict attendance tracking.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl liquid-glass-card border border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white font-sans">Safe-Skip Predictions</h3>
                <p className="text-[11px] text-zinc-400 font-sub font-light leading-relaxed">
                  Real-time bunk budget and exact class recovery targets to remain compliant.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl liquid-glass-card border border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0 mt-0.5">
                <Layers className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white font-sans">Batch-Split Lab Matrices</h3>
                <p className="text-[11px] text-zinc-400 font-sub font-light leading-relaxed">
                  Full multi-period timetable synchronization with student batch selection.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl liquid-glass-card border border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white font-sans">Offline Resilience & PWA</h3>
                <p className="text-[11px] text-zinc-400 font-sub font-light leading-relaxed">
                  Installable directly on mobile home screens with background sync offline queue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
