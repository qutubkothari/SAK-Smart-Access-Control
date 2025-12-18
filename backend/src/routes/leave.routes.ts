import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as leaveController from '../controllers/leave.controller';

const router = Router();

// Apply for leave (all employees)
router.post('/apply',
  authenticate,
  leaveController.applyLeave
);

// Get leave applications
router.get('/applications',
  authenticate,
  leaveController.getLeaveApplications
);

// Approve/reject leave (admin, department heads)
router.put('/applications/:leave_id/status',
  authenticate,
  authorize('admin'),
  leaveController.updateLeaveStatus
);

// Cancel leave application (employee only)
router.delete('/applications/:leave_id/cancel',
  authenticate,
  leaveController.cancelLeave
);

// Get leave balance
router.get('/balance/:employee_id?',
  authenticate,
  leaveController.getLeaveBalance
);

// Get leave statistics (admin only)
router.get('/statistics',
  authenticate,
  authorize('admin', 'security'),
  leaveController.getLeaveStatistics
);

export default router;
