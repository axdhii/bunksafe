import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  studentLogin,
  registerStudent,
  activateStudent,
  adminLogin,
  getMe,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

// Targeted rate limiter for brute-force sensitive auth endpoints
const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const router = Router();

router.post('/student/register', authBruteForceLimiter, registerStudent);
router.post('/student/login', authBruteForceLimiter, studentLogin);
router.post('/student/activate', authBruteForceLimiter, activateStudent);
router.post('/admin/login', authBruteForceLimiter, adminLogin);
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;
