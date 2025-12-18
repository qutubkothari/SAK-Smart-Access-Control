import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  issueVisitorCard,
  validateVisitorCard,
  logVisitorCardAccess,
  deactivateVisitorCard,
  getVisitorCard,
  getVisitorCardLogs
} from '../controllers/visitorCard.controller';

const router = Router();

router.use(authenticate);

// Receptionist endpoints
router.post('/issue', authorize('admin', 'receptionist'), issueVisitorCard);
router.post('/deactivate', authorize('admin', 'receptionist'), deactivateVisitorCard);

// Public endpoints (for card readers/scanners)
router.post('/validate', validateVisitorCard);
router.post('/log', logVisitorCardAccess);

// Query endpoints
router.get('/:card_number', getVisitorCard);
router.get('/logs/all', authorize('admin', 'security', 'receptionist'), getVisitorCardLogs);

export default router;
