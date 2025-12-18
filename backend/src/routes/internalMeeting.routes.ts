import { Router } from 'express';
import { 
  checkParticipantAvailability,
  createInternalMeeting,
  getInternalMeetingParticipants
} from '../controllers/internalMeeting.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Check participant availability before booking
router.post('/check-availability', authenticate, checkParticipantAvailability);

// Create internal meeting (now includes secretary and employee roles)
router.post('/', authenticate, authorize('admin', 'host', 'receptionist', 'secretary', 'employee'), createInternalMeeting);

// Get participants for a meeting
router.get('/:meeting_id/participants', authenticate, getInternalMeetingParticipants);

export default router;
