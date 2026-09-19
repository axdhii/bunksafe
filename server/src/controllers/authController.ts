import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client.js';
import { generateToken } from '../middleware/auth.js';
import { logAuditAction } from '../services/auditService.js';

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export function isNameMatching(dbName: string, inputName: string): boolean {
  const normDb = dbName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  const normInput = inputName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  if (!normDb || !normInput) return false;
  if (normDb === normInput) return true;

  const dbTokens = normDb.split(' ').filter(t => t.length > 1);
  const inputTokens = normInput.split(' ').filter(t => t.length > 1);

  if (inputTokens.length === 0) {
    return normDb === normInput;
  }

  // At least one substantial word (>= 3 chars) matches or all non-trivial tokens match
  const substantialTokens = inputTokens.filter(t => t.length >= 3);
  if (substantialTokens.length > 0) {
    const hasSubstantialMatch = substantialTokens.some(tok => dbTokens.includes(tok));
    if (hasSubstantialMatch) return true;
  }

  return inputTokens.every(tok => dbTokens.includes(tok));
}

export async function registerStudent(req: Request, res: Response): Promise<void> {
  try {
    const { name, usn, phone, email, password, semesterId, branchId, sectionId, semesterNumber, branchCode, sectionName } = req.body;

    if (!name || !usn || !password) {
      res.status(400).json({ error: 'Name, USN, and Password are required for student registration.' });
      return;
    }

    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long for security.' });
      return;
    }

    if (String(password).length > 128) {
      res.status(400).json({ error: 'Password must not exceed 128 characters.' });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();
    const cleanName = String(name).trim();
    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : `${cleanUsn.toLowerCase()}@college.edu`;

    // Check if USN already exists
    const existingStudent = await prisma.student.findUnique({
      where: { usn: cleanUsn },
      include: {
        semester: true,
        branch: true,
        section: true,
      },
    });

    if (existingStudent) {
      if (existingStudent.passwordHash) {
        res.status(400).json({ error: `A student account with USN ${cleanUsn} is already registered. Please sign in.` });
        return;
      }

      // Preloaded on roster without password: verify student's name to prevent impostor claiming
      if (!isNameMatching(existingStudent.name, cleanName)) {
        res.status(400).json({
          error: `The provided name does not match campus records for USN ${cleanUsn}. Please enter your official registered name.`,
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const claimedStudent = await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          passwordHash,
          phone: cleanPhone || existingStudent.phone,
          ...(email ? { email: cleanEmail } : {}),
        },
        include: {
          semester: true,
          branch: true,
          section: true,
        },
      });

      await prisma.notificationPreference.upsert({
        where: { studentId: claimedStudent.id },
        create: { studentId: claimedStudent.id },
        update: {},
      });

      const token = generateToken({
        userId: claimedStudent.userId,
        role: 'STUDENT',
        studentId: claimedStudent.id,
        usn: claimedStudent.usn,
        semesterId: claimedStudent.semesterId,
        branchId: claimedStudent.branchId,
        sectionId: claimedStudent.sectionId,
      });

      res.cookie('token', token, getAuthCookieOptions());

      await logAuditAction({
        actorEmail: claimedStudent.email || claimedStudent.usn,
        actorRole: 'STUDENT',
        action: 'STUDENT_ACCOUNT_CLAIMED',
        details: { usn: claimedStudent.usn, name: claimedStudent.name },
        ipAddress: req.ip,
      });

      res.status(200).json({
        token,
        user: { id: claimedStudent.userId, role: 'STUDENT' },
        student: {
          id: claimedStudent.id,
          usn: claimedStudent.usn,
          name: claimedStudent.name,
          email: claimedStudent.email,
          semester: { id: claimedStudent.semester.id, number: claimedStudent.semester.number, name: claimedStudent.semester.name },
          branch: { id: claimedStudent.branch.id, code: claimedStudent.branch.code, name: claimedStudent.branch.name },
          section: { id: claimedStudent.section.id, name: claimedStudent.section.name },
        },
      });
      return;
    }

    // Resolve semester, branch, and section defensively
    let sem: any = null;
    if (semesterId) {
      sem = await prisma.semester.findUnique({ where: { id: String(semesterId) } }).catch(() => null);
    }
    if (!sem && semesterNumber) {
      sem = await prisma.semester.findFirst({ where: { number: Number(semesterNumber) } });
    }
    if (!sem) {
      sem = await prisma.semester.findFirst({ orderBy: { number: 'asc' } });
    }
    const semId = sem?.id;

    let br: any = null;
    if (branchId) {
      br = await prisma.branch.findUnique({ where: { id: String(branchId) } }).catch(() => null);
    }
    if (!br && branchCode) {
      br = await prisma.branch.findFirst({ where: { code: String(branchCode).trim().toUpperCase() } });
    }
    if (!br) {
      br = await prisma.branch.findFirst({ orderBy: { code: 'asc' } });
    }
    const bId = br?.id;

    let sec: any = null;
    if (sectionId && semId && bId) {
      sec = await prisma.section.findUnique({ where: { id: String(sectionId) } }).catch(() => null);
      if (sec && (sec.semesterId !== semId || sec.branchId !== bId)) {
        sec = null;
      }
    }
    if (!sec && semId && bId) {
      const secName = sectionName ? String(sectionName).trim().toUpperCase() : 'A';
      sec = await prisma.section.findFirst({
        where: { name: secName, semesterId: semId, branchId: bId },
      });
      if (!sec) {
        try {
          sec = await prisma.section.create({
            data: {
              name: secName,
              semesterId: semId,
              branchId: bId,
            },
          });
        } catch {
          sec = await prisma.section.findFirst({
            where: { semesterId: semId, branchId: bId },
          });
        }
      }
    }
    const secId = sec?.id;

    if (!semId || !bId || !secId) {
      res.status(400).json({ error: 'Invalid academic assignment. Please select valid Semester, Branch, and Section.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create User & Student atomically
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: 'STUDENT' },
      });

      const newStudent = await tx.student.create({
        data: {
          userId: user.id,
          usn: cleanUsn,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          passwordHash,
          semesterId: semId,
          branchId: bId,
          sectionId: secId,
        },
        include: {
          semester: true,
          branch: true,
          section: true,
        },
      });

      // Default Notification Preferences
      await tx.notificationPreference.create({
        data: { studentId: newStudent.id },
      });

      return newStudent;
    });

    const token = generateToken({
      userId: student.userId,
      role: 'STUDENT',
      studentId: student.id,
      usn: student.usn,
      semesterId: student.semesterId,
      branchId: student.branchId,
      sectionId: student.sectionId,
    });

    res.cookie('token', token, getAuthCookieOptions());

    await logAuditAction({
      actorEmail: student.email || student.usn,
      actorRole: 'STUDENT',
      action: 'STUDENT_REGISTERED',
      details: { usn: student.usn, name: student.name },
      ipAddress: req.ip,
    });

    res.status(201).json({
      token,
      user: { id: student.userId, role: 'STUDENT' },
      student: {
        id: student.id,
        usn: student.usn,
        name: student.name,
        email: student.email,
        semester: { id: student.semester.id, number: student.semester.number, name: student.semester.name },
        branch: { id: student.branch.id, code: student.branch.code, name: student.branch.name },
        section: { id: student.section.id, name: student.section.name },
      },
    });
  } catch (error: any) {
    console.error('Student registration error:', error);
    res.status(500).json({ error: 'Failed to register student account. Please try again.' });
  }
}

