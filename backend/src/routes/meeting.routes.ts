import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createMeeting,
  getMeetingAvailability,
  getMeetings,
  getMyMeetings,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  checkInHost
} from '../controllers/meeting.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', authorize('host', 'admin'), createMeeting);
router.get('/', getMeetings);
router.get('/availability', getMeetingAvailability);
router.get('/my-meetings', getMyMeetings);
router.get('/:id', getMeetingById);
router.put('/:id', authorize('host', 'admin'), updateMeeting);
router.delete('/:id', authorize('host', 'admin'), cancelMeeting);
router.post('/:id/check-in', checkInHost);

export default router;
