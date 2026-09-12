import { Router } from 'express';
import {
  getDashboard,
  markAttendance,
  batchMarkTodayPresent,
  getAttendanceHistory,
  getProjections,
  syncOfflineAttendance,
} from '../controllers/attendanceController.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireStudent);

router.get('/dashboard', getDashboard);
router.post('/mark', markAttendance);
router.post('/mark-all-today', batchMarkTodayPresent);
router.get('/history', getAttendanceHistory);
router.get('/projections', getProjections);
router.post('/sync', syncOfflineAttendance);

export default router;
