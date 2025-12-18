import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { createAdhocVisit, getAdhocVisits } from '../controllers/adhoc.controller';

const router = Router();

router.use(authenticate);

// Create adhoc/walk-in visit
router.post('/', authorize('receptionist', 'security', 'admin'), createAdhocVisit);

// Get adhoc visits
router.get('/', authorize('receptionist', 'security', 'admin'), getAdhocVisits);

export default router;
