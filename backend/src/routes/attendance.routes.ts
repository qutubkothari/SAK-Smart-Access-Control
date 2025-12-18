import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as attendanceController from '../controllers/attendance.controller';

const router = Router();

// Calculate attendance (admin/cron job)
router.post('/calculate', 
  authenticate, 
  authorize('admin'),
  attendanceController.calculateAttendance
);

// Get attendance records (admin, security, receptionist can view all)
router.get('/records', 
  authenticate,
  authorize('admin', 'security', 'receptionist'),
  attendanceController.getAttendanceRecords
);

// Get employee attendance summary
router.get('/employee/:employee_id/summary',
  authenticate,
  attendanceController.getEmployeeAttendanceSummary
);

// Get department attendance summary
router.get('/department/:department_id/summary',
  authenticate,
  authorize('admin', 'security'),
  attendanceController.getDepartmentAttendanceSummary
);

export default router;
