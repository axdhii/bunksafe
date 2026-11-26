import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { calculateAttendance, calculateProjectionScenario, calculateAttendanceStreak, RiskLevel } from '../utils/attendanceEngine.js';
import { sendSmartNotification } from '../services/notificationService.js';
import { batchMatches, isValidBatch } from '../utils/batch.js';
import { parseThreshold } from './academicController.js';

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'CANCELLED', 'RESCHEDULED', 'HOLIDAY'];

/** A real calendar date in YYYY-MM-DD form that is not after today (college time). */
export function isValidAttendanceDate(date: unknown, today = getCollegeDate().dateStr): boolean {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date <= today;
}

interface AttendanceInput {
  subjectId: string;
  timetableEntryId?: string | null;
  date: string;
  status: string;
  remarks?: string | null;
  syncId?: string | null;
}

/**
 * Creates or updates the one record for a class. Prisma cannot upsert on a NULL key and timetable
 * edits can leave records with a NULL slot, so the lookup is: exact slot -> orphaned record for the same
 * subject/day (adopted onto the slot) -> create.
 * Options: onlyIfMissing leaves existing records alone; notAfter skips records changed after that time.
 * shortcut: find-then-write is not atomic; two simultaneous taps can still race, add a DB-level partial unique index if that shows up.
 */
async function saveAttendance(studentId: string, input: AttendanceInput, opts: { onlyIfMissing?: boolean; notAfter?: Date } = {}) {
  const entryId = input.timetableEntryId || null;
  const existing =
    (entryId &&
      (await prisma.attendance.findFirst({
        where: { studentId, subjectId: input.subjectId, date: input.date, timetableEntryId: entryId },
      }))) ||
    (await prisma.attendance.findFirst({
      where: { studentId, subjectId: input.subjectId, date: input.date, timetableEntryId: null },
      orderBy: { createdAt: 'asc' },
    }));

  const data = { status: input.status, remarks: input.remarks ?? null, syncId: input.syncId ?? null };
  if (existing) {
    if (opts.onlyIfMissing) return existing;
    if (opts.notAfter && existing.updatedAt > opts.notAfter) return existing; // newer mark wins
    return prisma.attendance.update({
      where: { id: existing.id },
      data: { ...data, timetableEntryId: entryId ?? existing.timetableEntryId },
    });
  }
  return prisma.attendance.create({
    data: { studentId, subjectId: input.subjectId, date: input.date, timetableEntryId: entryId, ...data },
  });
}

/** Checks a mark against the student's cohort and active timetable. Returns an error message or null. */
async function validateMark(
  student: { semesterId: string; branchId: string; sectionId: string },
  input: AttendanceInput,
  subjectsById: Map<string, { semesterId: string; branchId: string }>
): Promise<string | null> {
  if (!input.subjectId || !VALID_STATUSES.includes(input.status)) return 'Invalid subject or status.';
  if (!isValidAttendanceDate(input.date)) return 'Date must be a valid YYYY-MM-DD date that is not in the future.';
  const subject = subjectsById.get(input.subjectId);
  if (!subject) return 'Subject not found.';
  if (subject.semesterId !== student.semesterId || subject.branchId !== student.branchId) {
    return 'Subject does not belong to your enrolled academic cohort.';
  }
  if (input.timetableEntryId) {
    const entry = await prisma.timetableEntry.findUnique({
      where: { id: String(input.timetableEntryId) },
      include: { timetable: { select: { sectionId: true } } },
    });
    if (!entry || entry.subjectId !== input.subjectId || entry.timetable.sectionId !== student.sectionId) {
      return 'That class slot does not match this subject in your timetable.';
    }
  }
  return null;
}

