-- =================================================================
-- SMART COLLEGE ATTENDANCE PLATFORM (V1 + V2)
-- Supabase / PostgreSQL Complete Relational Schema
-- =================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User & Roles
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "role" TEXT NOT NULL, -- 'STUDENT' | 'ADMIN'
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Admin Profiles
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Academic Year
CREATE TABLE IF NOT EXISTS "AcademicYear" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "name" TEXT NOT NULL UNIQUE, -- e.g. '2024-2025'
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true
);

-- 5. Semester
CREATE TABLE IF NOT EXISTS "Semester" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "number" INTEGER NOT NULL UNIQUE, -- 1..8
    "name" TEXT NOT NULL -- e.g. 'Semester 5'
);

-- 6. Branch
CREATE TABLE IF NOT EXISTS "Branch" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "code" TEXT NOT NULL UNIQUE, -- e.g. 'CSE'
    "name" TEXT NOT NULL -- e.g. 'Computer Science & Engineering'
);

-- 7. Section
CREATE TABLE IF NOT EXISTS "Section" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "name" TEXT NOT NULL, -- e.g. 'A', 'B'
    "semesterId" TEXT NOT NULL REFERENCES "Semester"("id") ON DELETE RESTRICT,
    "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
    CONSTRAINT "unique_section_sem_branch" UNIQUE ("name", "semesterId", "branchId")
);

-- 8. Subject
CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "code" TEXT NOT NULL, -- e.g. '21CS51'
    "name" TEXT NOT NULL, -- e.g. 'Database Management Systems'
    "credits" INTEGER NOT NULL DEFAULT 4,
    "semesterId" TEXT NOT NULL REFERENCES "Semester"("id") ON DELETE RESTRICT,
    "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
    "minimumThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    CONSTRAINT "unique_subject_code_sem_branch" UNIQUE ("code", "semesterId", "branchId")
);

-- 9. Timetable Header
CREATE TABLE IF NOT EXISTS "Timetable" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "academicYearId" TEXT NOT NULL REFERENCES "AcademicYear"("id") ON DELETE RESTRICT,
    "semesterId" TEXT NOT NULL REFERENCES "Semester"("id") ON DELETE RESTRICT,
    "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
    "sectionId" TEXT NOT NULL REFERENCES "Section"("id") ON DELETE RESTRICT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Timetable Entry
CREATE TABLE IF NOT EXISTS "TimetableEntry" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "timetableId" TEXT NOT NULL REFERENCES "Timetable"("id") ON DELETE CASCADE,
    "dayOfWeek" INTEGER NOT NULL, -- 1=Monday...7=Sunday
    "startTime" TEXT NOT NULL, -- '09:00'
    "endTime" TEXT NOT NULL,   -- '10:00'
    "subjectId" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE RESTRICT,
    "faculty" TEXT,
    "room" TEXT,
    "type" TEXT NOT NULL DEFAULT 'LECTURE' -- 'LECTURE' | 'LAB' | 'TUTORIAL'
);

CREATE INDEX IF NOT EXISTS "idx_timetable_entry_day_time" ON "TimetableEntry"("dayOfWeek", "startTime");

-- 11. Student
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "usn" TEXT NOT NULL UNIQUE, -- e.g. '1MS21CS001'
    "name" TEXT NOT NULL,
    "email" TEXT,
    "semesterId" TEXT NOT NULL REFERENCES "Semester"("id") ON DELETE RESTRICT,
    "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
    "sectionId" TEXT NOT NULL REFERENCES "Section"("id") ON DELETE RESTRICT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEX IF NOT EXISTS "idx_student_usn" ON "Student"("usn"); -- Redundant with UNIQUE constraint
CREATE INDEX IF NOT EXISTS "idx_student_sem_branch_sec" ON "Student"("semesterId", "branchId", "sectionId");

-- 12. Attendance
CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
    "subjectId" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE RESTRICT,
    "timetableEntryId" TEXT REFERENCES "TimetableEntry"("id") ON DELETE SET NULL,
    "date" TEXT NOT NULL, -- 'YYYY-MM-DD'
    "status" TEXT NOT NULL, -- 'PRESENT' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED' | 'HOLIDAY'
    "remarks" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_attendance_student_subject_date_slot" UNIQUE ("studentId", "subjectId", "date", "timetableEntryId")
);

CREATE INDEX IF NOT EXISTS "idx_attendance_student_date" ON "Attendance"("studentId", "date");
CREATE INDEX IF NOT EXISTS "idx_attendance_student_subject" ON "Attendance"("studentId", "subjectId");
CREATE INDEX IF NOT EXISTS "idx_attendance_student_status" ON "Attendance"("studentId", "status");
CREATE INDEX IF NOT EXISTS "idx_attendance_status" ON "Attendance"("status");

-- 13. Notification Preference
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "studentId" TEXT NOT NULL UNIQUE REFERENCES "Student"("id") ON DELETE CASCADE,
    "classReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 30,
    "attendanceWarnings" BOOLEAN NOT NULL DEFAULT true,
    "skipWarnings" BOOLEAN NOT NULL DEFAULT true,
    "recoveryNotifications" BOOLEAN NOT NULL DEFAULT true,
    "dailySummary" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT NOT NULL DEFAULT '23:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00'
);

-- 14. Push Subscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_student_push_endpoint" UNIQUE ("studentId", "endpoint")
);

-- 15. Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_notification_student_read" ON "Notification"("studentId", "isRead");
CREATE INDEX IF NOT EXISTS "idx_notification_student_dedup" ON "Notification"("studentId", "deduplicationKey");
CREATE INDEX IF NOT EXISTS "idx_notification_student_time" ON "Notification"("studentId", "createdAt");

-- 16. Audit Log
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetEntity" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_audit_actor" ON "AuditLog"("actorEmail");
CREATE INDEX IF NOT EXISTS "idx_audit_time" ON "AuditLog"("createdAt");

-- 17. System Setting
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "description" TEXT
);

-- 18. Default Seed Setting
INSERT INTO "SystemSetting" ("key", "value", "description")
VALUES ('MINIMUM_ATTENDANCE_THRESHOLD', '75.0', 'Minimum attendance percentage required across all courses')
ON CONFLICT ("key") DO NOTHING;
