import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowRight, AlertCircle, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const AdminLoginPage: React.FC = () => {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginAdmin(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@college.edu');
    setPassword('Admin@123');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 aurora-blur-bg relative">
      <div className="w-full max-w-md space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/15 p-0.5 shadow-lg mb-2">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            Admin Control Center
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-sub font-light">
            Institutional management & academic governance
          </p>
        </div>

        {/* Login Card */}
        <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white font-sans">Administrator Login</h2>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-sub text-zinc-400 hover:text-white hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              <span>Fill Demo (admin@college.edu)</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2 font-sub">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 font-sub">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@college.edu"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 font-sub">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-sans"
                />
                <Lock className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-white text-black font-bold text-sm shadow-lg hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-sans"
            >
              <span>{loading ? 'Authenticating...' : 'Enter Admin Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link
            to="/login"
            className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1.5 transition-colors font-sub font-light"
          >
            <span>← Back to Student Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
