import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createAvailabilityBlock,
  getAvailabilityBlocks,
  updateAvailabilityBlock,
  deleteAvailabilityBlock
} from '../controllers/availability.controller';

const router = Router();

router.use(authenticate);

router.post('/', authorize('host', 'admin', 'employee', 'secretary'), createAvailabilityBlock);
router.get('/', authorize('host', 'admin', 'employee', 'secretary'), getAvailabilityBlocks);
router.put('/:id', authorize('host', 'admin', 'employee', 'secretary'), updateAvailabilityBlock);
router.delete('/:id', authorize('host', 'admin', 'employee', 'secretary'), deleteAvailabilityBlock);

export default router;
