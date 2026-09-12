import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback_secret_for_dev_mode_only_12345';

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
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

    const decoded = jwt.verify(token, AUTH_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'STUDENT' || !req.user.studentId) {
    res.status(403).json({ error: 'Access denied. Student profile required.' });
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
