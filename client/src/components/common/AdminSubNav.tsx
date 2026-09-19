import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Users,
  BookOpen,
  Calendar,
  Bell,
  Settings,
} from 'lucide-react';

const ADMIN_NAV_LINKS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/academic', label: 'Structure', icon: Layers },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/admin/timetable', label: 'Timetable', icon: Calendar },
  { to: '/admin/notifications', label: 'Broadcast', icon: Bell },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export const AdminSubNav: React.FC = () => {
  return (
    <div className="sticky top-[57px] z-20 w-full bg-black/75 backdrop-blur-xl border-b border-white/[0.06] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {ADMIN_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white text-black font-sans font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] font-sub font-light'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
