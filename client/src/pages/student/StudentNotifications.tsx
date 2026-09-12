import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, AlertTriangle, ShieldCheck, Clock, Info, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { NotificationItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';

export const StudentNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/notifications');
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading alerts & updates...</p>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATTENDANCE_WARNING':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'SKIP_WARNING':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'CLASS_REMINDER':
        return <Clock className="w-5 h-5 text-zinc-400" />;
      case 'RECOVERY':
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
      default:
        return <Info className="w-5 h-5 text-zinc-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-4xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Alert Center"
        title="Notifications"
        subtitle="Smart, deduplicated triggers and academic announcements"
        actions={
          unreadCount > 0 ? (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl liquid-glass hover:bg-white/15 text-xs font-medium text-zinc-200 border border-white/10 transition-all active:scale-95 shadow-sm font-sub"
            >
              <CheckCheck className="w-4 h-4 text-white" />
              <span>Mark all read</span>
            </button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <div className="p-12 rounded-3xl liquid-glass-card text-center space-y-2">
          <Bell className="w-10 h-10 text-zinc-500 mx-auto" />
          <h4 className="text-base font-bold text-white font-sans">All caught up!</h4>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sub font-light">
            You have no notifications at this time. We only alert you when attendance state materially changes.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => !item.isRead && handleMarkRead(item.id)}
              className={`p-4 rounded-2xl transition-all cursor-pointer border flex items-start gap-3.5 ${
                !item.isRead
                  ? 'liquid-glass-card border-white/30 bg-white/[0.04]'
                  : 'liquid-glass-card border-white/[0.06] opacity-60'
              }`}
            >
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 shrink-0 mt-0.5">
                {getCategoryIcon(item.category)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-bold truncate font-sans ${!item.isRead ? 'text-white' : 'text-zinc-300'}`}>
                    {item.title}
                  </h4>
                  <span className="text-[11px] font-sub font-light text-zinc-400 shrink-0">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed font-sub font-light">{item.message}</p>
              </div>

              {!item.isRead && (
                <span className="w-2 h-2 rounded-full bg-white shrink-0 self-center" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
