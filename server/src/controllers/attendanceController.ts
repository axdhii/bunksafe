import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { calculateAttendance, calculateProjectionScenario, calculateAttendanceStreak, RiskLevel } from '../utils/attendanceEngine.js';
import { sendSmartNotification } from '../services/notificationService.js';

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

    const defaultThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 85.0;

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

      const metrics = calculateAttendance(attended, conducted, sub.minimumThreshold || defaultThreshold);

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
        minimumThreshold: sub.minimumThreshold || defaultThreshold,
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

    // 8. Determine today's classes
    const today = new Date();
    // getDay: 0 is Sunday, 1 is Monday ... 6 is Saturday
    const jsDay = today.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const todayDateStr = today.toISOString().split('T')[0];

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
      // Check if student has already marked attendance for this class today
      const marked = attendanceRecords.find(
        (r) => r.date === todayDateStr && (r.timetableEntryId === entry.id || (entry.subjectId && r.subjectId === entry.subjectId))
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
        subject: entry.subject
          ? {
              id: entry.subject.id,
              code: entry.subject.code,
              name: entry.subject.name,
              minimumThreshold: entry.subject.minimumThreshold || defaultThreshold,
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

    const validStatuses = ['PRESENT', 'ABSENT', 'CANCELLED', 'RESCHEDULED', 'HOLIDAY'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status "${status}".` });
      return;
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      res.status(404).json({ error: 'Subject not found.' });
      return;
    }

    // PERF-4: Use count queries instead of loading all records into memory
    const [prevConducted, prevAttended] = await Promise.all([
      prisma.attendance.count({
        where: { studentId, subjectId, status: { in: ['PRESENT', 'ABSENT'] } },
      }),
      prisma.attendance.count({
        where: { studentId, subjectId, status: 'PRESENT' },
      }),
    ]);
    const prevMetrics = calculateAttendance(prevAttended, prevConducted, subject.minimumThreshold);

    // Upsert attendance record
    const attendanceRecord = await prisma.attendance.upsert({
      where: {
        studentId_subjectId_date_timetableEntryId: {
          studentId,
          subjectId,
          date,
          timetableEntryId: timetableEntryId || '',
        },
      },
      update: {
        status,
        remarks,
        syncId,
        updatedAt: new Date(),
      },
      create: {
        studentId,
        subjectId,
        timetableEntryId: timetableEntryId || null,
        date,
        status,
        remarks,
        syncId,
      },
    });

    // Compute new metrics using count queries
    const [newConducted, newAttended] = await Promise.all([
      prisma.attendance.count({
        where: { studentId, subjectId, status: { in: ['PRESENT', 'ABSENT'] } },
      }),
      prisma.attendance.count({
        where: { studentId, subjectId, status: 'PRESENT' },
      }),
    ]);
    const newMetrics = calculateAttendance(newAttended, newConducted, subject.minimumThreshold);

    // Trigger Smart Notifications on state transitions
    if (prevMetrics.risk !== 'CRITICAL' && newMetrics.risk === 'CRITICAL') {
      await sendSmartNotification({
        studentId,
        title: `Attendance Alert: ${subject.name}`,
        message: `Your attendance in ${subject.code} has fallen to ${newMetrics.percentage}%, below the required ${subject.minimumThreshold}%. You need ${newMetrics.recoveryRequired} consecutive classes to recover.`,
        category: 'ATTENDANCE_WARNING',
        deduplicationKey: `ATTENDANCE_WARNING:${studentId}:${subjectId}:CRITICAL:${date}`,
        isUrgent: true,
      });
    } else if (prevMetrics.risk === 'CRITICAL' && newMetrics.risk !== 'CRITICAL') {
      await sendSmartNotification({
        studentId,
        title: `Recovery Achieved: ${subject.name}`,
        message: `Great job! Your attendance in ${subject.code} has recovered to ${newMetrics.percentage}%.`,
        category: 'RECOVERY',
        deduplicationKey: `RECOVERY:${studentId}:${subjectId}:SAFE:${date}`,
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

    const today = new Date();
    const jsDay = today.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const todayDateStr = today.toISOString().split('T')[0];

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

    const validClassEntries = timetable.entries.filter((entry) => entry.subjectId !== null);

    const operations = validClassEntries.map((entry) =>
      prisma.attendance.upsert({
        where: {
          studentId_subjectId_date_timetableEntryId: {
            studentId,
            subjectId: entry.subjectId!,
            date: todayDateStr,
            timetableEntryId: entry.id,
          },
        },
        update: {
          status: 'PRESENT',
          updatedAt: new Date(),
        },
        create: {
          studentId,
          subjectId: entry.subjectId!,
          timetableEntryId: entry.id,
          date: todayDateStr,
          status: 'PRESENT',
        },
      })
    );

    await prisma.$transaction(operations);

    res.json({
      success: true,
      message: `Marked all ${timetable.entries.length} classes as present for today.`,
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
      include: { entries: true },
    });

    const projections = subjects.map((sub) => {
      const records = attendances.filter((r) => r.subjectId === sub.id);
      let attended = 0;
      let conducted = 0;
      for (const r of records) {
        if (r.status === 'PRESENT') { attended++; conducted++; }
        else if (r.status === 'ABSENT') { conducted++; }
      }

      // Count classes per week for this subject
      const weeklySlots = timetable?.entries.filter((e) => e.subjectId === sub.id).length || 3;
      const estimatedRemaining = weeklySlots * 8; // approx 8 remaining weeks in semester

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
      res.json({ success: true, synced: 0 });
      return;
    }

    // PERF-5: Batch all upserts in a single transaction instead of sequential calls
    const validItems = items.filter(
      (item: any) => item.subjectId && item.date && item.status
    );

    if (validItems.length === 0) {
      res.json({ success: true, synced: 0 });
      return;
    }

    await prisma.$transaction(
      validItems.map((item: any) =>
        prisma.attendance.upsert({
          where: {
            studentId_subjectId_date_timetableEntryId: {
              studentId,
              subjectId: item.subjectId,
              date: item.date,
              timetableEntryId: item.timetableEntryId || '',
            },
          },
          update: {
            status: item.status,
            remarks: item.remarks,
            syncId: item.syncId,
            updatedAt: new Date(),
          },
          create: {
            studentId,
            subjectId: item.subjectId,
            timetableEntryId: item.timetableEntryId || null,
            date: item.date,
            status: item.status,
            remarks: item.remarks,
            syncId: item.syncId,
          },
        })
      )
    );
    const syncedCount = validItems.length;

    res.json({ success: true, synced: syncedCount });
  } catch (error: any) {
    console.error('syncOfflineAttendance error:', error);
    res.status(500).json({ error: 'Failed to sync offline attendance records.' });
  }
}
