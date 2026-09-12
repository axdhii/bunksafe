import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client.js';
import { logAuditAction } from '../services/auditService.js';

// ==================== SEMESTERS ====================
export async function getSemesters(req: Request, res: Response): Promise<void> {
  const semesters = await prisma.semester.findMany({ orderBy: { number: 'asc' } });
  res.json({ semesters });
}

export async function createSemester(req: Request, res: Response): Promise<void> {
  try {
    const { number, name } = req.body;
    const semester = await prisma.semester.create({
      data: { number: Number(number), name: String(name).trim() },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SEMESTER_CREATED',
      targetEntity: 'Semester',
      targetId: semester.id,
      details: semester,
      ipAddress: req.ip,
    });
    res.status(201).json({ semester });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to create semester. It may already exist.' });
  }
}

export async function deleteSemester(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    await prisma.semester.delete({ where: { id } });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SEMESTER_DELETED',
      targetEntity: 'Semester',
      targetId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Cannot delete semester with linked sections, subjects, or students.' });
  }
}

// ==================== BRANCHES ====================
export async function getBranches(req: Request, res: Response): Promise<void> {
  const branches = await prisma.branch.findMany({ orderBy: { code: 'asc' } });
  res.json({ branches });
}

export async function createBranch(req: Request, res: Response): Promise<void> {
  try {
    const { code, name } = req.body;
    const branch = await prisma.branch.create({
      data: {
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
      },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'BRANCH_CREATED',
      targetEntity: 'Branch',
      targetId: branch.id,
      details: branch,
      ipAddress: req.ip,
    });
    res.status(201).json({ branch });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to create branch. Code may already exist.' });
  }
}

export async function deleteBranch(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    await prisma.branch.delete({ where: { id } });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'BRANCH_DELETED',
      targetEntity: 'Branch',
      targetId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Cannot delete branch with active students or subjects.' });
  }
}

// ==================== SECTIONS ====================
export async function getSections(req: Request, res: Response): Promise<void> {
  const { semesterId, branchId } = req.query;
  const where: any = {};
  if (semesterId) where.semesterId = String(semesterId);
  if (branchId) where.branchId = String(branchId);

  const sections = await prisma.section.findMany({
    where,
    include: { semester: true, branch: true },
    orderBy: { name: 'asc' },
  });
  res.json({ sections });
}

export async function createSection(req: Request, res: Response): Promise<void> {
  try {
    const { name, semesterId, branchId } = req.body;
    const section = await prisma.section.create({
      data: {
        name: String(name).trim().toUpperCase(),
        semesterId,
        branchId,
      },
      include: { semester: true, branch: true },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SECTION_CREATED',
      targetEntity: 'Section',
      targetId: section.id,
      details: section,
      ipAddress: req.ip,
    });
    res.status(201).json({ section });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to create section. Section may already exist in this semester/branch.' });
  }
}

export async function deleteSection(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    await prisma.section.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Cannot delete section with active students or timetable.' });
  }
}

// ==================== SUBJECTS ====================
export async function getSubjects(req: Request, res: Response): Promise<void> {
  const { semesterId, branchId } = req.query;
  const where: any = {};
  if (semesterId) where.semesterId = String(semesterId);
  if (branchId) where.branchId = String(branchId);

  const subjects = await prisma.subject.findMany({
    where,
    include: { semester: true, branch: true },
    orderBy: { code: 'asc' },
  });
  res.json({ subjects });
}

export async function createSubject(req: Request, res: Response): Promise<void> {
  try {
    const { code, name, credits, semesterId, branchId, minimumThreshold } = req.body;
    const subject = await prisma.subject.create({
      data: {
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
        credits: Number(credits) || 4,
        semesterId,
        branchId,
        minimumThreshold: minimumThreshold ? parseFloat(minimumThreshold) : 85.0,
      },
      include: { semester: true, branch: true },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SUBJECT_CREATED',
      targetEntity: 'Subject',
      targetId: subject.id,
      details: subject,
      ipAddress: req.ip,
    });
    res.status(201).json({ subject });
  } catch (error: any) {
    res.status(400).json({ error: 'Subject code already exists in this semester/branch.' });
  }
}

