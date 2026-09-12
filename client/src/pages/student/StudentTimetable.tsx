import React, { useState, useEffect } from 'react';
import { Clock, MapPin, User as UserIcon, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { PageHeader } from '../../components/common/PageHeader';

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type: string;
  faculty?: string;
  room?: string;
  subject: {
    id: string;
    code: string;
    name: string;
    credits: number;
  };
}

const DAYS = [
  { dayOfWeek: 1, name: 'Monday', short: 'Mon' },
  { dayOfWeek: 2, name: 'Tuesday', short: 'Tue' },
  { dayOfWeek: 3, name: 'Wednesday', short: 'Wed' },
  { dayOfWeek: 4, name: 'Thursday', short: 'Thu' },
  { dayOfWeek: 5, name: 'Friday', short: 'Fri' },
  { dayOfWeek: 6, name: 'Saturday', short: 'Sat' },
];

export const StudentTimetable: React.FC = () => {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 1 : Math.min(6, jsDay);
  });
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        const res = await apiRequest<{ entries: TimetableEntry[] }>('/timetable/student');
        setEntries(res.entries || []);
      } catch (err) {
        console.error('Failed to load timetable:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, []);

  const dayEntries = entries
    .filter((e) => e.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Sparkles className="w-8 h-8 text-white animate-spin" />
        <p className="text-xs font-sub font-light text-zinc-400">Loading your weekly timetable...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <PageHeader
        category="Academic Schedule"
        title="Weekly Timetable"
        subtitle="View your scheduled lectures, labs, breaks, faculty and room allocations."
        actions={
          <div className="flex items-center p-1 rounded-xl liquid-glass border border-white/10 w-fit font-sub">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'day'
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Full Week Grid
            </button>
          </div>
        }
      />

      {viewMode === 'day' ? (
        <div className="space-y-4">
          {/* Day Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {DAYS.map((day) => {
              const isSelected = selectedDay === day.dayOfWeek;
              const count = entries.filter((e) => e.dayOfWeek === day.dayOfWeek).length;
              return (
                <button
                  key={day.dayOfWeek}
                  onClick={() => setSelectedDay(day.dayOfWeek)}
                  className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-white text-black font-bold border-white'
                      : 'liquid-glass text-zinc-300 border-white/[0.06] hover:bg-white/10 font-sub'
                  }`}
                >
                  <span>{day.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Classes for Selected Day */}
          {dayEntries.length === 0 ? (
            <div className="p-10 rounded-3xl liquid-glass-card text-center space-y-2">
              <span className="text-3xl">☕</span>
              <h4 className="text-base font-bold text-white font-sans">No classes on this day!</h4>
              <p className="text-xs text-zinc-400 font-sub font-light">
                You have no scheduled academic sessions for {DAYS.find((d) => d.dayOfWeek === selectedDay)?.name}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayEntries.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl liquid-glass-card border border-white/[0.08] hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Time block */}
                    <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center min-w-[90px] shrink-0 font-sub">
                      <div className="text-xs font-bold text-white font-sans">{item.startTime}</div>
                      <div className="text-[10px] text-zinc-500 my-0.5">to</div>
                      <div className="text-xs font-bold text-zinc-300">{item.endTime}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-xs font-bold text-white">
                          {item.subject.code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-300 font-sub uppercase font-medium">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-sub font-light">
                          {item.subject.credits} Credits
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1 font-sans">
                        {item.subject.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 font-sub font-light">
                    {item.room && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-300 font-medium">{item.room}</span>
                      </div>
                    )}
                    {item.faculty && (
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-300 font-medium">{item.faculty}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Full Week Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((d) => {
            const dayList = entries
              .filter((e) => e.dayOfWeek === d.dayOfWeek)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div key={d.dayOfWeek} className="p-4 rounded-2xl liquid-glass-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="text-sm font-bold text-white font-sans">{d.name}</h3>
                  <span className="text-xs text-zinc-400 font-sub">{dayList.length} classes</span>
                </div>

                {dayList.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3 text-center font-sub">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {dayList.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-bold text-white">{c.subject.code}</span>
                          <span className="font-sub text-zinc-400 text-[11px]">{c.startTime} - {c.endTime}</span>
                        </div>
                        <div className="font-medium text-zinc-200 truncate font-sans">{c.subject.name}</div>
                        {c.room && <div className="text-[11px] text-zinc-400 font-sub">Room: {c.room}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
