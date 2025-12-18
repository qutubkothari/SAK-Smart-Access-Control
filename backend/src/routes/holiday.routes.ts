import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as holidayController from '../controllers/holiday.controller';

const router = Router();

// Create holiday (admin only)
router.post('/',
  authenticate,
  authorize('admin'),
  holidayController.createHoliday
);

// Get all holidays
router.get('/',
  authenticate,
  holidayController.getHolidays
);

// Get upcoming holidays
router.get('/upcoming',
  authenticate,
  holidayController.getUpcomingHolidays
);

// Get holiday calendar
router.get('/calendar',
  authenticate,
  holidayController.getHolidayCalendar
);

// Update holiday (admin only)
router.put('/:holiday_id',
  authenticate,
  authorize('admin'),
  holidayController.updateHoliday
);

// Delete holiday (admin only)
router.delete('/:holiday_id',
  authenticate,
  authorize('admin'),
  holidayController.deleteHoliday
);

// Bulk import holidays (admin only)
router.post('/bulk-import',
  authenticate,
  authorize('admin'),
  holidayController.bulkImportHolidays
);

export default router;
