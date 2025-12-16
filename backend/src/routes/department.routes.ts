import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as departmentController from '../controllers/department.controller';

const router = Router();

// Get all departments
router.get('/',
  authenticate,
  departmentController.getAllDepartments
);

// Get department by ID
router.get('/:id',
  authenticate,
  departmentController.getDepartmentById
);

export default router;
