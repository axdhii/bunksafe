/**
 * End-to-end API tests against a real Postgres database.
 * Runs only when TEST_DATABASE_URL is set (the schema is pushed before the run):
 *   DATABASE_URL=$TEST_DATABASE_URL TEST_DATABASE_URL=postgresql://... npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import bcrypt from 'bcryptjs';

const DB_URL = process.env.TEST_DATABASE_URL;
const d = DB_URL ? describe : describe.skip;

let server: Server;
let base = '';
let prisma: any;
let getCollegeDate: any;
let ids: Record<string, string> = {};

async function api(method: string, path: string, body?: any, token?: string) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data };
}

async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Attendance","Notification","PushSubscription","NotificationPreference","TimetableEntry","Timetable",
      "Student","Subject","Section","Branch","Semester","AcademicYear","Admin","User","AuditLog","SystemSetting" CASCADE`);

  const ay = await prisma.academicYear.create({
    data: { name: 'AY', startDate: new Date('2026-08-01'), endDate: new Date('2027-06-30'), isCurrent: true },
  });
  const sem = await prisma.semester.create({ data: { number: 5, name: 'Semester 5' } });
  const br = await prisma.branch.create({ data: { code: 'CSE', name: 'CSE' } });
  const br2 = await prisma.branch.create({ data: { code: 'ECE', name: 'ECE' } });
  const sec = await prisma.section.create({ data: { name: 'A', semesterId: sem.id, branchId: br.id } });
  const sub = await prisma.subject.create({ data: { code: 'CS51', name: 'DBMS', semesterId: sem.id, branchId: br.id } });
  const lab1 = await prisma.subject.create({ data: { code: 'CSL1', name: 'Lab One', semesterId: sem.id, branchId: br.id } });
  const lab2 = await prisma.subject.create({ data: { code: 'CSL2', name: 'Lab Two', semesterId: sem.id, branchId: br.id } });
  const other = await prisma.subject.create({ data: { code: 'EC51', name: 'Signals', semesterId: sem.id, branchId: br2.id } });

  const adminUser = await prisma.user.create({ data: { role: 'ADMIN' } });
  await prisma.admin.create({
    data: { userId: adminUser.id, email: 'admin@test.edu', name: 'Admin', passwordHash: await bcrypt.hash('AdminPass1', 4) },
  });

  ids = { ay: ay.id, sem: sem.id, br: br.id, br2: br2.id, sec: sec.id, sub: sub.id, lab1: lab1.id, lab2: lab2.id, other: other.id };
}

async function createRosterStudent(usn: string, name: string, batch: string | null = 'A1') {
  const u = await prisma.user.create({ data: { role: 'STUDENT' } });
  return prisma.student.create({
    data: { userId: u.id, usn, name, batch, semesterId: ids.sem, branchId: ids.br, sectionId: ids.sec },
  });
}

async function claim(usn: string, name: string, password = 'Password123') {
  return api('POST', '/auth/student/register', { usn, name, password });
}

async function adminToken() {
  const r = await api('POST', '/auth/admin/login', { email: 'admin@test.edu', password: 'AdminPass1' });
  return r.data.token as string;
}

/** Today's timetable: one lecture, plus parallel batch labs (A1 -> CSL1, A2 -> CSL2). */
async function timetableToday() {
  const { dayOfWeek } = getCollegeDate();
  const admin = await adminToken();
  const r = await api('POST', '/timetable/save-manual', {
    sectionId: ids.sec, semesterId: ids.sem, branchId: ids.br,
    entries: [
      { dayOfWeek, startTime: '09:00', endTime: '10:00', subjectCode: 'CS51', type: 'LECTURE', batch: 'ALL' },
      { dayOfWeek, startTime: '11:00', endTime: '13:00', subjectCode: 'CSL1', type: 'LAB', batch: 'A1' },
      { dayOfWeek, startTime: '11:00', endTime: '13:00', subjectCode: 'CSL2', type: 'LAB', batch: 'A2' },
    ],
  }, admin);
  expect(r.status).toBe(200);
  const entries = await prisma.timetableEntry.findMany({ where: { dayOfWeek }, orderBy: [{ startTime: 'asc' }, { batch: 'asc' }] });
  return { admin, entries, dayOfWeek };
}

