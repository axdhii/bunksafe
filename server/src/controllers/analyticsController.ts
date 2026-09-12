import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { calculateAttendance } from '../utils/attendanceEngine.js';

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
        const d = new Date(r.date);
        const dayIdx = d.getDay() === 0 ? 7 : d.getDay();
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
    const dayWiseDistribution = [1, 2, 3, 4, 5, 6].map((dayNum) => {
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
    const students = await prisma.student.findMany({
      include: {
        semester: true,
        branch: true,
        section: true,
        attendances: true,
      },
    });

    const thresholdSetting = await prisma.systemSetting.findUnique({
      where: { key: 'MINIMUM_ATTENDANCE_THRESHOLD' },
    });
    const defaultThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 85.0;

    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    const atRiskStudents: any[] = [];

    students.forEach((st) => {
      let attended = 0;
      let conducted = 0;
      for (const a of st.attendances) {
        if (a.status === 'PRESENT') { attended++; conducted++; }
        else if (a.status === 'ABSENT') { conducted++; }
      }
      const metrics = calculateAttendance(attended, conducted, defaultThreshold);
      if (metrics.risk === 'CRITICAL') {
        criticalCount++;
        atRiskStudents.push({
          id: st.id,
          usn: st.usn,
          name: st.name,
          semester: st.semester.number,
          branch: st.branch.code,
          section: st.section.name,
          percentage: metrics.percentage,
          recoveryRequired: metrics.recoveryRequired,
        });
      } else if (metrics.risk === 'WARNING') {
        warningCount++;
      } else {
        safeCount++;
      }
    });

    res.json({
      totalStudents: students.length,
      threshold: defaultThreshold,
      distribution: {
        safe: safeCount,
        warning: warningCount,
        critical: criticalCount,
      },
      atRiskStudents: atRiskStudents.slice(0, 20),
    });
  } catch (error: any) {
    console.error('getAdminAttendanceOverview error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin attendance overview.' });
  }
}