export async function activateStudent(req: Request, res: Response): Promise<void> {
  try {
    const { usn, name, email, password } = req.body;

    if (!usn || !password) {
      res.status(400).json({ error: 'USN and new password are required.' });
      return;
    }

    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long for security.' });
      return;
    }

    if (String(password).length > 128) {
      res.status(400).json({ error: 'Password must not exceed 128 characters.' });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();

    const student = await prisma.student.findUnique({
      where: { usn: cleanUsn },
      include: {
        semester: true,
        branch: true,
        section: true,
        user: true,
      },
    });

    if (!student) {
      res.status(400).json({ error: 'Verification failed. Student record not found.' });
      return;
    }

    if (student.passwordHash) {
      res.status(400).json({ error: 'Account has already been set up. Please sign in with your password.' });
      return;
    }

    // SEC-CRIT-01: Verification must be strictly mandatory
    if (!name && !email) {
      res.status(400).json({ error: 'Verification required. Please provide your registered name or email to claim your account.' });
      return;
    }

    if (name) {
      if (!isNameMatching(student.name, String(name))) {
        res.status(400).json({ error: 'The provided name does not match the registered academic record.' });
        return;
      }
    } else if (email && student.email) {
      const studentEmail = student.email.trim().toLowerCase();
      if (studentEmail !== String(email).trim().toLowerCase()) {
        res.status(400).json({ error: 'The provided email does not match the registered academic record.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'The registered student record has no email on file. Please verify using your registered name.' });
      return;
    }

    // Hash the student's chosen password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update student with the new password
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        passwordHash,
        ...(email ? { email: String(email).trim().toLowerCase() } : {}),
      },
      include: {
        semester: true,
        branch: true,
        section: true,
      },
    });

    const token = generateToken({
      userId: updatedStudent.userId,
      role: 'STUDENT',
      studentId: updatedStudent.id,
      usn: updatedStudent.usn,
      semesterId: updatedStudent.semesterId,
      branchId: updatedStudent.branchId,
      sectionId: updatedStudent.sectionId,
    });

    res.cookie('token', token, getAuthCookieOptions());

    await logAuditAction({
      actorEmail: updatedStudent.email || updatedStudent.usn,
      actorRole: 'STUDENT',
      action: 'STUDENT_ACTIVATED',
      details: { usn: updatedStudent.usn },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: { id: updatedStudent.userId, role: 'STUDENT' },
      student: {
        id: updatedStudent.id,
        usn: updatedStudent.usn,
        name: updatedStudent.name,
        email: updatedStudent.email,
        semester: {
          id: updatedStudent.semester.id,
          number: updatedStudent.semester.number,
          name: updatedStudent.semester.name,
        },
        branch: {
          id: updatedStudent.branch.id,
          code: updatedStudent.branch.code,
          name: updatedStudent.branch.name,
        },
        section: {
          id: updatedStudent.section.id,
          name: updatedStudent.section.name,
        },
      },
    });
  } catch (error: any) {
    console.error('activateStudent error:', error);
    res.status(500).json({ error: 'Failed to activate student account. Please try again.' });
  }
}

