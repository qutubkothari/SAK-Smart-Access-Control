import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  checkInVisitor,
  checkOutVisitor,
  getVisitors,
  getVisitorById,
  lookupVisitor
} from '../controllers/visitor.controller';

const router = Router();

router.use(authenticate);

router.post('/check-in', authorize('receptionist', 'security', 'admin'), checkInVisitor);
router.post('/:id/check-out', authorize('receptionist', 'security', 'admin'), checkOutVisitor);
router.get('/lookup', lookupVisitor);
router.get('/', authorize('admin', 'security'), getVisitors);
router.get('/:id', getVisitorById);

export default router;
