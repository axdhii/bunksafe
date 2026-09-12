import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

export interface QueuedAttendance {
  syncId: string;
  subjectId: string;
  timetableEntryId?: string;
  date: string;
  status: string;
  timestamp: number;
}

const STORAGE_KEY = 'aurora_offline_queue';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() => {
    try {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return items.length;
    } catch {
      return 0;
    }
  });

  const getQueue = (): QueuedAttendance[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveQueue = (queue: QueuedAttendance[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    setPendingCount(queue.length);
  };

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const queue = getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      await apiRequest('/attendance/sync', {
        method: 'POST',
        data: { items: queue },
      });
      // Clear queue on success
      saveQueue([]);
    } catch (err) {
      console.warn('Offline sync failed, will retry on next connection:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const queueAttendance = (item: Omit<QueuedAttendance, 'syncId' | 'timestamp'>) => {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullItem: QueuedAttendance = {
      ...item,
      syncId,
      timestamp: Date.now(),
    };
    const queue = getQueue();
    // Replace any existing queued entry for same subject + date
    const filtered = queue.filter(
      (q) => !(q.subjectId === item.subjectId && q.date === item.date && q.timetableEntryId === item.timetableEntryId)
    );
    filtered.push(fullItem);
    saveQueue(filtered);
    return syncId;
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Try flushing on mount if online
    if (navigator.onLine) {
      flushQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queueAttendance,
    flushQueue,
  };
}
