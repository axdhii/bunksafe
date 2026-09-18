import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Smart College Attendance Platform...');

  // 1. Clean existing database
  await prisma.notification.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.student.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.section.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 2. System Settings
  await prisma.systemSetting.create({
    data: {
      key: 'MINIMUM_ATTENDANCE_THRESHOLD',
      value: '85.0',
      description: 'Minimum required attendance percentage across all courses',
    },
  });

  // 3. Admin User
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@college.edu').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: { role: 'ADMIN' },
  });

  const admin = await prisma.admin.create({
    data: {
      userId: adminUser.id,
      email: adminEmail,
      name: process.env.ADMIN_NAME || 'Chief Academic Administrator',
      passwordHash: adminPasswordHash,
    },
  });

  console.log(`✅ Admin created: ${admin.email} / ${adminPassword}`);

  // 4. Academic Year
  const academicYear = await prisma.academicYear.create({
    data: {
      name: '2024-2025',
      startDate: new Date('2024-08-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: true,
    },
  });

  // 5. Semesters
  const sem3 = await prisma.semester.create({ data: { number: 3, name: 'Semester 3' } });
  const sem5 = await prisma.semester.create({ data: { number: 5, name: 'Semester 5' } });
  const sem7 = await prisma.semester.create({ data: { number: 7, name: 'Semester 7' } });

  // 6. Branches
  const cse = await prisma.branch.create({ data: { code: 'CSE', name: 'Computer Science & Engineering' } });
  const ise = await prisma.branch.create({ data: { code: 'ISE', name: 'Information Science & Engineering' } });
  const ece = await prisma.branch.create({ data: { code: 'ECE', name: 'Electronics & Communication' } });

  // 7. Sections for Sem 5 CSE
  const secA = await prisma.section.create({
    data: { name: 'A', semesterId: sem5.id, branchId: cse.id },
  });
  const secB = await prisma.section.create({
    data: { name: 'B', semesterId: sem5.id, branchId: cse.id },
  });

  // 8. Subjects for Sem 5 CSE
  const subDBMS = await prisma.subject.create({
    data: {
      code: '21CS51',
      name: 'Database Management Systems',
      credits: 4,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  const subOS = await prisma.subject.create({
    data: {
      code: '21CS52',
      name: 'Operating Systems',
      credits: 4,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  const subDAA = await prisma.subject.create({
    data: {
      code: '21CS53',
      name: 'Design & Analysis of Algorithms',
      credits: 4,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  const subCN = await prisma.subject.create({
    data: {
      code: '21CS54',
      name: 'Computer Networks',
      credits: 3,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  const subSE = await prisma.subject.create({
    data: {
      code: '21CS55',
      name: 'Software Engineering & Agile',
      credits: 3,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  const subDBMSLab = await prisma.subject.create({
    data: {
      code: '21CSL56',
      name: 'DBMS & Query Optimization Lab',
      credits: 2,
      semesterId: sem5.id,
      branchId: cse.id,
      minimumThreshold: 85.0,
    },
  });

  console.log('✅ Academic structure and subjects created');

  // 9. Timetable for Sem 5 CSE Section A
  const timetable = await prisma.timetable.create({
    data: {
      academicYearId: academicYear.id,
      semesterId: sem5.id,
      branchId: cse.id,
      sectionId: secA.id,
      isActive: true,
    },
  });

  // Timetable Entries: Mon - Fri
  const timetableEntriesData = [
    // Monday (dayOfWeek: 1)
    { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', subjectId: subDBMS.id, faculty: 'Dr. V. Raman', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 1, startTime: '10:00', endTime: '11:00', subjectId: subOS.id, faculty: 'Prof. K. Sharma', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 1, startTime: '11:15', endTime: '12:15', subjectId: subDAA.id, faculty: 'Dr. M. Iyer', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 1, startTime: '13:00', endTime: '14:00', subjectId: subCN.id, faculty: 'Prof. S. Nair', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 1, startTime: '14:00', endTime: '16:00', subjectId: subDBMSLab.id, faculty: 'Dr. V. Raman', room: 'Lab-2', type: 'LAB' },

    // Tuesday (dayOfWeek: 2)
    { dayOfWeek: 2, startTime: '09:00', endTime: '10:00', subjectId: subOS.id, faculty: 'Prof. K. Sharma', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 2, startTime: '10:00', endTime: '11:00', subjectId: subDAA.id, faculty: 'Dr. M. Iyer', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 2, startTime: '11:15', endTime: '12:15', subjectId: subSE.id, faculty: 'Prof. P. Desai', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 2, startTime: '13:00', endTime: '14:00', subjectId: subDBMS.id, faculty: 'Dr. V. Raman', room: 'LH-301', type: 'LECTURE' },

    // Wednesday (dayOfWeek: 3)
    { dayOfWeek: 3, startTime: '09:00', endTime: '10:00', subjectId: subDAA.id, faculty: 'Dr. M. Iyer', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 3, startTime: '10:00', endTime: '11:00', subjectId: subDBMS.id, faculty: 'Dr. V. Raman', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 3, startTime: '11:15', endTime: '12:15', subjectId: subCN.id, faculty: 'Prof. S. Nair', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 3, startTime: '13:00', endTime: '14:00', subjectId: subOS.id, faculty: 'Prof. K. Sharma', room: 'LH-301', type: 'LECTURE' },

    // Thursday (dayOfWeek: 4)
    { dayOfWeek: 4, startTime: '09:00', endTime: '10:00', subjectId: subCN.id, faculty: 'Prof. S. Nair', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 4, startTime: '10:00', endTime: '11:00', subjectId: subSE.id, faculty: 'Prof. P. Desai', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 4, startTime: '11:15', endTime: '12:15', subjectId: subOS.id, faculty: 'Prof. K. Sharma', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 4, startTime: '13:00', endTime: '14:00', subjectId: subDAA.id, faculty: 'Dr. M. Iyer', room: 'LH-301', type: 'LECTURE' },

    // Friday (dayOfWeek: 5)
    { dayOfWeek: 5, startTime: '09:00', endTime: '10:00', subjectId: subSE.id, faculty: 'Prof. P. Desai', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 5, startTime: '10:00', endTime: '11:00', subjectId: subDBMS.id, faculty: 'Dr. V. Raman', room: 'LH-301', type: 'LECTURE' },
    { dayOfWeek: 5, startTime: '11:15', endTime: '12:15', subjectId: subCN.id, faculty: 'Prof. S. Nair', room: 'LH-301', type: 'LECTURE' },
  ];

  const createdEntries: any[] = [];
  for (const entry of timetableEntriesData) {
    const e = await prisma.timetableEntry.create({
      data: {
        timetableId: timetable.id,
        ...entry,
      },
    });
    createdEntries.push(e);
  }

  console.log(`✅ Created timetable with ${createdEntries.length} weekly classes`);

  // 10. Students (Demo credentials: password is "Demo@12345")
  const demoStudentPasswordHash = await bcrypt.hash('Demo@12345', 10);

  // Student 1: Aarav Sharma (Primary demo student)
  const user1 = await prisma.user.create({ data: { role: 'STUDENT' } });
  const student1 = await prisma.student.create({
    data: {
      userId: user1.id,
      usn: '1MS21CS001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@college.edu',
      passwordHash: demoStudentPasswordHash,
      semesterId: sem5.id,
      branchId: cse.id,
      sectionId: secA.id,
    },
  });

  await prisma.notificationPreference.create({
    data: { studentId: student1.id },
  });

  // Student 2: Ananya Rao (Sem 5, CSE, Sec A)
  const user2 = await prisma.user.create({ data: { role: 'STUDENT' } });
  const student2 = await prisma.student.create({
    data: {
      userId: user2.id,
      usn: '1MS21CS002',
      name: 'Ananya Rao',
      email: 'ananya.rao@college.edu',
      passwordHash: demoStudentPasswordHash,
      semesterId: sem5.id,
      branchId: cse.id,
      sectionId: secA.id,
    },
  });
  await prisma.notificationPreference.create({ data: { studentId: student2.id } });

  // Student 3: Rohan Verma (Sem 5, CSE, Sec B)
  const user3 = await prisma.user.create({ data: { role: 'STUDENT' } });
  const student3 = await prisma.student.create({
    data: {
      userId: user3.id,
      usn: '1MS21CS045',
      name: 'Rohan Verma',
      email: 'rohan.verma@college.edu',
      passwordHash: demoStudentPasswordHash,
      semesterId: sem5.id,
      branchId: cse.id,
      sectionId: secB.id,
    },
  });
  await prisma.notificationPreference.create({ data: { studentId: student3.id } });

  console.log(`✅ Seeded demo students: 1MS21CS001, 1MS21CS002, 1MS21CS045 (Password: Demo@12345)`);

  // 11. Attendance Records for Student 1 (Aarav Sharma)
  // Let's generate realistic historical records over the past 4 weeks (20 working days)
  // DBMS: 24 conducted, 20 attended, 4 absent -> 83.3% (Safe, can skip 2)
  // OS: 21 conducted, 15 attended, 6 absent -> 71.4% (Critical! Recovery needed: 3 classes)
  // DAA: 25 conducted, 22 attended, 3 absent -> 88.0% (Safe, can skip 4)
  // CN: 18 conducted, 14 attended, 4 absent -> 77.8% (Warning, close to 75% limit!)
  // SE: 16 conducted, 15 attended, 1 absent -> 93.8% (Safe)
  // DBMS Lab: 6 conducted, 6 attended -> 100% (Safe)

  const makeRecords = (subjectId: string, attendedCount: number, absentCount: number, startDayOffset: number) => {
    const list: any[] = [];
    const total = attendedCount + absentCount;
    // Interleave attended and absent, with recent days mostly attended to establish a streak
    for (let i = 0; i < total; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (total - i) - startDayOffset);
      const dateStr = d.toISOString().split('T')[0];

      // Make last 5 present for streak
      const isAbsent = i >= total - 5 ? false : (i % Math.ceil(total / Math.max(1, absentCount)) === 0 && list.filter(x => x.status === 'ABSENT').length < absentCount);
      const status = isAbsent ? 'ABSENT' : 'PRESENT';

      list.push({
        studentId: student1.id,
        subjectId,
        date: dateStr,
        status,
        remarks: status === 'ABSENT' ? 'Sick leave / Medical' : undefined,
      });
    }
    return list;
  };

  const attendanceEntries = [
    ...makeRecords(subDBMS.id, 20, 4, 1),
    ...makeRecords(subOS.id, 15, 6, 2),
    ...makeRecords(subDAA.id, 22, 3, 1),
    ...makeRecords(subCN.id, 14, 4, 3),
    ...makeRecords(subSE.id, 15, 1, 2),
    ...makeRecords(subDBMSLab.id, 6, 0, 4),
  ];

  for (const item of attendanceEntries) {
    await prisma.attendance.create({ data: item });
  }

  console.log(`✅ Seeded ${attendanceEntries.length} attendance records for ${student1.usn}`);

  // 12. Seed Demo Notifications for Student 1
  await prisma.notification.createMany({
    data: [
      {
        studentId: student1.id,
        title: 'Attendance Alert: Operating Systems',
        message: 'Your OS attendance has dropped to 71.4%, which is below the 75% threshold. You need to attend the next 3 classes to recover.',
        category: 'ATTENDANCE_WARNING',
        isRead: false,
        deduplicationKey: `ATTENDANCE_WARNING:${student1.id}:${subOS.id}:CRITICAL`,
      },
      {
        studentId: student1.id,
        title: 'Safe Skip Available: DAA',
        message: 'Your attendance in DAA is 88.0%. You can safely miss up to 4 more classes and remain above 75%.',
        category: 'SKIP_WARNING',
        isRead: false,
      },
      {
        studentId: student1.id,
        title: 'Streak Milestone! 🔥',
        message: 'You have attended 5 consecutive classes without missing. Keep it up!',
        category: 'SYSTEM',
        isRead: true,
      },
    ],
  });

  // 13. Audit Log
  await prisma.auditLog.create({
    data: {
      actorEmail: admin.email,
      actorRole: 'ADMIN',
      action: 'SYSTEM_INITIALIZATION',
      details: JSON.stringify({ message: 'Seeded initial academic structure, timetable, and students' }),
    },
  });

  console.log('🎉 Seed complete! All initial entities are ready.');
  console.log('\n--- Credentials for testing ---');
  console.log('Admin:');
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log('\nStudent 1 (Sem 5, CSE, Sec A):');
  console.log('  USN: 1MS21CS001');
  console.log('  Semester: 5');
  console.log('  Branch: CSE');
  console.log('  Section: A');
  console.log('-------------------------------\n');
}

main()
  .catch((e) => {
    console.error('Seed script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
