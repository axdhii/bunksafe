import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client.js';
import { generateToken, AuthPayload } from '../middleware/auth.js';
import { logAuditAction } from '../services/auditService.js';

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const normalizeName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

/** Every word of the roster name must be present (any order, case and punctuation ignored). */
export function isNameMatching(dbName: string, inputName: string): boolean {
  const a = normalizeName(dbName);
  return a.length > 0 && a === normalizeName(inputName);
}

const USN_PATTERN = /^[A-Z0-9]{4,20}$/;

function validatePassword(password: unknown): string | null {
  if (!password) return 'Password is required.';
  if (String(password).length < 8) return 'Password must be at least 8 characters long for security.';
  if (String(password).length > 72) return 'Password must not exceed 72 characters.'; // bcrypt ignores bytes past 72
  return null;
}

const studentInclude = { semester: true, branch: true, section: true, user: { select: { tokenVersion: true } } } as const;

/** Issues the session cookie + token and returns the public student payload. */
function startStudentSession(res: Response, student: any) {
  const token = generateToken({
    userId: student.userId,
    role: 'STUDENT',
    studentId: student.id,
    usn: student.usn,
    semesterId: student.semesterId,
    branchId: student.branchId,
    sectionId: student.sectionId,
    tv: student.user?.tokenVersion ?? 0,
  });
  res.cookie('token', token, getAuthCookieOptions());
  return {
    token,
    user: { id: student.userId, role: 'STUDENT' },
    student: publicStudent(student),
  };
}

function publicStudent(student: any) {
  return {
    id: student.id,
    usn: student.usn,
    name: student.name,
    email: student.email,
    batch: student.batch,
    semester: { id: student.semester.id, number: student.semester.number, name: student.semester.name },
    branch: { id: student.branch.id, code: student.branch.code, name: student.branch.name },
    section: { id: student.section.id, name: student.section.name },
  };
}

/**
 * Sets the password on an unclaimed roster record. The WHERE on passwordHash: null makes the
 * claim atomic, so two simultaneous claims cannot both succeed.
 */
async function claimRosterStudent(studentId: string, password: string, extra: { phone?: string | null; email?: string }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { count } = await prisma.student.updateMany({
    where: { id: studentId, passwordHash: null, active: true },
    data: { passwordHash, ...(extra.phone ? { phone: extra.phone } : {}), ...(extra.email ? { email: extra.email } : {}) },
  });
  if (count === 0) return null;
  await prisma.notificationPreference.upsert({ where: { studentId }, create: { studentId }, update: {} });
  return prisma.student.findUnique({ where: { id: studentId }, include: studentInclude });
}

