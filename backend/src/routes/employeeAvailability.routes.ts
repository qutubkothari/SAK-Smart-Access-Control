import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createAvailabilityBlock,
  getMyAvailabilityBlocks,
  checkEmployeeAvailability,
  deleteAvailabilityBlock,
  getMyUpcomingMeetings
} from '../controllers/employeeAvailability.controller';

const router = express.Router();

// Employee routes - manage their own availability
router.post('/blocks', authenticate, authorize('employee', 'admin'), createAvailabilityBlock);
router.get('/blocks', authenticate, authorize('employee', 'admin'), getMyAvailabilityBlocks);
router.delete('/blocks/:block_id', authenticate, authorize('employee', 'admin'), deleteAvailabilityBlock);
router.get('/meetings', authenticate, authorize('employee', 'admin'), getMyUpcomingMeetings);

// Secretary routes - check employee availability before booking
router.post('/check', authenticate, authorize('secretary', 'admin'), checkEmployeeAvailability);

export default router;
