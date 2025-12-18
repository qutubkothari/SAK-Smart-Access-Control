import { Router } from 'express';
import { 
  getAllMeetingRooms, 
  getMeetingRoomById, 
  createMeetingRoom, 
  updateMeetingRoom,
  checkRoomAvailability,
  getRoomSchedule
} from '../controllers/meetingRoom.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes (authenticated users)
router.get('/', authenticate, getAllMeetingRooms);
router.get('/availability', authenticate, checkRoomAvailability);
router.get('/schedule', authenticate, getRoomSchedule);
router.get('/:id', authenticate, getMeetingRoomById);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), createMeetingRoom);
router.put('/:id', authenticate, authorize('admin'), updateMeetingRoom);

export default router;
