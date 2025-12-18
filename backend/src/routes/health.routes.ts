import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  healthCheck,
  detailedHealth,
  getMetrics,
  getDatabaseStats,
  testServices
} from '../controllers/health.controller';

const router = Router();

// Public health check (no auth required)
router.get('/', healthCheck);

// Detailed health check (admin only)
router.get('/detailed', authenticate, authorize('admin'), detailedHealth);

// System metrics (admin only)
router.get('/metrics', authenticate, authorize('admin'), getMetrics);

// Database statistics (admin only)
router.get('/database', authenticate, authorize('admin'), getDatabaseStats);

// Service tests (admin only)
router.get('/services', authenticate, authorize('admin'), testServices);

export default router;
