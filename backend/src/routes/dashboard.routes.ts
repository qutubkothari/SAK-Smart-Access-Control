import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDashboardStats,
  getRecentActivity
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);

export default router;
