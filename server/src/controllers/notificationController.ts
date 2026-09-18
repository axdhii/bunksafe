import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { sendSmartNotification } from '../services/notificationService.js';
import { logAuditAction } from '../services/auditService.js';

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const notifications = await prisma.notification.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ notifications });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const id = String(req.params.id);
    await prisma.notification.updateMany({
      where: { id, studentId },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    await prisma.notification.updateMany({
      where: { studentId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    let pref = await prisma.notificationPreference.findUnique({
      where: { studentId },
    });
    if (!pref) {
      pref = await prisma.notificationPreference.create({
        data: { studentId },
      });
    }
    res.json({ preferences: pref });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve notification preferences.' });
  }
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const {
      classReminders,
      reminderMinutesBefore,
      attendanceWarnings,
      skipWarnings,
      recoveryNotifications,
      dailySummary,
      weeklySummary,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    } = req.body;

    const pref = await prisma.notificationPreference.upsert({
      where: { studentId },
      update: {
        classReminders: classReminders !== undefined ? Boolean(classReminders) : undefined,
        reminderMinutesBefore: reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) : undefined,
        attendanceWarnings: attendanceWarnings !== undefined ? Boolean(attendanceWarnings) : undefined,
        skipWarnings: skipWarnings !== undefined ? Boolean(skipWarnings) : undefined,
        recoveryNotifications: recoveryNotifications !== undefined ? Boolean(recoveryNotifications) : undefined,
        dailySummary: dailySummary !== undefined ? Boolean(dailySummary) : undefined,
        weeklySummary: weeklySummary !== undefined ? Boolean(weeklySummary) : undefined,
        quietHoursEnabled: quietHoursEnabled !== undefined ? Boolean(quietHoursEnabled) : undefined,
        quietHoursStart: quietHoursStart !== undefined ? String(quietHoursStart) : undefined,
        quietHoursEnd: quietHoursEnd !== undefined ? String(quietHoursEnd) : undefined,
      },
      create: {
        studentId,
        classReminders: Boolean(classReminders),
        reminderMinutesBefore: Number(reminderMinutesBefore) || 30,
        attendanceWarnings: Boolean(attendanceWarnings),
        skipWarnings: Boolean(skipWarnings),
        recoveryNotifications: Boolean(recoveryNotifications),
        dailySummary: Boolean(dailySummary),
        weeklySummary: Boolean(weeklySummary),
        quietHoursEnabled: Boolean(quietHoursEnabled),
        quietHoursStart: String(quietHoursStart || '23:00'),
        quietHoursEnd: String(quietHoursEnd || '07:00'),
      },
    });

    res.json({ preferences: pref });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
}

export async function subscribePush(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid push subscription payload.' });
      return;
    }

    await prisma.pushSubscription.upsert({
      where: {
        studentId_endpoint: {
          studentId,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
      create: {
        studentId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to register push subscription.' });
  }
}

export async function broadcastAnnouncement(req: Request, res: Response): Promise<void> {
  try {
    const { title, message, semesterId, branchId, sectionId } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required.' });
      return;
    }

    const where: any = { active: true };
    if (semesterId) where.semesterId = semesterId;
    if (branchId) where.branchId = branchId;
    if (sectionId) where.sectionId = sectionId;

    const students = await prisma.student.findMany({ where, select: { id: true } });

    // PERF-3: Batch-insert all notification records in one query instead of N sequential calls
    if (students.length > 0) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          studentId: s.id,
          title,
          message,
          category: 'SYSTEM',
          isRead: false,
        })),
      });

      // Fan out push notifications asynchronously (fire-and-forget, don't block response)
      // Process in chunks of 50 to avoid overwhelming the push service
      const CHUNK_SIZE = 50;
      const sendPushes = async () => {
        for (let i = 0; i < students.length; i += CHUNK_SIZE) {
          const chunk = students.slice(i, i + CHUNK_SIZE);
          await Promise.allSettled(
            chunk.map((s) =>
              sendSmartNotification({
                studentId: s.id,
                title,
                message,
                category: 'SYSTEM',
                isUrgent: true,
              }).catch(() => {}) // Swallow individual push failures
            )
          );
        }
      };
      sendPushes().catch(console.error); // Fire and forget
    }

    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'ANNOUNCEMENT_BROADCAST',
      details: { title, targetCount: students.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, count: students.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to broadcast announcement.' });
  }
}
