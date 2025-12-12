import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createMeeting,
  getMeetings,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  checkInHost
} from '../controllers/meeting.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', createMeeting);
router.get('/', getMeetings);
router.get('/:id', getMeetingById);
router.put('/:id', updateMeeting);
router.delete('/:id', cancelMeeting);
router.post('/:id/check-in', checkInHost);

export default router;
