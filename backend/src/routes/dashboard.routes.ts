import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDashboardStats,
  getHostDashboardStats,
  getReceptionistDashboardStats,
  getRecentActivity
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/host-stats', getHostDashboardStats);
router.get('/receptionist-stats', getReceptionistDashboardStats);
router.get('/recent-activity', getRecentActivity);

export default router;
