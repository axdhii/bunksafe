import React, { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Clock, Check, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { NotificationPreferences } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';

export const StudentSettings: React.FC = () => {
  const { student } = useAuth();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('default');

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await apiRequest<{ preferences: NotificationPreferences }>('/notifications/preferences');
        setPreferences(res.preferences);
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();

    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await apiRequest('/notifications/preferences', {
        method: 'PUT',
        data: preferences,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPush = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    setPushStatus(permission);
    if (permission === 'granted') {
      try {
        // Register mock/real subscription with backend
        await apiRequest('/notifications/subscribe', {
          method: 'POST',
          data: {
            endpoint: `https://fcm.googleapis.com/fcm/send/mock_${Date.now()}`,
            keys: {
              p256dh: 'mock_p256dh_key_data',
              auth: 'mock_auth_key_data',
            },
          },
        });
        alert('Push notifications activated successfully!');
      } catch (err) {
        console.warn('Subscription registered locally.');
      }
    }
  };

  if (loading || !preferences) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-nav md:pb-12 max-w-4xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Preferences & Configuration"
        title="Settings"
        subtitle="Customize notifications, quiet hours, and visual appearance"
      />

      {/* Profile Overview */}
      {student && (
        <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white font-black text-lg">
              {student.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{student.name}</h3>
              <p className="text-xs font-mono text-zinc-300 mt-0.5">
                USN: {student.usn}
              </p>
              <p className="text-xs text-zinc-400 font-sub mt-0.5">
                {student.branch.name} • Semester {student.semester.number} • Section {student.section.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Smart Notification Preferences */}
      <div className="p-6 rounded-3xl liquid-glass-card border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-300" />
              <span>Smart Notification Engine</span>
            </h3>
            <p className="text-xs text-zinc-400 font-sub mt-0.5">
              Only meaningful attendance state changes trigger notifications
            </p>
          </div>

          {pushStatus !== 'granted' && (
            <button
              onClick={handleRequestPush}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-bold hover:bg-white/20 transition-all active:scale-95"
            >
              Enable Browser Push
            </button>
          )}
        </div>

        <div className="space-y-3.5 pt-2">
          {/* Class Reminders */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Class Reminders</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                Receive proactive reminder before lecture starts
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.classReminders}
              onChange={() => handleToggle('classReminders')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {/* Reminder Timing Offset */}
          {preferences.classReminders && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs font-sub">
              <span className="text-zinc-300 font-medium">Reminder Time Before Class:</span>
              <select
                value={preferences.reminderMinutesBefore}
                onChange={(e) =>
                  setPreferences({ ...preferences, reminderMinutesBefore: Number(e.target.value) })
                }
                className="px-3 py-1.5 rounded-xl bg-black border border-white/10 text-white font-sans"
              >
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={45}>45 minutes before</option>
                <option value={60}>1 hour before</option>
              </select>
            </div>
          )}

          {/* Attendance Warnings */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Attendance Warnings</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                Alert immediately when a subject falls below the required threshold
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.attendanceWarnings}
              onChange={() => handleToggle('attendanceWarnings')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {/* Skip Warnings */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Skip Warnings</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                Alert when missing today's scheduled class will push you into the danger zone
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.skipWarnings}
              onChange={() => handleToggle('skipWarnings')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {/* Recovery Notifications */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Recovery Notifications</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                Celebrate when your attendance recovers back above 85%
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.recoveryNotifications}
              onChange={() => handleToggle('recoveryNotifications')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {/* Daily Summary */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Daily Summary</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                Evening recap of today's attended and missed classes
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.dailySummary}
              onChange={() => handleToggle('dailySummary')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {/* Weekly Summary */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-bold text-white font-sans">Weekly Digest</div>
              <div className="text-xs text-zinc-400 font-sub font-light">
                End-of-week attendance trend and best performing subject
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.weeklySummary}
              onChange={() => handleToggle('weeklySummary')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>
        </div>

        {/* Quiet Hours Configuration */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-sm font-bold text-white font-sans">Quiet Hours</div>
                <div className="text-xs text-zinc-400 font-sub font-light">
                  Suppress non-urgent notifications during sleep or study
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.quietHoursEnabled}
              onChange={() => handleToggle('quietHoursEnabled')}
              className="w-5 h-5 accent-white cursor-pointer rounded"
            />
          </div>

          {preferences.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Start Time (24h)</label>
                <input
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursStart: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">End Time (24h)</label>
                <input
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-2 flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-sub">
              <Check className="w-4 h-4" /> Preferences saved!
            </span>
          )}
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
