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
  resetStudentPassword,
  getSystemSettings,
  updateSystemSetting,
  getAuditLogs,
} from '../controllers/academicController.js';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Express 4 does not catch rejected promises; forward them to the error handler instead of hanging/crashing
const methods = ['get', 'post', 'put', 'delete'] as const;
for (const m of methods) {
  const original = router[m].bind(router) as any;
  (router as any)[m] = (path: string, ...handlers: any[]) =>
    original(path, ...handlers.map((h) => (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(h(req, res, next)).catch(next)));
}

// Public read routes for dropdowns & academic structure during student onboarding
router.get('/semesters', getSemesters);
router.get('/branches', getBranches);
router.get('/sections', getSections);
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
router.post('/students/:id/reset-password', requireAuth, requireAdmin, resetStudentPassword);

router.get('/settings', requireAuth, requireAdmin, getSystemSettings);
router.put('/settings', requireAuth, requireAdmin, updateSystemSetting);

router.get('/audit-logs', requireAuth, requireAdmin, getAuditLogs);

export default router;