d('API integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL;
    process.env.VERCEL = '1'; // stop index.ts from calling listen()
    const { default: app } = await import('../index.js');
    ({ prisma } = await import('../prisma/client.js'));
    ({ getCollegeDate } = await import('../controllers/attendanceController.js'));
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server?.close();
    await prisma?.$disconnect();
  });

  beforeEach(resetDb);

  // ---------------- Auth & roster claiming ----------------
  it('rejects a claim that matches only one word of the roster name', async () => {
    await createRosterStudent('1MS21CS001', 'Rahul Kumar Sharma');
    const r = await claim('1MS21CS001', 'Kumar');
    expect(r.status).toBe(400);
    const ok = await claim('1MS21CS001', '  rahul  KUMAR sharma ');
    expect(ok.status).toBe(200);
  });

  it('lets exactly one of two concurrent claims win', async () => {
    await createRosterStudent('1MS21CS002', 'Ananya Rao');
    const [a, b] = await Promise.all([
      claim('1MS21CS002', 'Ananya Rao', 'FirstPass1'),
      claim('1MS21CS002', 'Ananya Rao', 'SecondPass1'),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('activate endpoint also requires the full name', async () => {
    await createRosterStudent('1MS21CS003', 'Rohan Verma');
    expect((await api('POST', '/auth/student/activate', { usn: '1MS21CS003', name: 'Verma', password: 'Password123' })).status).toBe(400);
    expect((await api('POST', '/auth/student/activate', { usn: '1MS21CS003', name: 'Rohan Verma', password: 'Password123' })).status).toBe(200);
  });

  it('admin can reset a student password so the real student can claim again', async () => {
    const st = await createRosterStudent('1MS21CS004', 'Priya Nair');
    expect((await claim('1MS21CS004', 'Priya Nair', 'Hijacked123')).status).toBe(200);
    const admin = await adminToken();
    const reset = await api('POST', `/academic/students/${st.id}/reset-password`, {}, admin);
    expect(reset.status).toBe(200);
    // Old password no longer works
    expect((await api('POST', '/auth/student/login', { usn: '1MS21CS004', password: 'Hijacked123' })).status).toBe(403);
    expect((await claim('1MS21CS004', 'Priya Nair', 'RealOwner123')).status).toBe(200);
    expect((await api('POST', '/auth/student/login', { usn: '1MS21CS004', password: 'RealOwner123' })).status).toBe(200);
  });

  it('a student can change their own password, and old tokens stop working', async () => {
    await createRosterStudent('1MS21CS005', 'Karan Shah');
    const { data } = await claim('1MS21CS005', 'Karan Shah', 'OldPass123');
    expect((await api('POST', '/auth/change-password', { currentPassword: 'wrong-one', newPassword: 'NewPass123' }, data.token)).status).toBe(400);
    const ch = await api('POST', '/auth/change-password', { currentPassword: 'OldPass123', newPassword: 'NewPass123' }, data.token);
    expect(ch.status).toBe(200);
    expect((await api('GET', '/auth/me', undefined, data.token)).status).toBe(401);
    expect((await api('GET', '/auth/me', undefined, ch.data.token)).status).toBe(200);
    expect((await api('POST', '/auth/student/login', { usn: '1MS21CS005', password: 'NewPass123' })).status).toBe(200);
  });

  it('logout revokes the token', async () => {
    await createRosterStudent('1MS21CS006', 'Meera Iyer');
    const { data } = await claim('1MS21CS006', 'Meera Iyer');
    expect((await api('POST', '/auth/logout', {}, data.token)).status).toBe(200);
    expect((await api('GET', '/auth/me', undefined, data.token)).status).toBe(401);
  });

  it('self-registration never creates sections or falls back to a random cohort', async () => {
    const before = await prisma.section.count();
    const r = await api('POST', '/auth/student/register', {
      usn: '1MS21CS900', name: 'New Person', password: 'Password123',
      semesterId: ids.sem, branchId: ids.br, sectionName: 'ZZZ',
    });
    expect(r.status).toBe(400);
    expect(await prisma.section.count()).toBe(before);
    const bad = await api('POST', '/auth/student/register', {
      usn: '1MS21CS901', name: 'New Person', password: 'Password123', semesterId: 'nope', branchId: 'nope', sectionId: 'nope',
    });
    expect(bad.status).toBe(400);
    const good = await api('POST', '/auth/student/register', {
      usn: '1MS21CS902', name: 'New Person', password: 'Password123', semesterId: ids.sem, branchId: ids.br, sectionId: ids.sec,
    });
    expect(good.status).toBe(201);
  });

  it('deactivated students are blocked on /auth/me too', async () => {
    const st = await createRosterStudent('1MS21CS007', 'Dev Patel');
    const { data } = await claim('1MS21CS007', 'Dev Patel');
    await prisma.student.update({ where: { id: st.id }, data: { active: false } });
    expect((await api('GET', '/auth/me', undefined, data.token)).status).toBe(403);
  });

  // ---------------- Admin data exposure & safety ----------------
  it('never returns password hashes from admin student endpoints or audit logs', async () => {
    await createRosterStudent('1MS21CS010', 'Asha Menon');
    await claim('1MS21CS010', 'Asha Menon');
    const admin = await adminToken();
    const list = await api('GET', '/academic/students', undefined, admin);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.data)).not.toContain('passwordHash');
    const st = list.data.students[0];
    const upd = await api('PUT', `/academic/students/${st.id}`, { name: 'Asha M' }, admin);
    expect(JSON.stringify(upd.data)).not.toContain('passwordHash');
    const logs = await prisma.auditLog.findMany();
    expect(JSON.stringify(logs)).not.toContain('passwordHash');
  });

  it('student search is case-insensitive', async () => {
    await createRosterStudent('1MS21CS011', 'Asha Menon');
    const admin = await adminToken();
    const r = await api('GET', '/academic/students?search=1ms21cs011', undefined, admin);
    expect(r.data.students).toHaveLength(1);
  });

  it('refuses to clear timetables without a full section scope', async () => {
    const { admin } = await timetableToday();
    expect((await api('DELETE', '/timetable/section', undefined, admin)).status).toBe(400);
    expect(await prisma.timetable.count()).toBe(1);
    const ok = await api('DELETE', `/timetable/section?sectionId=${ids.sec}&semesterId=${ids.sem}&branchId=${ids.br}`, undefined, admin);
    expect(ok.status).toBe(200);
    expect(await prisma.timetable.count()).toBe(0);
  });

  it('validates subject thresholds', async () => {
    const admin = await adminToken();
    for (const bad of [100, 0, -5, 'abc', 150]) {
      expect((await api('PUT', `/academic/subjects/${ids.sub}`, { minimumThreshold: bad }, admin)).status).toBe(400);
    }
    expect((await api('PUT', `/academic/subjects/${ids.sub}`, { minimumThreshold: 75 }, admin)).status).toBe(200);
    expect((await api('PUT', '/academic/settings', { key: 'MINIMUM_ATTENDANCE_THRESHOLD', value: 'abc' }, admin)).status).toBe(400);
  });

  it('a database error on a public route returns 500 instead of hanging', async () => {
    const orig = prisma.semester.findMany;
    prisma.semester.findMany = () => Promise.reject(new Error('db down'));
    try {
      const r = await Promise.race([
        api('GET', '/academic/semesters'),
        new Promise<any>((resolve) => setTimeout(() => resolve({ status: 'hang' }), 3000)),
      ]);
      expect(r.status).toBe(500);
    } finally {
      prisma.semester.findMany = orig;
    }
  });

  it('timetable upload errors come back as 400 with a readable message', async () => {
    const admin = await adminToken();
    const fd = new FormData();
    fd.append('file', new Blob(['hello']), 'notes.exe');
    const res = await fetch(`${base}/api/timetable/preview`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${admin}` } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toContain('Invalid file format');
  });

  // ---------------- Attendance ----------------
  it('marking without a slot id twice keeps a single record', async () => {
    await createRosterStudent('1MS21CS020', 'Sneha Kulkarni');
    const { data } = await claim('1MS21CS020', 'Sneha Kulkarni');
    const { dateStr } = getCollegeDate();
    for (const status of ['PRESENT', 'ABSENT', 'PRESENT']) {
      const r = await api('POST', '/attendance/mark', { subjectId: ids.sub, date: dateStr, status }, data.token);
      expect(r.status).toBe(200);
    }
    const rows = await prisma.attendance.findMany({ where: { subjectId: ids.sub } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('PRESENT');
  });

  it('re-saving the same timetable keeps attendance linked to its slots and does not double count', async () => {
    const st = await createRosterStudent('1MS21CS021', 'Arjun Reddy');
    const { data } = await claim('1MS21CS021', 'Arjun Reddy');
    const { entries, dayOfWeek } = await timetableToday();
    const { dateStr } = getCollegeDate();
    const lecture = entries.find((e: any) => e.subjectId === ids.sub)!;
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: lecture.id, date: dateStr, status: 'PRESENT' }, data.token);

    // Admin re-saves the same timetable (e.g. fixing a room number)
    const admin = await adminToken();
    await api('POST', '/timetable/save-manual', {
      sectionId: ids.sec, semesterId: ids.sem, branchId: ids.br,
      entries: [
        { dayOfWeek, startTime: '09:00', endTime: '10:00', subjectCode: 'CS51', type: 'LECTURE', batch: 'ALL', room: 'NEW-101' },
        { dayOfWeek, startTime: '11:00', endTime: '13:00', subjectCode: 'CSL1', type: 'LAB', batch: 'A1' },
        { dayOfWeek, startTime: '11:00', endTime: '13:00', subjectCode: 'CSL2', type: 'LAB', batch: 'A2' },
      ],
    }, admin);

    const rec = await prisma.attendance.findFirst({ where: { studentId: st.id } });
    expect(rec.timetableEntryId).toBe(lecture.id);

    // Dashboard still shows it marked, and marking again does not add a second row
    const dash = await api('GET', '/attendance/dashboard', undefined, data.token);
    const slot = dash.data.todayClasses.find((c: any) => c.subject?.id === ids.sub);
    expect(slot.status).toBe('PRESENT');
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: slot.id, date: dateStr, status: 'PRESENT' }, data.token);
    await api('POST', '/attendance/mark-all-today', {}, data.token);
    expect(await prisma.attendance.count({ where: { studentId: st.id, subjectId: ids.sub } })).toBe(1);
  });

  it('a slot whose time changed adopts the old orphaned record instead of duplicating', async () => {
    const st = await createRosterStudent('1MS21CS022', 'Kavya Joshi');
    const { data } = await claim('1MS21CS022', 'Kavya Joshi');
    const { entries, dayOfWeek, admin } = await timetableToday();
    const { dateStr } = getCollegeDate();
    const lecture = entries.find((e: any) => e.subjectId === ids.sub)!;
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: lecture.id, date: dateStr, status: 'ABSENT' }, data.token);
    await api('POST', '/timetable/save-manual', {
      sectionId: ids.sec, semesterId: ids.sem, branchId: ids.br,
      entries: [{ dayOfWeek, startTime: '09:15', endTime: '10:15', subjectCode: 'CS51', type: 'LECTURE', batch: 'ALL' }],
    }, admin);
    const newEntry = await prisma.timetableEntry.findFirst({ where: { subjectId: ids.sub } });
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: newEntry.id, date: dateStr, status: 'PRESENT' }, data.token);
    const rows = await prisma.attendance.findMany({ where: { studentId: st.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].timetableEntryId).toBe(newEntry.id);
    expect(rows[0].status).toBe('PRESENT');
  });

  it('mark-all-today credits only the student batch and never overwrites a chosen status', async () => {
    const s1 = await createRosterStudent('1MS21CS030', 'Batch One', 'A1');
    const s2 = await createRosterStudent('1MS21CS031', 'Batch Two', 'B2'); // B2 should match A2 labs by batch number
    const t1 = (await claim('1MS21CS030', 'Batch One')).data.token;
    const t2 = (await claim('1MS21CS031', 'Batch Two')).data.token;
    const { entries } = await timetableToday();
    const { dateStr } = getCollegeDate();
    const lecture = entries.find((e: any) => e.subjectId === ids.sub)!;
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: lecture.id, date: dateStr, status: 'ABSENT' }, t1);

    expect((await api('POST', '/attendance/mark-all-today', {}, t1)).status).toBe(200);
    expect((await api('POST', '/attendance/mark-all-today', {}, t2)).status).toBe(200);

    const r1 = await prisma.attendance.findMany({ where: { studentId: s1.id } });
    expect(r1.map((r: any) => r.subjectId).sort()).toEqual([ids.sub, ids.lab1].sort());
    expect(r1.find((r: any) => r.subjectId === ids.sub).status).toBe('ABSENT');
    const r2 = await prisma.attendance.findMany({ where: { studentId: s2.id } });
    expect(r2.map((r: any) => r.subjectId).sort()).toEqual([ids.sub, ids.lab2].sort());
  });

  it('students can set their own lab batch', async () => {
    const st = await createRosterStudent('1MS21CS032', 'Nikhil Rao', 'B1');
    const t = (await claim('1MS21CS032', 'Nikhil Rao')).data.token;
    expect((await api('PUT', '/attendance/batch', { batch: 'NOPE' }, t)).status).toBe(400);
    expect((await api('PUT', '/attendance/batch', { batch: 'A2' }, t)).status).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: st.id } })).batch).toBe('A2');
    const dash = await api('GET', '/attendance/dashboard', undefined, t);
    expect(dash.data.student.batch).toBe('A2');
  });

  it('rejects bad and future dates, and slots from another subject', async () => {
    await createRosterStudent('1MS21CS040', 'Tara Singh');
    const t = (await claim('1MS21CS040', 'Tara Singh')).data.token;
    const { entries } = await timetableToday();
    const { dateStr } = getCollegeDate();
    for (const date of ['yesterday', '2026-13-45', '2099-01-01']) {
      expect((await api('POST', '/attendance/mark', { subjectId: ids.sub, date, status: 'PRESENT' }, t)).status).toBe(400);
    }
    const labEntry = entries.find((e: any) => e.subjectId === ids.lab1)!;
    expect((await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: labEntry.id, date: dateStr, status: 'PRESENT' }, t)).status).toBe(400);
  });

  it('offline sync rejects other-cohort subjects and does not let stale items overwrite newer marks', async () => {
    const st = await createRosterStudent('1MS21CS041', 'Ira Das');
    const t = (await claim('1MS21CS041', 'Ira Das')).data.token;
    const { entries } = await timetableToday();
    const { dateStr } = getCollegeDate();
    const lecture = entries.find((e: any) => e.subjectId === ids.sub)!;
    await api('POST', '/attendance/mark', { subjectId: ids.sub, timetableEntryId: lecture.id, date: dateStr, status: 'PRESENT' }, t);

    const r = await api('POST', '/attendance/sync', {
      items: [
        { syncId: 's1', subjectId: ids.other, date: dateStr, status: 'PRESENT', timestamp: Date.now() },
        { syncId: 's2', subjectId: ids.sub, timetableEntryId: lecture.id, date: dateStr, status: 'ABSENT', timestamp: Date.now() - 3600_000 },
      ],
    }, t);
    expect(r.status).toBe(200);
    expect(r.data.rejected).toContain('s1');
    expect(r.data.processed).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(await prisma.attendance.count({ where: { studentId: st.id, subjectId: ids.other } })).toBe(0);
    expect((await prisma.attendance.findFirst({ where: { studentId: st.id, subjectId: ids.sub } })).status).toBe('PRESENT');
  });

  it('per-subject threshold of null-ish/global and at-risk detection works per subject', async () => {
    const st = await createRosterStudent('1MS21CS050', 'Risky Student');
    const t = (await claim('1MS21CS050', 'Risky Student')).data.token;
    // 10/10 in lecture, 0/2 in lab one: overall 83% but lab one is clearly failing
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push({ studentId: st.id, subjectId: ids.sub, date: `2026-09-${String(i).padStart(2, '0')}`, status: 'PRESENT' });
    rows.push({ studentId: st.id, subjectId: ids.lab1, date: '2026-09-01', status: 'ABSENT' });
    rows.push({ studentId: st.id, subjectId: ids.lab1, date: '2026-09-02', status: 'ABSENT' });
    await prisma.attendance.createMany({ data: rows });
    const admin = await adminToken();
    await api('PUT', '/academic/settings', { key: 'MINIMUM_ATTENDANCE_THRESHOLD', value: '75' }, admin);
    const ov = await api('GET', '/analytics/admin/overview', undefined, admin);
    expect(ov.data.distribution.critical).toBe(1);
    expect(ov.data.atRiskStudents[0].usn).toBe('1MS21CS050');
    expect((await api('GET', '/attendance/dashboard', undefined, t)).status).toBe(200);
  });

  it('projections do not invent classes for subjects with no slots', async () => {
    await createRosterStudent('1MS21CS051', 'Proj Student');
    const t = (await claim('1MS21CS051', 'Proj Student')).data.token;
    const r = await api('GET', '/attendance/projections', undefined, t);
    expect(r.status).toBe(200);
    for (const p of r.data.projections) expect(p.totalRemaining).toBe(0);
  });

  // ---------------- Notifications ----------------
  it('broadcast creates exactly one inbox notification per student', async () => {
    await createRosterStudent('1MS21CS060', 'Inbox One');
    await createRosterStudent('1MS21CS061', 'Inbox Two');
    const admin = await adminToken();
    const r = await api('POST', '/notifications/broadcast', { title: 'Hi', message: 'Hello' }, admin);
    expect(r.status).toBe(200);
    expect(r.data.count).toBe(2);
    expect(await prisma.notification.count()).toBe(2);
  });

  it('rejects push endpoints that are not known push services', async () => {
    await createRosterStudent('1MS21CS062', 'Push User');
    const t = (await claim('1MS21CS062', 'Push User')).data.token;
    const keys = { p256dh: 'x', auth: 'y' };
    for (const endpoint of ['http://169.254.169.254/latest', 'https://127.0.0.1/x', 'https://evil.example.com/push', 'not a url']) {
      expect((await api('POST', '/notifications/subscribe', { endpoint, keys }, t)).status).toBe(400);
    }
    expect((await api('POST', '/notifications/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }, t)).status).toBe(200);
  });

  it('validates notification preference values', async () => {
    await createRosterStudent('1MS21CS063', 'Pref User');
    const t = (await claim('1MS21CS063', 'Pref User')).data.token;
    expect((await api('PUT', '/notifications/preferences', { quietHoursStart: 'abc' }, t)).status).toBe(400);
    expect((await api('PUT', '/notifications/preferences', { reminderMinutesBefore: 'soon' }, t)).status).toBe(400);
    expect((await api('PUT', '/notifications/preferences', { quietHoursStart: '22:30', reminderMinutesBefore: 15 }, t)).status).toBe(200);
  });

  // ---------------- AI timetable confirm ----------------
  it('AI confirm normalises times, resolves abbreviations and reports unresolved codes', async () => {
    const admin = await adminToken();
    const r = await api('POST', '/timetable/ai-confirm', {
      sectionId: ids.sec, semesterId: ids.sem, branchId: ids.br,
      subjects: [{ code: 'CS51', name: 'DBMS', abbreviation: 'DB' }],
      schedule: [
        { dayOfWeek: 1, startTime: '9:00', endTime: '9:55', subjectCode: 'DB', type: 'LECTURE' },
        { dayOfWeek: 1, startTime: '2:00 PM', endTime: '2:55 PM', subjectCode: 'XYZ', type: 'LECTURE' },
        { dayOfWeek: 1, startTime: 'garbage', endTime: '10:00', subjectCode: 'CS51', type: 'LECTURE' },
      ],
    }, admin);
    expect(r.status).toBe(200);
    expect(r.data.unresolvedCodes).toEqual(['XYZ']);
    expect(r.data.skipped).toBe(1);
    const entries = await prisma.timetableEntry.findMany({ orderBy: { startTime: 'asc' } });
    expect(entries.map((e: any) => e.startTime)).toEqual(['09:00', '14:00']);
    expect(entries[0].subjectId).toBe(ids.sub);
  });
});
