import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get employees assigned to a secretary
 */
export const getAssignedEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const secretaryId = req.user?.id;

    if (!secretaryId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const employees = await db('secretary_employee_assignments as sea')
      .join('users as u', 'sea.employee_id', 'u.id')
      .where('sea.secretary_id', secretaryId)
      .where('sea.is_active', true)
      .where('u.is_active', true)
      .select(
        'u.id',
        'u.its_id',
        'u.name',
        'u.email',
        'u.phone',
        'u.role',
        'sea.assigned_at'
      )
      .orderBy('u.name', 'asc');

    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    logger.error('Error fetching assigned employees:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assigned employees' }
    });
  }
};

/**
 * Check if secretary can book for an employee
 */
export const canBookForEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_its_id } = req.params;
    const secretaryId = req.user?.id;

    if (!secretaryId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    // Get employee
    const employee = await db('users')
      .where({ its_id: employee_its_id, is_active: true })
      .first();

    if (!employee) {
      res.status(404).json({
        success: false,
        error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' }
      });
      return;
    }

    // Check assignment
    const assignment = await db('secretary_employee_assignments')
      .where({
        secretary_id: secretaryId,
        employee_id: employee.id,
        is_active: true
      })
      .first();

    res.json({
      success: true,
      data: {
        can_book: !!assignment,
        employee: assignment ? {
          id: employee.id,
          its_id: employee.its_id,
          name: employee.name,
          email: employee.email,
          phone: employee.phone
        } : null
      }
    });
  } catch (error) {
    logger.error('Error checking booking permission:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check booking permission' }
    });
  }
};

/**
 * Get all secretaries (admin only)
 */
export const getAllSecretaries = async (_req: AuthRequest, res: Response) => {
  try {
    const secretaries = await db('users')
      .where({ role: 'secretary', is_active: true })
      .select('id', 'its_id', 'name', 'email', 'phone', 'created_at')
      .orderBy('name', 'asc');

    res.json({
      success: true,
      data: secretaries
    });
  } catch (error) {
    logger.error('Error fetching secretaries:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch secretaries' }
    });
  }
};

/**
 * Assign employee to secretary (admin only)
 */
export const assignEmployeeToSecretary = async (req: AuthRequest, res: Response) => {
  try {
    const { secretary_id, employee_id } = req.body;
    const adminId = req.user?.id;

    if (!secretary_id || !employee_id) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'secretary_id and employee_id are required' }
      });
      return;
    }

    // Verify secretary exists
    const secretary = await db('users')
      .where({ id: secretary_id, role: 'secretary', is_active: true })
      .first();

    if (!secretary) {
      res.status(404).json({
        success: false,
        error: { code: 'SECRETARY_NOT_FOUND', message: 'Secretary not found' }
      });
      return;
    }

    // Verify employee exists
    const employee = await db('users')
      .where({ id: employee_id, role: 'employee', is_active: true })
      .first();

    if (!employee) {
      res.status(404).json({
        success: false,
        error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' }
      });
      return;
    }

    // Check if already assigned
    const existing = await db('secretary_employee_assignments')
      .where({ secretary_id, employee_id, is_active: true })
      .first();

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_ASSIGNED', message: 'Employee already assigned to this secretary' }
      });
      return;
    }

    // Create assignment
    await db('secretary_employee_assignments').insert({
      secretary_id,
      employee_id,
      is_active: true,
      assigned_by: adminId
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Employee assigned successfully',
        secretary: { id: secretary.id, name: secretary.name },
        employee: { id: employee.id, name: employee.name }
      }
    });
  } catch (error) {
    logger.error('Error assigning employee:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to assign employee' }
    });
  }
};

/**
 * Remove employee assignment (admin only)
 */
export const removeEmployeeAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { assignment_id } = req.params;

    const assignment = await db('secretary_employee_assignments')
      .where({ id: assignment_id })
      .first();

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' }
      });
      return;
    }

    await db('secretary_employee_assignments')
      .where({ id: assignment_id })
      .update({ is_active: false, updated_at: new Date() });

    res.json({
      success: true,
      data: { message: 'Assignment removed successfully' }
    });
  } catch (error) {
    logger.error('Error removing assignment:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove assignment' }
    });
  }
};
