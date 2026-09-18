import { Router } from 'express';
import {
  getSemesters,
  createSemester,
  deleteSemester,
  getBranches,
  createBranch,
  deleteBranch,
  getSections,
  createSection,
  deleteSection,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getSystemSettings,
  updateSystemSetting,
  getAuditLogs,
} from '../controllers/academicController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Authenticated read routes for dropdowns & student lookup (SEC-11: no longer public)
router.get('/semesters', requireAuth, getSemesters);
router.get('/branches', requireAuth, getBranches);
router.get('/sections', requireAuth, getSections);
router.get('/subjects', requireAuth, getSubjects);

// Admin-only management
router.post('/semesters', requireAuth, requireAdmin, createSemester);
router.delete('/semesters/:id', requireAuth, requireAdmin, deleteSemester);

router.post('/branches', requireAuth, requireAdmin, createBranch);
router.delete('/branches/:id', requireAuth, requireAdmin, deleteBranch);

router.post('/sections', requireAuth, requireAdmin, createSection);
router.delete('/sections/:id', requireAuth, requireAdmin, deleteSection);

router.post('/subjects', requireAuth, requireAdmin, createSubject);
router.put('/subjects/:id', requireAuth, requireAdmin, updateSubject);
router.delete('/subjects/:id', requireAuth, requireAdmin, deleteSubject);

router.get('/students', requireAuth, requireAdmin, getStudents);
router.post('/students', requireAuth, requireAdmin, createStudent);
router.put('/students/:id', requireAuth, requireAdmin, updateStudent);
router.delete('/students/:id', requireAuth, requireAdmin, deleteStudent);

router.get('/settings', requireAuth, requireAdmin, getSystemSettings);
router.put('/settings', requireAuth, requireAdmin, updateSystemSetting);

router.get('/audit-logs', requireAuth, requireAdmin, getAuditLogs);

export default router;
