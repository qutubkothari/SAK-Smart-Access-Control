import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as shiftController from '../controllers/shift.controller';

const router = Router();

// Create shift (admin only)
router.post('/',
  authenticate,
  authorize('admin'),
  shiftController.createShift
);

// Get all shifts
router.get('/',
  authenticate,
  shiftController.getShifts
);

// Update shift (admin only)
router.put('/:shift_id',
  authenticate,
  authorize('admin'),
  shiftController.updateShift
);

// Delete shift (admin only)
router.delete('/:shift_id',
  authenticate,
  authorize('admin'),
  shiftController.deleteShift
);

// Assign shift to employee (admin only)
router.post('/assign',
  authenticate,
  authorize('admin'),
  shiftController.assignShiftToEmployee
);

// Bulk assign shift to department (admin only)
router.post('/bulk-assign',
  authenticate,
  authorize('admin'),
  shiftController.bulkAssignShift
);

// Get employee shift assignments
router.get('/employee/:employee_id',
  authenticate,
  shiftController.getEmployeeShifts
);

// Get current shift for employee
router.get('/employee/:employee_id/current',
  authenticate,
  shiftController.getCurrentShift
);

export default router;
