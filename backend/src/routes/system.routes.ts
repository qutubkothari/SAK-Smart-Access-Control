import { Router } from 'express';
import { authorize } from '../middleware/auth';
import {
  getSystemDashboard,
  bulkApproveLeaves,
  bulkRejectLeaves,
  exportAttendanceCSV,
  exportAccessLogsCSV
} from '../controllers/system.controller';

const router = Router();

/**
 * @route   GET /api/v1/system/dashboard
 * @desc    Get comprehensive system dashboard with all metrics
 * @access  Admin
 */
router.get('/dashboard', authorize('admin'), getSystemDashboard);

/**
 * @route   POST /api/v1/system/leaves/bulk-approve
 * @desc    Bulk approve multiple leave applications
 * @access  Admin
 * @body    { leave_ids: number[] }
 */
router.post('/leaves/bulk-approve', authorize('admin'), bulkApproveLeaves);

/**
 * @route   POST /api/v1/system/leaves/bulk-reject
 * @desc    Bulk reject multiple leave applications
 * @access  Admin
 * @body    { leave_ids: number[], review_notes?: string }
 */
router.post('/leaves/bulk-reject', authorize('admin'), bulkRejectLeaves);

/**
 * @route   GET /api/v1/system/export/attendance
 * @desc    Export attendance records to CSV
 * @access  Admin, Secretary
 * @query   start_date, end_date, department_id (optional)
 */
router.get('/export/attendance', authorize('admin', 'secretary'), exportAttendanceCSV);

/**
 * @route   GET /api/v1/system/export/access-logs
 * @desc    Export access logs to CSV
 * @access  Admin, Security
 * @query   start_date, end_date, department_id, access_granted (optional)
 */
router.get('/export/access-logs', authorize('admin', 'security'), exportAccessLogsCSV);

export default router;
