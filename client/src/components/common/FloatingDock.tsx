import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  History,
  BarChart3,
  Bell,
  Settings,
} from 'lucide-react';

export interface FloatingDockItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

const defaultItems: FloatingDockItem[] = [
  { title: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/' },
  { title: 'Timetable', icon: <Calendar className="w-5 h-5" />, href: '/timetable' },
  { title: 'Subjects', icon: <BookOpen className="w-5 h-5" />, href: '/subjects' },
  { title: 'History', icon: <History className="w-5 h-5" />, href: '/history' },
  { title: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, href: '/analytics' },
  { title: 'Notifications', icon: <Bell className="w-5 h-5" />, href: '/notifications' },
  { title: 'Settings', icon: <Settings className="w-5 h-5" />, href: '/settings' },
];

export const FloatingDock: React.FC<{
  items?: FloatingDockItem[];
  className?: string;
}> = ({ items = defaultItems, className = '' }) => {
  const mouseX = useMotionValue(Infinity);
  const location = useLocation();

  return (
    <div
      className={`fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-auto max-w-[96vw] ${className}`}
    >
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="mx-auto flex h-14 sm:h-16 items-center gap-1.5 sm:gap-3 rounded-full sm:rounded-3xl bg-black/75 px-3 sm:px-4 py-1.5 sm:py-2 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/80 ring-1 ring-white/5"
      >
        {items.map((item) => (
          <FloatingDockIcon
            key={item.title}
            mouseX={mouseX}
            item={item}
            isActive={location.pathname === item.href}
          />
        ))}
      </motion.div>
    </div>
  );
};

const FloatingDockIcon: React.FC<{
  mouseX: any;
  item: FloatingDockItem;
  isActive: boolean;
}> = ({ mouseX, item, isActive }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 56, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 56, 40]);

  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <Link to={item.href}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative flex items-center justify-center rounded-2xl transition-colors ${
          isActive
            ? 'bg-white text-black shadow-lg'
            : 'bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white'
        }`}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 2, x: '-50%' }}
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-pre rounded-lg bg-zinc-900 px-2 py-0.5 text-[11px] font-sub text-zinc-200 border border-white/10 shadow-xl pointer-events-none"
            >
              {item.title}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center">{item.icon}</div>

        {/* Active Pill Indicator */}
        {isActive && (
          <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-white" />
        )}
      </motion.div>
    </Link>
  );
};
