import { Router } from 'express';
import {
  getStudentWeeklyAnalytics,
  getAdminAttendanceOverview,
} from '../controllers/analyticsController.js';
import { requireAuth, requireStudent, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Student weekly analytics
router.get('/weekly', requireAuth, requireStudent, getStudentWeeklyAnalytics);

// Admin overall cohort analytics
router.get('/admin/overview', requireAuth, requireAdmin, getAdminAttendanceOverview);

export default router;
