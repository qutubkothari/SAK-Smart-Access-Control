import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getMyAttendance,
  getMyAccessLogs,
  getMyLeaves,
  getMyShift,
  getMyProfile,
  getMyHolidays
} from '../controllers/employee.controller';

const router = Router();

// All routes require authentication (any logged-in employee)
// No role-based authorization - employees can only access their own data

/**
 * @route   GET /api/v1/me/profile
 * @desc    Get employee's own profile
 * @access  Authenticated Employee
 */
router.get('/profile', authenticate, getMyProfile);

/**
 * @route   GET /api/v1/me/attendance
 * @desc    Get employee's own attendance records
 * @access  Authenticated Employee
 * @query   start_date, end_date, status (optional)
 */
router.get('/attendance', authenticate, getMyAttendance);

/**
 * @route   GET /api/v1/me/access-logs
 * @desc    Get employee's own access logs
 * @access  Authenticated Employee
 * @query   start_date, end_date, floor_number, access_granted (optional)
 */
router.get('/access-logs', authenticate, getMyAccessLogs);

/**
 * @route   GET /api/v1/me/leaves
 * @desc    Get employee's own leave applications
 * @access  Authenticated Employee
 * @query   status, leave_type (optional)
 */
router.get('/leaves', authenticate, getMyLeaves);

/**
 * @route   GET /api/v1/me/shift
 * @desc    Get employee's current shift assignment and history
 * @access  Authenticated Employee
 */
router.get('/shift', authenticate, getMyShift);

/**
 * @route   GET /api/v1/me/holidays
 * @desc    Get upcoming holidays (company-wide and department-specific)
 * @access  Authenticated Employee
 */
router.get('/holidays', authenticate, getMyHolidays);

export default router;
