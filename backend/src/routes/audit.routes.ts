import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAuditLogs,
  getAuditStatistics,
  getUserActivity,
  exportAuditLogs
} from '../controllers/audit.controller';

const router = Router();

router.use(authenticate);

// Get audit logs (admin, security)
router.get('/', authorize('admin', 'security'), getAuditLogs);

// Get audit statistics (admin only)
router.get('/statistics', authorize('admin'), getAuditStatistics);

// Get user activity timeline (admin, security)
router.get('/user/:user_id', authorize('admin', 'security'), getUserActivity);

// Export audit logs to CSV (admin only)
router.get('/export', authorize('admin'), exportAuditLogs);

export default router;
