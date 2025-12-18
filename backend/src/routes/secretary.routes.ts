import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAssignedEmployees,
  canBookForEmployee,
  getAllSecretaries,
  assignEmployeeToSecretary,
  removeEmployeeAssignment
} from '../controllers/secretary.controller';

const router = express.Router();

// Secretary routes (accessible by secretaries)
router.get('/my-employees', authenticate, authorize('secretary'), getAssignedEmployees);
router.get('/can-book/:employee_its_id', authenticate, authorize('secretary'), canBookForEmployee);

// Admin routes for managing secretary assignments
router.get('/all', authenticate, authorize('admin'), getAllSecretaries);
router.post('/assign', authenticate, authorize('admin'), assignEmployeeToSecretary);
router.delete('/assignment/:assignment_id', authenticate, authorize('admin'), removeEmployeeAssignment);

export default router;
