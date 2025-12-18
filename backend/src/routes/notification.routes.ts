import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendDailyAttendanceSummaries,
  sendLateArrivalAlerts
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

// Email notification endpoints (admin only)
router.post('/send-attendance-summaries', authorize('admin'), sendDailyAttendanceSummaries);
router.post('/send-late-alerts', authorize('admin'), sendLateArrivalAlerts);

export default router;
