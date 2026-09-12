export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED' | 'HOLIDAY';
export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';
export type ClassType = 'LECTURE' | 'LAB' | 'TUTORIAL';
export type UserRole = 'STUDENT' | 'ADMIN';

export interface User {
  id: string;
  role: UserRole;
}

export interface StudentProfile {
  id: string;
  userId: string;
  usn: string;
  name: string;
  email?: string;
  semester: {
    id: string;
    number: number;
    name: string;
  };
  branch: {
    id: string;
    code: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  };
}

export interface SubjectStats {
  id: string;
  code: string;
  name: string;
  credits: number;
  minimumThreshold: number;
  conducted: number;
  attended: number;
  absent: number;
  cancelled: number;
  percentage: number;
  risk: RiskLevel;
  safeSkips: number;
  recoveryRequired: number;
  nextIfAttended: number;
  nextIfMissed: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface TodayClass {
  id: string;
  timetableEntryId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type: ClassType;
  faculty?: string;
  room?: string;
  subject: {
    id: string;
    code: string;
    name: string;
    minimumThreshold: number;
  };
  status?: AttendanceStatus;
  attendanceId?: string;
  risk: RiskLevel;
  safeSkips: number;
  recoveryRequired: number;
  isSafeToSkip: boolean;
}

export interface DashboardData {
  student: StudentProfile;
  threshold: number;
  overall: {
    conducted: number;
    attended: number;
    absent: number;
    percentage: number;
    risk: RiskLevel;
    safeSkips: number;
    recoveryRequired: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  };
  streaks: {
    current: number;
    longest: number;
    consistencyScore: number;
  };
  todayClasses: TodayClass[];
  subjectStats: SubjectStats[];
  unreadNotificationCount: number;
}

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  startTime?: string;
  endTime?: string;
  type?: ClassType;
}

export interface ProjectionAnalysis {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  currentPercentage: number;
  totalRemaining: number;
  attendAllRemaining: number;
  attend90Remaining: number;
  attend85Remaining?: number;
  attend75Remaining: number;
  missNext1: number;
  missNext2: number;
  attendNext1: number;
  attendNext3: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'CLASS_REMINDER' | 'ATTENDANCE_WARNING' | 'SKIP_WARNING' | 'RECOVERY' | 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'RISK_CHANGE' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  classReminders: boolean;
  reminderMinutesBefore: number;
  attendanceWarnings: boolean;
  skipWarnings: boolean;
  recoveryNotifications: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface WeeklyAnalytics {
  totalClasses: number;
  attended: number;
  absent: number;
  attendanceRate: number;
  bestSubject: { code: string; name: string; percentage: number } | null;
  worstSubject: { code: string; name: string; percentage: number } | null;
  dayWiseDistribution: { day: string; conducted: number; attended: number; percentage: number }[];
}
