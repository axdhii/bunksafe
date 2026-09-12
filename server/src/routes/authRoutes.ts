import { Router } from 'express';
import { studentLogin, registerStudent, adminLogin, getMe, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/student/register', registerStudent);
router.post('/student/login', studentLogin);
router.post('/admin/login', adminLogin);
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;
