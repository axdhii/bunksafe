import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client.js';

// SEC-3: No hardcoded fallback — crash in production if AUTH_SECRET is missing
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: AUTH_SECRET environment variable is required in production.');
}
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_only_secret_not_for_production_use_32chars';

export interface AuthPayload {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
  studentId?: string;
  adminId?: string;
  usn?: string;
  email?: string;
  semesterId?: string;
  branchId?: string;
  sectionId?: string;
  tv?: number; // User.tokenVersion at issue time
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, AUTH_SECRET as jwt.Secret, {
    expiresIn: '7d',
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, AUTH_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  try {
    // Revocation: logout and password changes bump tokenVersion, killing older tokens
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { tokenVersion: true } });
    if (!user || (decoded.tv ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
      return;
    }
  } catch (err) {
    console.error('requireAuth verification error:', err);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    return;
  }

  req.user = decoded;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
}

export async function requireStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || req.user.role !== 'STUDENT' || !req.user.studentId) {
    res.status(403).json({ error: 'Access denied. Student profile required.' });
    return;
  }
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      select: { active: true },
    });
    if (!student || student.active === false) {
      res.status(403).json({ error: 'Student account has been suspended or deactivated.' });
      return;
    }
  } catch (err) {
    // Fail closed: never let a request through when we could not verify the account
    console.error('requireStudent verification error:', err);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    return;
  }
  next();
}

/**
 * Enforces student data isolation: guarantees that requests targeting a studentId
 * or USN cannot manipulate query or URL params to access another student's data.
 */
export function isolateStudent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'ADMIN') {
    return next(); // Admins can inspect students
  }

  const requestedStudentId = req.params.studentId || req.query.studentId || req.body.studentId;
  if (requestedStudentId && requestedStudentId !== req.user?.studentId) {
    res.status(403).json({ error: 'Unauthorized access to student records.' });
    return;
  }

  next();
}
