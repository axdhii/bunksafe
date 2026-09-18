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
  aiScanTimetable,
  aiConfirmTimetable,
} from '../controllers/timetableController.js';
import { requireAuth, requireAdmin, requireStudent } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const isCsv = ext === 'csv' || file.mimetype.includes('csv') || file.mimetype === 'text/plain';
    const isXlsx = ext === 'xlsx' || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel');
    if (isCsv || isXlsx) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only .csv and .xlsx files are supported.'));
    }
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const isImageOrPdf =
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      /\.(jpg|jpeg|png|webp|pdf)$/i.test(file.originalname);
    if (isImageOrPdf) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only image files (JPEG, PNG, WEBP) and PDFs are supported.'));
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

// Smart AI Scanner Routes (Gemini Multimodal Ingest)
router.post('/ai-scan', requireAuth, requireAdmin, imageUpload.single('file'), aiScanTimetable);
router.post('/ai-confirm', requireAuth, requireAdmin, aiConfirmTimetable);

export default router;
