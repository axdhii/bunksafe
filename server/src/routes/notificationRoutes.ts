import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getPreferences,
  updatePreferences,
  subscribePush,
  broadcastAnnouncement,
} from '../controllers/notificationController.js';
import { requireAuth, requireStudent, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Student routes
router.get('/', requireAuth, requireStudent, getNotifications);
router.put('/:id/read', requireAuth, requireStudent, markNotificationRead);
router.put('/read-all', requireAuth, requireStudent, markAllNotificationsRead);
router.get('/preferences', requireAuth, requireStudent, getPreferences);
router.put('/preferences', requireAuth, requireStudent, updatePreferences);
router.post('/subscribe', requireAuth, requireStudent, subscribePush);

// Admin route
router.post('/broadcast', requireAuth, requireAdmin, broadcastAnnouncement);

export default router;
