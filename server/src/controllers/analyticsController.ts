import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { calculateAttendance } from '../utils/attendanceEngine.js';
import { parseThreshold } from './academicController.js';

export async function getStudentWeeklyAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;

    // Find all attendance records for this student
    const records = await prisma.attendance.findMany({
      where: { studentId },
      include: { subject: true },
      orderBy: { date: 'asc' },
    });

    let totalClasses = 0;
    let attended = 0;
    let absent = 0;

    // Subject breakdown
    const subjectMap = new Map<string, { code: string; name: string; attended: number; conducted: number }>();

    // Day of week breakdown (Monday to Sunday)
    const dayMap: Record<number, { conducted: number; attended: number }> = {
      1: { conducted: 0, attended: 0 },
      2: { conducted: 0, attended: 0 },
      3: { conducted: 0, attended: 0 },
      4: { conducted: 0, attended: 0 },
      5: { conducted: 0, attended: 0 },
      6: { conducted: 0, attended: 0 },
      7: { conducted: 0, attended: 0 },
    };

    for (const r of records) {
      if (r.status === 'PRESENT' || r.status === 'ABSENT') {
        totalClasses++;
        const isPres = r.status === 'PRESENT';
        if (isPres) attended++;
        else absent++;

        // Subject
        if (!subjectMap.has(r.subjectId)) {
          subjectMap.set(r.subjectId, {
            code: r.subject.code,
            name: r.subject.name,
            attended: 0,
            conducted: 0,
          });
        }
        const s = subjectMap.get(r.subjectId)!;
        s.conducted++;
        if (isPres) s.attended++;

        // Day of week from record date
        const d = new Date(`${r.date}T00:00:00Z`); // calendar date, independent of server timezone
        const dayIdx = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
        if (dayMap[dayIdx]) {
          dayMap[dayIdx].conducted++;
          if (isPres) dayMap[dayIdx].attended++;
        }
      }
    }

    let bestSubject: { code: string; name: string; percentage: number } | null = null;
    let worstSubject: { code: string; name: string; percentage: number } | null = null;

    let maxRate = -1;
    let minRate = 101;

    for (const item of subjectMap.values()) {
      if (item.conducted > 0) {
        const rate = Math.round((item.attended / item.conducted) * 1000) / 10;
        if (rate > maxRate) {
          maxRate = rate;
          bestSubject = { code: item.code, name: item.name, percentage: rate };
        }
        if (rate < minRate) {
          minRate = rate;
          worstSubject = { code: item.code, name: item.name, percentage: rate };
        }
      }
    }

    const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayWiseDistribution = [1, 2, 3, 4, 5, 6, ...(dayMap[7].conducted > 0 ? [7] : [])].map((dayNum) => {
      const stats = dayMap[dayNum];
      const percentage = stats.conducted > 0 ? Math.round((stats.attended / stats.conducted) * 100) : 0;
      return {
        day: DAY_NAMES[dayNum],
        conducted: stats.conducted,
        attended: stats.attended,
        percentage,
      };
    });

    res.json({
      totalClasses,
      attended,
      absent,
      attendanceRate: totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 100.0,
      bestSubject,
      worstSubject,
      dayWiseDistribution,
    });
  } catch (error: any) {
    console.error('getStudentWeeklyAnalytics error:', error);
    res.status(500).json({ error: 'Failed to compute analytics.' });
  }
}

export async function getAdminAttendanceOverview(req: Request, res: Response): Promise<void> {
  try {
    const [thresholdSetting, activeStudents, subjects, counts] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'MINIMUM_ATTENDANCE_THRESHOLD' } }),
      prisma.student.findMany({ where: { active: true }, select: { id: true } }),
      prisma.subject.findMany({ select: { id: true, minimumThreshold: true } }),
      // Per student, per subject, per status counts aggregated in the DB
      prisma.attendance.groupBy({
        by: ['studentId', 'subjectId', 'status'],
        _count: { id: true },
        where: { status: { in: ['PRESENT', 'ABSENT'] }, student: { active: true } },
      }),
    ]);

    const defaultThreshold = parseThreshold(thresholdSetting?.value) ?? 85.0;
    const thresholdBySubject = new Map(subjects.map((s) => [s.id, s.minimumThreshold]));

    // studentId -> subjectId -> { attended, conducted }
    const perStudent = new Map<string, Map<string, { attended: number; conducted: number }>>();
    for (const c of counts) {
      const bySubject = perStudent.get(c.studentId) || new Map();
      perStudent.set(c.studentId, bySubject);
      const cell = bySubject.get(c.subjectId) || { attended: 0, conducted: 0 };
      cell.conducted += c._count.id;
      if (c.status === 'PRESENT') cell.attended += c._count.id;
      bySubject.set(c.subjectId, cell);
    }

    const rank = { SAFE: 0, WARNING: 1, CRITICAL: 2 } as const;
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    const critical: { id: string; percentage: number; recoveryRequired: number }[] = [];

    for (const { id } of activeStudents) {
      // A student's risk is their worst subject, each judged against that subject's own threshold
      let worst: ReturnType<typeof calculateAttendance> | null = null;
      for (const [subjectId, cell] of perStudent.get(id) || []) {
        const m = calculateAttendance(cell.attended, cell.conducted, thresholdBySubject.get(subjectId) ?? defaultThreshold);
        if (!worst || rank[m.risk] > rank[worst.risk] || (m.risk === worst.risk && m.percentage < worst.percentage)) worst = m;
      }
      const risk = worst?.risk ?? 'SAFE';
      if (risk === 'CRITICAL') {
        criticalCount++;
        critical.push({ id, percentage: worst!.percentage, recoveryRequired: worst!.recoveryRequired });
      } else if (risk === 'WARNING') warningCount++;
      else safeCount++;
    }

    critical.sort((a, b) => a.percentage - b.percentage);
    const top = critical.slice(0, 20);
    const details = await prisma.student.findMany({
      where: { id: { in: top.map((c) => c.id) } },
      include: { semester: true, branch: true, section: true },
    });
    const byId = new Map(details.map((st) => [st.id, st]));
    const atRiskStudents = top.map((c) => {
      const st = byId.get(c.id)!;
      return {
        id: st.id,
        usn: st.usn,
        name: st.name,
        semester: st.semester.number,
        branch: st.branch.code,
        section: st.section.name,
        percentage: c.percentage, // lowest subject percentage
        recoveryRequired: c.recoveryRequired,
      };
    });

    res.json({
      totalStudents: activeStudents.length,
      threshold: defaultThreshold,
      distribution: {
        safe: safeCount,
        warning: warningCount,
        critical: criticalCount,
      },
      atRiskStudents,
    });
  } catch (error: any) {
    console.error('getAdminAttendanceOverview error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin attendance overview.' });
  }
}