export async function registerStudent(req: Request, res: Response): Promise<void> {
  try {
    const { name, usn, phone, email, password, semesterId, branchId, sectionId, semesterNumber, branchCode, sectionName } = req.body;

    if (!name || !usn || !password) {
      res.status(400).json({ error: 'Name, USN, and Password are required for student registration.' });
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();
    const cleanName = String(name).trim().replace(/\s+/g, ' ');
    if (!USN_PATTERN.test(cleanUsn)) {
      res.status(400).json({ error: 'USN must be 4-20 letters or digits.' });
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      res.status(400).json({ error: 'Please enter your full name (2-100 characters).' });
      return;
    }
    const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;

    const existingStudent = await prisma.student.findUnique({
      where: { usn: cleanUsn },
      omit: { passwordHash: false },
    });

    if (existingStudent) {
      if (existingStudent.passwordHash || !existingStudent.active) {
        res.status(400).json({ error: `A student account with USN ${cleanUsn} is already registered. Please sign in.` });
        return;
      }

      // Preloaded on roster without password: verify the full name to prevent impostor claiming
      if (!isNameMatching(existingStudent.name, cleanName)) {
        res.status(400).json({
          error: `The provided name does not match campus records for USN ${cleanUsn}. Please enter your full official registered name.`,
        });
        return;
      }

      const claimed = await claimRosterStudent(existingStudent.id, String(password), { phone: cleanPhone, email: cleanEmail });
      if (!claimed) {
        res.status(400).json({ error: `A student account with USN ${cleanUsn} is already registered. Please sign in.` });
        return;
      }

      await logAuditAction({
        actorEmail: claimed.email || claimed.usn,
        actorRole: 'STUDENT',
        action: 'STUDENT_ACCOUNT_CLAIMED',
        details: { usn: claimed.usn, name: claimed.name },
        ipAddress: req.ip,
      });

      res.status(200).json(startStudentSession(res, claimed));
      return;
    }

    // New (non-roster) student: the academic assignment must resolve to records that already exist
    let sem = semesterId ? await prisma.semester.findUnique({ where: { id: String(semesterId) } }) : null;
    if (!sem && semesterNumber) sem = await prisma.semester.findFirst({ where: { number: Number(semesterNumber) || -1 } });

    let br = branchId ? await prisma.branch.findUnique({ where: { id: String(branchId) } }) : null;
    if (!br && branchCode) br = await prisma.branch.findFirst({ where: { code: String(branchCode).trim().toUpperCase() } });

    let sec = null;
    if (sem && br) {
      if (sectionId) {
        sec = await prisma.section.findUnique({ where: { id: String(sectionId) } });
        if (sec && (sec.semesterId !== sem.id || sec.branchId !== br.id)) sec = null;
      }
      if (!sec && sectionName) {
        sec = await prisma.section.findFirst({
          where: { name: String(sectionName).trim().toUpperCase(), semesterId: sem.id, branchId: br.id },
        });
      }
    }

    if (!sem || !br || !sec) {
      res.status(400).json({ error: 'Invalid academic assignment. Please select valid Semester, Branch, and Section.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    let student;
    try {
      student = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { role: 'STUDENT' } });
        const newStudent = await tx.student.create({
          data: {
            userId: user.id,
            usn: cleanUsn,
            name: cleanName,
            email: cleanEmail || `${cleanUsn.toLowerCase()}@college.edu`,
            phone: cleanPhone,
            passwordHash,
            semesterId: sem.id,
            branchId: br.id,
            sectionId: sec.id,
          },
          include: studentInclude,
        });
        await tx.notificationPreference.create({ data: { studentId: newStudent.id } });
        return newStudent;
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Another request registered the same USN a moment earlier
        res.status(400).json({ error: `A student account with USN ${cleanUsn} is already registered. Please sign in.` });
        return;
      }
      throw err;
    }

    await logAuditAction({
      actorEmail: student.email || student.usn,
      actorRole: 'STUDENT',
      action: 'STUDENT_REGISTERED',
      details: { usn: student.usn, name: student.name },
      ipAddress: req.ip,
    });

    res.status(201).json(startStudentSession(res, student));
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
    const pwError = validatePassword(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();
    const student = await prisma.student.findUnique({ where: { usn: cleanUsn }, omit: { passwordHash: false } });

    if (!student) {
      res.status(400).json({ error: 'Verification failed. Student record not found.' });
      return;
    }

    if (student.passwordHash || !student.active) {
      res.status(400).json({ error: 'Account has already been set up. Please sign in with your password.' });
      return;
    }

    if (!name && !email) {
      res.status(400).json({ error: 'Verification required. Please provide your registered name or email to claim your account.' });
      return;
    }

    if (name) {
      if (!isNameMatching(student.name, String(name))) {
        res.status(400).json({ error: 'The provided name does not match the registered academic record.' });
        return;
      }
    } else if (student.email) {
      if (student.email.trim().toLowerCase() !== String(email).trim().toLowerCase()) {
        res.status(400).json({ error: 'The provided email does not match the registered academic record.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'The registered student record has no email on file. Please verify using your registered name.' });
      return;
    }

    const claimed = await claimRosterStudent(student.id, String(password), {
      email: email ? String(email).trim().toLowerCase() : undefined,
    });
    if (!claimed) {
      res.status(400).json({ error: 'Account has already been set up. Please sign in with your password.' });
      return;
    }

    await logAuditAction({
      actorEmail: claimed.email || claimed.usn,
      actorRole: 'STUDENT',
      action: 'STUDENT_ACTIVATED',
      details: { usn: claimed.usn },
      ipAddress: req.ip,
    });

    res.json({ success: true, ...startStudentSession(res, claimed) });
  } catch (error: any) {
    console.error('activateStudent error:', error);
    res.status(500).json({ error: 'Failed to activate student account. Please try again.' });
  }
}

export async function studentLogin(req: Request, res: Response): Promise<void> {
  try {
    const { usn, password } = req.body;

    if (!usn) {
      res.status(400).json({ error: 'Please provide your USN to log in.' });
      return;
    }

    const cleanUsn = String(usn).trim().toUpperCase();
    const student = await prisma.student.findFirst({
      where: { usn: cleanUsn, active: true },
      include: studentInclude,
      omit: { passwordHash: false },
    });

    if (!student) {
      res.status(401).json({ error: 'Invalid credentials. Please check your USN and password.' });
      return;
    }

    // Unclaimed roster accounts must set a password via registration first.
    // shortcut: this reveals that a USN is on the roster and unclaimed; the login page relies on it to redirect to Register.
    if (!student.passwordHash) {
      res.status(403).json({
        error: 'Your account is on the campus roster, but your password is not set yet. Please click Register to choose your password.',
        code: 'SETUP_REQUIRED',
        usn: student.usn,
      });
      return;
    }

    if (!password || !(await bcrypt.compare(String(password), student.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials. Please check your USN and password.' });
      return;
    }

    res.json(startStudentSession(res, student));
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
      include: { user: { select: { tokenVersion: true } } },
      omit: { passwordHash: false },
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
      tv: admin.user.tokenVersion,
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
        include: { semester: true, branch: true, section: true },
      });
      if (!student) {
        res.status(404).json({ error: 'Student profile not found.' });
        return;
      }
      if (!student.active) {
        res.status(403).json({ error: 'Student account has been suspended or deactivated.' });
        return;
      }
      res.json({ user: { id: req.user.userId, role: 'STUDENT' }, student: publicStudent(student) });
      return;
    }

    res.status(400).json({ error: 'Unknown role.' });
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // Revoke every token issued so far for this user
    await prisma.user.update({ where: { id: req.user!.userId }, data: { tokenVersion: { increment: 1 } } });
  } catch (err) {
    console.error('logout revoke error:', err);
  }
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const pwError = validatePassword(newPassword);
    if (!currentPassword || pwError) {
      res.status(400).json({ error: pwError || 'Current password is required.' });
      return;
    }

    const { userId, role } = req.user!;
    const record = role === 'ADMIN'
      ? await prisma.admin.findUnique({ where: { userId }, omit: { passwordHash: false } })
      : await prisma.student.findUnique({ where: { userId }, omit: { passwordHash: false } });

    if (!record?.passwordHash || !(await bcrypt.compare(String(currentPassword), record.passwordHash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const [, user] = await prisma.$transaction([
      role === 'ADMIN'
        ? prisma.admin.update({ where: { userId }, data: { passwordHash } })
        : prisma.student.update({ where: { userId }, data: { passwordHash } }),
      prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ]);

    // Other sessions are revoked; hand this device a fresh token
    const token = generateToken({ ...stripJwtClaims(req.user!), tv: user.tokenVersion });
    res.cookie('token', token, getAuthCookieOptions());

    await logAuditAction({
      actorEmail: req.user!.email || req.user!.usn || userId,
      actorRole: role,
      action: 'PASSWORD_CHANGED',
      ipAddress: req.ip,
    });

    res.json({ success: true, token });
  } catch (error: any) {
    console.error('changePassword error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
}

function stripJwtClaims(payload: any): AuthPayload {
  const { iat, exp, ...rest } = payload;
  return rest;
}
