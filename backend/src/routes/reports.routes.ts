import { Router } from 'express';
import { authorize } from '../middleware/auth';
import {
  getDepartmentAccessReport,
  getVisitorAccessReport,
  getAttendanceDashboard
} from '../controllers/reports.controller';

const router = Router();

/**
 * @route   GET /api/v1/reports/access/department
 * @desc    Get department-wise access control report
 * @access  Admin, Security
 * @query   start_date, end_date, department_id (optional)
 */
router.get('/access/department', authorize('admin', 'security'), getDepartmentAccessReport);

/**
 * @route   GET /api/v1/reports/access/visitor
 * @desc    Get visitor access report
 * @access  Admin, Security, Receptionist
 * @query   start_date, end_date, host_id (optional)
 */
router.get('/access/visitor', authorize('admin', 'security', 'receptionist'), getVisitorAccessReport);

/**
 * @route   GET /api/v1/reports/attendance/dashboard
 * @desc    Get attendance dashboard with analytics
 * @access  Admin, Secretary
 * @query   start_date, end_date, department_id (optional)
 */
router.get('/attendance/dashboard', authorize('admin', 'secretary'), getAttendanceDashboard);

export default router;
