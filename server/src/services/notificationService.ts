import { prisma } from '../prisma/client.js';
import webpush from 'web-push';

// Configure Web Push if keys are present
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.warn('Web push initialization error (non-fatal):', err);
  }
}

export type NotificationCategory =
  | 'CLASS_REMINDER'
  | 'ATTENDANCE_WARNING'
  | 'SKIP_WARNING'
  | 'RECOVERY'
  | 'DAILY_SUMMARY'
  | 'WEEKLY_SUMMARY'
  | 'RISK_CHANGE'
  | 'SYSTEM';

export interface NotificationPayload {
  studentId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  deduplicationKey?: string;
  isUrgent?: boolean;
}

/**
 * Checks if current time falls within student's quiet hours.
 * quietHoursStart and quietHoursEnd are "HH:MM" in 24h format.
 */
export function isWithinQuietHours(start: string, end: string, checkDate: Date = new Date()): boolean {
  const currentMinutes = checkDate.getHours() * 60 + checkDate.getMinutes();

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;

  if (startTotal <= endTotal) {
    // e.g. 01:00 to 06:00
    return currentMinutes >= startTotal && currentMinutes <= endTotal;
  } else {
    // Crosses midnight, e.g. 23:00 to 07:00
    return currentMinutes >= startTotal || currentMinutes <= endTotal;
  }
}

export async function sendSmartNotification(payload: NotificationPayload): Promise<boolean> {
  const { studentId, title, message, category, deduplicationKey, isUrgent } = payload;

  // 1. Fetch student preferences
  const pref = await prisma.notificationPreference.findUnique({
    where: { studentId },
  });

  if (pref) {
    // Check quiet hours
    if (!isUrgent && pref.quietHoursEnabled) {
      if (isWithinQuietHours(pref.quietHoursStart, pref.quietHoursEnd)) {
        // Suppress non-urgent notifications during quiet hours
        return false;
      }
    }

    // Check category preferences
    if (category === 'CLASS_REMINDER' && !pref.classReminders) return false;
    if (category === 'ATTENDANCE_WARNING' && !pref.attendanceWarnings) return false;
    if (category === 'SKIP_WARNING' && !pref.skipWarnings) return false;
    if (category === 'RECOVERY' && !pref.recoveryNotifications) return false;
    if (category === 'DAILY_SUMMARY' && !pref.dailySummary) return false;
    if (category === 'WEEKLY_SUMMARY' && !pref.weeklySummary) return false;
  }

  // 2. Deduplication check
  if (deduplicationKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        studentId,
        deduplicationKey,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // If notification with identical key was already created within last 24 hours, suppress
      const diffMs = Date.now() - existing.createdAt.getTime();
      if (diffMs < 24 * 60 * 60 * 1000) {
        return false;
      }
    }
  }

  // 3. Persist notification
  await prisma.notification.create({
    data: {
      studentId,
      title,
      message,
      category,
      deduplicationKey,
    },
  });

  // 4. Dispatch Web Push if subscriptions exist
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { studentId },
    });

    const pushPayload = JSON.stringify({
      title,
      body: message,
      icon: '/pwa-192x192.png',
      badge: '/favicon.svg',
      data: { category, studentId },
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or invalid; clean it up
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Non-fatal if web push is not configured or fails
  }

  return true;
}