export async function updateSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { name, credits, minimumThreshold } = req.body;
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        credits: credits !== undefined ? Number(credits) : undefined,
        minimumThreshold: minimumThreshold !== undefined ? parseFloat(minimumThreshold) : undefined,
      },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SUBJECT_UPDATED',
      targetEntity: 'Subject',
      targetId: id,
      details: subject,
      ipAddress: req.ip,
    });
    res.json({ subject });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to update subject.' });
  }
}

export async function deleteSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    await prisma.subject.delete({ where: { id } });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SUBJECT_DELETED',
      targetEntity: 'Subject',
      targetId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Cannot delete subject that has timetable entries or attendance records.' });
  }
}

// ==================== STUDENTS ====================
export async function getStudents(req: Request, res: Response): Promise<void> {
  const { semesterId, branchId, sectionId, search } = req.query;
  const where: any = {};
  if (semesterId) where.semesterId = String(semesterId);
  if (branchId) where.branchId = String(branchId);
  if (sectionId) where.sectionId = String(sectionId);

  if (search && typeof search === 'string') {
    const term = search.trim();
    where.OR = [
      { usn: { contains: term } },
      { name: { contains: term } },
      { email: { contains: term } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      semester: true,
      branch: true,
      section: true,
    },
    orderBy: { usn: 'asc' },
  });
  res.json({ students });
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  try {
    const { usn, name, email, semesterId, branchId, sectionId } = req.body;
    const cleanUsn = String(usn).trim().toUpperCase();

    // Check if USN already exists
    const existing = await prisma.student.findUnique({ where: { usn: cleanUsn } });
    if (existing) {
      res.status(400).json({ error: `A student with USN ${cleanUsn} already exists.` });
      return;
    }

    // Create user and student in transaction
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: 'STUDENT' },
      });

      const st = await tx.student.create({
        data: {
          userId: user.id,
          usn: cleanUsn,
          name: String(name).trim(),
          email: email ? String(email).trim() : null,
          semesterId,
          branchId,
          sectionId,
        },
        include: {
          semester: true,
          branch: true,
          section: true,
        },
      });

      // Initialize default notification preferences
      await tx.notificationPreference.create({
        data: { studentId: st.id },
      });

      return st;
    });

    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'STUDENT_CREATED',
      targetEntity: 'Student',
      targetId: student.id,
      details: { usn: student.usn, name: student.name },
      ipAddress: req.ip,
    });

    res.status(201).json({ student });
  } catch (error: any) {
    console.error('createStudent error:', error);
    res.status(400).json({ error: 'Failed to create student: ' + error.message });
  }
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { name, email, semesterId, branchId, sectionId, active } = req.body;

    const student = await prisma.student.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        email: email !== undefined ? (email ? String(email).trim() : null) : undefined,
        semesterId: semesterId || undefined,
        branchId: branchId || undefined,
        sectionId: sectionId || undefined,
        active: active !== undefined ? Boolean(active) : undefined,
      },
      include: {
        semester: true,
        branch: true,
        section: true,
      },
    });

    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'STUDENT_UPDATED',
      targetEntity: 'Student',
      targetId: id,
      details: student,
      ipAddress: req.ip,
    });

    res.json({ student });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to update student.' });
  }
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // Delete student and cascade user
    await prisma.user.delete({ where: { id: student.userId } });

    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'STUDENT_DELETED',
      targetEntity: 'Student',
      targetId: id,
      details: { usn: student.usn, name: student.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Student ${student.usn} deleted successfully.` });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to delete student.' });
  }
}

// ==================== SYSTEM SETTINGS & AUDIT LOGS ====================
export async function getSystemSettings(req: Request, res: Response): Promise<void> {
  const settings = await prisma.systemSetting.findMany();
  const academicYears = await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
  res.json({ settings, academicYears });
}

export async function updateSystemSetting(req: Request, res: Response): Promise<void> {
  try {
    const { key, value, description } = req.body;
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value), description },
      create: { key, value: String(value), description },
    });
    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'SYSTEM_SETTING_UPDATED',
      targetEntity: 'SystemSetting',
      targetId: setting.id,
      details: { key, value },
      ipAddress: req.ip,
    });
    res.json({ setting });
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to update system setting.' });
  }
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ logs });
}
