import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Flame, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  unreadCount?: number;
  currentStreak?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ unreadCount = 0, currentStreak = 0 }) => {
  const { user, student, admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 w-full liquid-glass border-b border-white/[0.07] px-4 sm:px-6 py-3 transition-colors bg-black/70 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-white font-black text-sm group-hover:bg-white/15 transition-all">
            B
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-white block leading-tight">
              Bunk<span className="text-zinc-400 font-normal">Safe</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-sub tracking-wider uppercase block">
              Attendance Assist
            </span>
          </div>
        </Link>

        {/* Center Pill (Academic Info for Student / Admin Shield) */}
        <div className="hidden md:flex items-center gap-2">
          {student && (
            <div className="px-3.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-medium text-zinc-300 flex items-center gap-2">
              <span className="text-white font-mono font-semibold">{student.usn}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-sub">Sem {student.semester.number}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-sub">{student.branch.code}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-sub">Sec {student.section.name}</span>
            </div>
          )}

          {admin && (
            <div className="px-3.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 font-sub">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Streak indicator if student */}
          {student && currentStreak > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-zinc-200 text-xs font-bold mr-1 select-none"
              title={`${currentStreak} consecutive classes attended!`}
            >
              <Flame className="w-3.5 h-3.5 fill-zinc-300 text-zinc-300" />
              <span className="font-mono">{currentStreak}</span>
            </div>
          )}

          {/* Notifications button */}
          {student && (
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
            title="Log Out"
            aria-label="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