export function getCollegeDate(refDate: Date = new Date()): { dateStr: string; dayOfWeek: number } {
  // Asia/Kolkata timezone ensures serverless hosts in UTC resolve the correct campus day
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(refDate);

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  const weekday = dayFormatter.format(refDate);
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dayOfWeek = weekdayMap[weekday] || 1;

  return { dateStr, dayOfWeek };
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;

    // 1. Fetch student with academic info
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        semester: true,
        branch: true,
        section: true,
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // PERF-2: Run independent queries in parallel instead of sequentially
    const [thresholdSetting, subjects, attendanceRecords] = await Promise.all([
      // 2. Fetch global threshold setting
      prisma.systemSetting.findUnique({
        where: { key: 'MINIMUM_ATTENDANCE_THRESHOLD' },
      }),
      // 3. Fetch all subjects for this semester & branch
      prisma.subject.findMany({
        where: {
          semesterId: student.semesterId,
          branchId: student.branchId,
        },
        orderBy: { code: 'asc' },
      }),
      // 4. Fetch all attendance records for this student
      prisma.attendance.findMany({
        where: { studentId },
        include: { subject: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const defaultThreshold = parseThreshold(thresholdSetting?.value) ?? 85.0;

    // 5. Compute per-subject metrics
    let totalConducted = 0;
    let totalAttended = 0;
    let totalAbsent = 0;

    const subjectStats = subjects.map((sub) => {
      const records = attendanceRecords.filter((r) => r.subjectId === sub.id);
      let attended = 0;
      let conducted = 0;
      let absent = 0;
      let cancelled = 0;

      for (const r of records) {
        if (r.status === 'PRESENT') {
          attended += 1;
          conducted += 1;
        } else if (r.status === 'ABSENT') {
          absent += 1;
          conducted += 1;
        } else if (r.status === 'CANCELLED' || r.status === 'RESCHEDULED' || r.status === 'HOLIDAY') {
          cancelled += 1; // Does NOT penalize student
        }
      }

      totalConducted += conducted;
      totalAttended += attended;
      totalAbsent += absent;

      const metrics = calculateAttendance(attended, conducted, sub.minimumThreshold);

      // Trend: compare with attendance before the latest conducted record
      let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
      if (conducted > 1) {
        const conductedRecords = records.filter((r) => r.status === 'PRESENT' || r.status === 'ABSENT');
        const prevRecords = conductedRecords.slice(0, -1);
        const prevAttended = prevRecords.filter((r) => r.status === 'PRESENT').length;
        const prevConducted = prevRecords.length;
        const prevRatio = prevAttended / prevConducted;
        const currentRatio = attended / conducted;
        if (currentRatio > prevRatio + 0.005) trend = 'UP';
        else if (currentRatio < prevRatio - 0.005) trend = 'DOWN';
      }

      return {
        id: sub.id,
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        minimumThreshold: sub.minimumThreshold,
        conducted,
        attended,
        absent,
        cancelled,
        percentage: metrics.percentage,
        risk: metrics.risk,
        safeSkips: metrics.safeSkips,
        recoveryRequired: metrics.recoveryRequired,
        nextIfAttended: metrics.nextIfAttended,
        nextIfMissed: metrics.nextIfMissed,
        trend,
      };
    });

    // 6. Compute overall metrics
    const overallMetrics = calculateAttendance(totalAttended, totalConducted, defaultThreshold);

    // 7. Compute streaks
    const { currentStreak, longestStreak } = calculateAttendanceStreak(attendanceRecords);

    // 8. Determine today's classes in College timezone (Asia/Kolkata)
    const { dateStr: todayDateStr, dayOfWeek } = getCollegeDate();

    // PERF-2: Run timetable + notification count in parallel
    const [timetable, unreadNotificationCount] = await Promise.all([
      // Find active timetable for student's section
      prisma.timetable.findFirst({
        where: {
          sectionId: student.sectionId,
          semesterId: student.semesterId,
          branchId: student.branchId,
          isActive: true,
        },
        include: {
          entries: {
            where: { dayOfWeek },
            include: { subject: true },
            orderBy: { startTime: 'asc' },
          },
        },
      }),
      // 9. Count unread notifications
      prisma.notification.count({
        where: { studentId, isRead: false },
      }),
    ]);

    const todayClasses = (timetable?.entries || []).map((entry) => {
      // Check if student has already marked attendance for this specific slot today
      const marked = attendanceRecords.find(
        (r) =>
          r.date === todayDateStr &&
          (r.timetableEntryId
            ? r.timetableEntryId === entry.id
            : (entry.subjectId && r.subjectId === entry.subjectId))
      );

      const subStat = entry.subjectId ? subjectStats.find((s) => s.id === entry.subjectId) : undefined;
      const risk = subStat?.risk || 'SAFE';
      const safeSkips = subStat?.safeSkips || 0;
      const recoveryRequired = subStat?.recoveryRequired || 0;
      const isSafeToSkip = safeSkips > 0;

      return {
        id: entry.id,
        timetableEntryId: entry.id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        type: entry.type,
        faculty: entry.faculty,
        room: entry.room,
        title: entry.title,
        batch: entry.batch || 'ALL',
        subjectId: entry.subjectId,
        appliesToMe: batchMatches(entry.batch, student.batch),
        subject: entry.subject
          ? {
              id: entry.subject.id,
              code: entry.subject.code,
              name: entry.subject.name,
              minimumThreshold: entry.subject.minimumThreshold,
            }
          : null,
        status: marked ? marked.status : undefined,
        attendanceId: marked ? marked.id : undefined,
        risk,
        safeSkips,
        recoveryRequired,
        isSafeToSkip,
      };
    });

    res.json({
      student: {
        id: student.id,
        usn: student.usn,
        name: student.name,
        email: student.email,
        batch: student.batch,
        semester: student.semester,
        branch: student.branch,
        section: student.section,
      },
      threshold: defaultThreshold,
      overall: {
        conducted: totalConducted,
        attended: totalAttended,
        absent: totalAbsent,
        percentage: overallMetrics.percentage,
        risk: overallMetrics.risk,
        safeSkips: overallMetrics.safeSkips,
        recoveryRequired: overallMetrics.recoveryRequired,
        trend: 'STABLE',
      },
      streaks: {
        current: currentStreak,
        longest: longestStreak,
        consistencyScore: totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 100,
      },
      todayClasses,
      subjectStats,
      unreadNotificationCount,
    });
  } catch (error: any) {
    // PERF-8: Return a proper error instead of hardcoded demo data
    console.error('getDashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data. Please try again.' });
  }
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const { subjectId, timetableEntryId, date, status, remarks, syncId } = req.body;

    if (!subjectId || !date || !status) {
      res.status(400).json({ error: 'Missing required fields: subjectId, date, status.' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { semesterId: true, branchId: true, sectionId: true },
    });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const subject = await prisma.subject.findUnique({ where: { id: String(subjectId) } });
    if (!subject) {
      res.status(404).json({ error: 'Subject not found.' });
      return;
    }

    const input: AttendanceInput = {
      subjectId: subject.id,
      timetableEntryId: timetableEntryId ? String(timetableEntryId) : null,
      date: String(date),
      status: String(status),
      remarks: remarks ? String(remarks).slice(0, 500) : null,
      syncId: syncId ? String(syncId) : null,
    };
    const invalid = await validateMark(student, input, new Map([[subject.id, subject]]));
    if (invalid) {
      res.status(invalid.includes('cohort') ? 403 : 400).json({ error: invalid });
      return;
    }

    const countMetrics = async () => {
      const [conducted, attended] = await Promise.all([
        prisma.attendance.count({ where: { studentId, subjectId: subject.id, status: { in: ['PRESENT', 'ABSENT'] } } }),
        prisma.attendance.count({ where: { studentId, subjectId: subject.id, status: 'PRESENT' } }),
      ]);
      return calculateAttendance(attended, conducted, subject.minimumThreshold);
    };

    const prevMetrics = await countMetrics();
    const attendanceRecord = await saveAttendance(studentId, input);
    const newMetrics = await countMetrics();

    // Trigger Smart Notifications on state transitions
    if (prevMetrics.risk !== 'CRITICAL' && newMetrics.risk === 'CRITICAL') {
      await sendSmartNotification({
        studentId,
        title: `Attendance Alert: ${subject.name}`,
        message: `Your attendance in ${subject.code} has fallen to ${newMetrics.percentage}%, below the required ${subject.minimumThreshold}%. You need ${newMetrics.recoveryRequired} consecutive classes to recover.`,
        category: 'ATTENDANCE_WARNING',
        deduplicationKey: `ATTENDANCE_WARNING:${studentId}:${subject.id}:CRITICAL:${input.date}`,
        isUrgent: true,
      });
    } else if (prevMetrics.risk === 'CRITICAL' && newMetrics.risk !== 'CRITICAL') {
      await sendSmartNotification({
        studentId,
        title: `Recovery Achieved: ${subject.name}`,
        message: `Great job! Your attendance in ${subject.code} has recovered to ${newMetrics.percentage}%.`,
        category: 'RECOVERY',
        deduplicationKey: `RECOVERY:${studentId}:${subject.id}:SAFE:${input.date}`,
      });
    }

    res.json({
      success: true,
      record: attendanceRecord,
      updatedMetrics: newMetrics,
    });
  } catch (error: any) {
    console.error('markAttendance error:', error);
    res.status(500).json({ error: 'Could not save attendance. Please try again.' });
  }
}

export async function setStudentBatch(req: Request, res: Response): Promise<void> {
  try {
    const { batch } = req.body;
    if (!isValidBatch(batch)) {
      res.status(400).json({ error: 'Batch must look like A1, B2 or 1.' });
      return;
    }
    const student = await prisma.student.update({
      where: { id: req.user!.studentId! },
      data: { batch: String(batch).trim().toUpperCase() },
      select: { batch: true },
    });
    res.json({ success: true, batch: student.batch });
  } catch (error: any) {
    console.error('setStudentBatch error:', error);
    res.status(500).json({ error: 'Failed to update batch.' });
  }
}

export async function batchMarkTodayPresent(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const { dateStr: todayDateStr, dayOfWeek } = getCollegeDate();

    const timetable = await prisma.timetable.findFirst({
      where: {
        sectionId: student.sectionId,
        semesterId: student.semesterId,
        branchId: student.branchId,
        isActive: true,
      },
      include: {
        entries: {
          where: { dayOfWeek },
        },
      },
    });

    if (!timetable || timetable.entries.length === 0) {
      res.status(400).json({ error: "No classes scheduled for today to mark." });
      return;
    }

    // Only the student's own batch, so parallel split labs are not double-credited
    const validClassEntries = timetable.entries.filter(
      (entry) => entry.subjectId && batchMatches(entry.batch, student.batch)
    );

    if (validClassEntries.length === 0) {
      res.status(400).json({ error: "No classes scheduled for your batch today to mark." });
      return;
    }

    // Never overwrite a status the student already chose (ABSENT, CANCELLED, ...)
    for (const entry of validClassEntries) {
      await saveAttendance(
        studentId,
        { subjectId: entry.subjectId!, timetableEntryId: entry.id, date: todayDateStr, status: 'PRESENT' },
        { onlyIfMissing: true }
      );
    }

    res.json({
      success: true,
      message: `Marked unmarked classes as present for today (${validClassEntries.length} in your schedule).`,
    });
  } catch (error: any) {
    console.error('batchMarkTodayPresent error:', error);
    res.status(500).json({ error: 'Failed to mark all classes present.' });
  }
}

export async function getAttendanceHistory(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const { subjectId, status, startDate, endDate } = req.query;

    const whereClause: any = { studentId };

    if (subjectId && typeof subjectId === 'string') {
      whereClause.subjectId = subjectId;
    }
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }
    if (startDate && typeof startDate === 'string') {
      whereClause.date = { ...whereClause.date, gte: startDate };
    }
    if (endDate && typeof endDate === 'string') {
      whereClause.date = { ...whereClause.date, lte: endDate };
    }

    const take = Math.min(Math.max(1, Number(req.query.limit) || 100), 200);
    const skip = Math.max(0, Number(req.query.offset) || 0);

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        subject: true,
        timetableEntry: true,
      },
      orderBy: { date: 'desc' },
      take,
      skip,
    });

    const formatted = records.map((r) => ({
      id: r.id,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      subjectCode: r.subject.code,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
      startTime: r.timetableEntry?.startTime,
      endTime: r.timetableEntry?.endTime,
      type: r.timetableEntry?.type,
    }));

    res.json({ records: formatted });
  } catch (error: any) {
    console.error('getAttendanceHistory error:', error);
    res.status(500).json({ error: 'Failed to load attendance history.' });
  }
}

