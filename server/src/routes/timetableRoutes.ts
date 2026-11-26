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
  clearSectionTimetable,
  aiScanTimetable,
  aiConfirmTimetable,
} from '../controllers/timetableController.js';
import { requireAuth, requireAdmin, requireStudent } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    // The extension decides how the file is parsed, so it must be one we support
    if (ext === 'csv' || ext === 'xlsx') {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Invalid file format. Only .csv and .xlsx files are supported.'), { status: 400 }));
    }
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|webp|pdf)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Invalid file format. Only image files (JPEG, PNG, WEBP) and PDFs are supported.'), { status: 400 }));
    }
  },
});

const router = Router();

// Student-specific timetable view (SEC: protected with requireStudent)
router.get('/student', requireAuth, requireStudent, getStudentTimetable);
router.get('/section', requireAuth, getSectionTimetable);

// Admin-only upload & management
router.post('/preview', requireAuth, requireAdmin, upload.single('file'), previewTimetableUpload);
router.post('/confirm-import', requireAuth, requireAdmin, confirmTimetableImport);
router.post('/save-manual', requireAuth, requireAdmin, saveManualTimetable);
router.post('/slot', requireAuth, requireAdmin, saveTimetableSlot);
router.delete('/entry/:id', requireAuth, requireAdmin, deleteTimetableEntry);
router.delete('/section', requireAuth, requireAdmin, clearSectionTimetable);

// Smart AI Scanner Routes (Gemini Multimodal Ingest)
router.post('/ai-scan', requireAuth, requireAdmin, imageUpload.single('file'), aiScanTimetable);
router.post('/ai-confirm', requireAuth, requireAdmin, aiConfirmTimetable);

export default router;
