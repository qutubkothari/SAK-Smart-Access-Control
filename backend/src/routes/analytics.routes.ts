import { Router } from 'express';
import {
  getSystemAnalytics,
  getVisitorAnalytics,
  getAttendanceAnalytics,
  getMeetingRoomAnalytics
} from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/analytics/system
 * @desc Get comprehensive system analytics
 * @access Admin, Manager
 */
router.get('/system', authorize('admin', 'manager', 'receptionist'), getSystemAnalytics);

/**
 * @route GET /api/v1/analytics/visitors
 * @desc Get visitor analytics and patterns
 * @access Admin, Manager, Receptionist
 */
router.get('/visitors', authorize('admin', 'manager', 'receptionist'), getVisitorAnalytics);

/**
 * @route GET /api/v1/analytics/attendance
 * @desc Get attendance analytics
 * @access Admin, Manager, HR
 */
router.get('/attendance', authorize('admin', 'manager', 'hr'), getAttendanceAnalytics);

/**
 * @route GET /api/v1/analytics/meeting-rooms
 * @desc Get meeting room utilization analytics
 * @access Admin, Manager
 */
router.get('/meeting-rooms', authorize('admin', 'manager', 'receptionist'), getMeetingRoomAnalytics);

export default router;