export async function getProjections(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const subjects = await prisma.subject.findMany({
      where: {
        semesterId: student.semesterId,
        branchId: student.branchId,
      },
    });

    const attendances = await prisma.attendance.findMany({
      where: { studentId },
    });

    // Approximate remaining classes based on weekly timetable entries * remaining weeks (e.g. 8 weeks)
    const timetable = await prisma.timetable.findFirst({
      where: {
        sectionId: student.sectionId,
        isActive: true,
      },
      include: { entries: true, academicYear: true },
    });

    // Remaining teaching weeks until the academic year ends (8 if no end date is known)
    const endDate = timetable?.academicYear?.endDate;
    const remainingWeeks = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
      : 8;

    const projections = subjects.map((sub) => {
      const records = attendances.filter((r) => r.subjectId === sub.id);
      let attended = 0;
      let conducted = 0;
      for (const r of records) {
        if (r.status === 'PRESENT') { attended++; conducted++; }
        else if (r.status === 'ABSENT') { conducted++; }
      }

      // Count classes per week for this subject
      const weeklySlots =
        timetable?.entries.filter((e) => e.subjectId === sub.id && batchMatches(e.batch, student.batch)).length ?? 0;
      const estimatedRemaining = weeklySlots * remainingWeeks;

      const scenario = calculateProjectionScenario(attended, conducted, estimatedRemaining);

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        currentPercentage: scenario.current,
        totalRemaining: scenario.totalRemaining,
        attendAllRemaining: scenario.attendAllRemaining,
        attend90Remaining: scenario.attend90Remaining,
        attend85Remaining: scenario.attend85Remaining,
        attend75Remaining: scenario.attend75Remaining,
        missNext1: scenario.missNext1,
        missNext2: scenario.missNext2,
        attendNext1: scenario.attendNext1,
        attendNext3: scenario.attendNext3,
      };
    });

    res.json({ projections });
  } catch (error: any) {
    console.error('getProjections error:', error);
    res.status(500).json({ error: 'Failed to generate projections.' });
  }
}

