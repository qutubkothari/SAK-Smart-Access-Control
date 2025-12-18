import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getSecurityStats,
  getLockedAccounts,
  getAccessViolations
} from '../controllers/security.controller';

const router = express.Router();

// All security routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/security/stats
 * @desc    Get security statistics (violations, lockouts, etc.)
 * @access  Admin, Security
 */
router.get('/stats', authorize('admin', 'security'), getSecurityStats);

/**
 * @route   GET /api/v1/security/locked-accounts
 * @desc    Get list of locked accounts
 * @access  Admin, Security
 */
router.get('/locked-accounts', authorize('admin', 'security'), getLockedAccounts);

/**
 * @route   GET /api/v1/security/violations
 * @desc    Get access control violations
 * @access  Admin, Security
 */
router.get('/violations', authorize('admin', 'security'), getAccessViolations);

export default router;
