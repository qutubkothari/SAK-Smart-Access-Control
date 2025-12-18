import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  validateAccess,
  logEmployeeAccess,
  getEmployeeAccessLogs,
  getEmployeeFloorAccess,
  grantFloorAccess,
  revokeFloorAccess
} from '../controllers/access.controller';

const router = Router();

router.use(authenticate);

// Public endpoints (for access control readers/scanners)
router.post('/validate', validateAccess);
router.post('/log', logEmployeeAccess);

// Admin/Security endpoints
router.get('/logs', authorize('admin', 'security', 'receptionist'), getEmployeeAccessLogs);
router.get('/employee/:employee_id/floors', getEmployeeFloorAccess);

// Admin only
router.post('/grant', authorize('admin'), grantFloorAccess);
router.delete('/:id/revoke', authorize('admin'), revokeFloorAccess);

export default router;
