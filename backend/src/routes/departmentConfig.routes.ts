import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as departmentConfigController from '../controllers/departmentConfig.controller';

const router = Router();

// Get all department configurations (admin only)
router.get('/',
  authenticate,
  authorize('admin'),
  departmentConfigController.getAllDepartmentConfigs
);

// Get department configuration
router.get('/:department_id',
  authenticate,
  departmentConfigController.getDepartmentConfig
);

// Update department configuration (admin only)
router.put('/:department_id',
  authenticate,
  authorize('admin'),
  departmentConfigController.updateDepartmentConfig
);

// Reset department configuration to defaults (admin only)
router.post('/:department_id/reset',
  authenticate,
  authorize('admin'),
  departmentConfigController.resetDepartmentConfig
);

export default router;