export async function studentLogin(req: Request, res: Response): Promise<void> {
  try {
    const { usn, password } = req.body;

    if (!usn) {
      res.status(400).json({
        error: 'Please provide your USN to log in.',
      });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();

    let student: any;
    try {
      student = await prisma.student.findFirst({
        where: { usn: cleanUsn, active: true },
        include: {
          semester: true,
          branch: true,
          section: true,
          user: true,
        },
      });
    } catch (dbErr) {
      console.error('Database error during student login:', dbErr);
    }

    if (!student) {
      // SEC-6: Generic error message to prevent USN enumeration
      res.status(401).json({
        error: 'Invalid credentials. Please check your USN and password.',
      });
      return;
    }

    // Zero-Trust Check: unactivated accounts without passwordHash must set password via registration
    if (!student.passwordHash) {
      res.status(403).json({
        error: 'Your account is on the campus roster, but your password is not set yet. Please click Register to choose your password.',
        code: 'SETUP_REQUIRED',
        usn: student.usn,
      });
      return;
    }

    if (!password) {
      res.status(401).json({ error: 'Invalid credentials. Please check your USN and password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, student.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials. Please check your USN and password.' });
      return;
    }

    const token = generateToken({
      userId: student.userId,
      role: 'STUDENT',
      studentId: student.id,
      usn: student.usn,
      semesterId: student.semesterId,
      branchId: student.branchId,
      sectionId: student.sectionId,
    });

    res.cookie('token', token, getAuthCookieOptions());

    res.json({
      token,
      user: {
        id: student.userId,
        role: 'STUDENT',
      },
      student: {
        id: student.id,
        usn: student.usn,
        name: student.name,
        email: student.email,
        semester: {
          id: student.semester.id,
          number: student.semester.number,
          name: student.semester.name,
        },
        branch: {
          id: student.branch.id,
          code: student.branch.code,
          name: student.branch.name,
        },
        section: {
          id: student.section.id,
          name: student.section.name,
        },
      },
    });
  } catch (error: any) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Unable to process login. Please try again.' });
  }
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
      where: { email: cleanEmail },
      include: { user: true },
    });

    if (!admin || !admin.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken({
      userId: admin.userId,
      role: 'ADMIN',
      adminId: admin.id,
      email: admin.email,
    });

    res.cookie('token', token, getAuthCookieOptions());

    await logAuditAction({
      actorEmail: admin.email,
      actorRole: 'ADMIN',
      action: 'ADMIN_LOGIN',
      details: { email: admin.email },
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        id: admin.userId,
        role: 'ADMIN',
      },
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Unable to process admin login.' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    if (req.user.role === 'ADMIN') {
      const admin = await prisma.admin.findUnique({
        where: { id: req.user.adminId },
      });
      if (!admin) {
        res.status(404).json({ error: 'Admin profile not found.' });
        return;
      }
      res.json({
        user: { id: req.user.userId, role: 'ADMIN' },
        admin: { id: admin.id, email: admin.email, name: admin.name },
      });
      return;
    }

    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { id: req.user.studentId },
        include: {
          semester: true,
          branch: true,
          section: true,
        },
      });
      if (!student) {
        res.status(404).json({ error: 'Student profile not found.' });
        return;
      }
      res.json({
        user: { id: req.user.userId, role: 'STUDENT' },
        student: {
          id: student.id,
          usn: student.usn,
          name: student.name,
          email: student.email,
          semester: {
            id: student.semester.id,
            number: student.semester.number,
            name: student.semester.name,
          },
          branch: {
            id: student.branch.id,
            code: student.branch.code,
            name: student.branch.name,
          },
          section: {
            id: student.section.id,
            name: student.section.name,
          },
        },
      });
      return;
    }

    res.status(400).json({ error: 'Unknown role.' });
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
}