export async function syncOfflineAttendance(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.json({ success: true, synced: 0, processed: [], rejected: [] });
      return;
    }

    if (items.length > 100) {
      res.status(400).json({ error: 'Maximum 100 attendance items can be synced at once.' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { semesterId: true, branchId: true, sectionId: true },
    });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const subjectIds = [...new Set(items.map((i: any) => String(i?.subjectId || '')).filter(Boolean))];
    const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    const subjectsById = new Map(subjects.map((s) => [s.id, s]));

    // processed: syncIds the client can drop from its queue; rejected: ones that can never succeed
    const processed: string[] = [];
    const rejected: string[] = [];
    for (const item of items) {
      const syncId = item?.syncId ? String(item.syncId) : '';
      const input: AttendanceInput = {
        subjectId: String(item?.subjectId || ''),
        timetableEntryId: item?.timetableEntryId ? String(item.timetableEntryId) : null,
        date: String(item?.date || ''),
        status: String(item?.status || ''),
        remarks: item?.remarks ? String(item.remarks).slice(0, 500) : null,
        syncId: syncId || null,
      };
      const invalid = await validateMark(student, input, subjectsById);
      if (invalid) {
        rejected.push(syncId);
      } else {
        const markedAt = Number(item.timestamp);
        await saveAttendance(studentId, input, {
          notAfter: Number.isFinite(markedAt) && markedAt > 0 ? new Date(markedAt) : undefined,
        });
      }
      processed.push(syncId);
    }

    res.json({ success: true, synced: processed.length - rejected.length, processed, rejected });
  } catch (error: any) {
    console.error('syncOfflineAttendance error:', error);
    res.status(500).json({ error: 'Failed to sync offline attendance records.' });
  }
}
