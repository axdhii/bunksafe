import { Router } from 'express';
import multer from 'multer';
import {
  getStudentTimetable,
  getSectionTimetable,
  previewTimetableUpload,
  confirmTimetableImport,
  saveManualTimetable,
  saveTimetableSlot,
  deleteTimetableEntry,
} from '../controllers/timetableController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

const router = Router();

// Student or Admin view
router.get('/student', requireAuth, getStudentTimetable);
router.get('/section', requireAuth, getSectionTimetable);

// Admin-only upload & management
router.post('/preview', requireAuth, requireAdmin, upload.single('file'), previewTimetableUpload);
router.post('/confirm-import', requireAuth, requireAdmin, confirmTimetableImport);
router.post('/save-manual', requireAuth, requireAdmin, saveManualTimetable);
router.post('/slot', requireAuth, requireAdmin, saveTimetableSlot);
router.delete('/entry/:id', requireAuth, requireAdmin, deleteTimetableEntry);

export default router;
