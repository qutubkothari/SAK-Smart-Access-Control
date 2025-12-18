import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Create shift
 */
export const createShift = async (req: AuthRequest, res: Response) => {
  try {
    const { name, start_time, end_time, grace_period_minutes, break_duration_minutes, description } = req.body;

    // Validate time format (HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_FORMAT',
          message: 'Time must be in HH:MM:SS format'
        }
      });
    }

    const shift = await db('attendance_shifts').insert({
      name,
      start_time,
      end_time,
      grace_period_minutes: grace_period_minutes || 15,
      break_duration_minutes: break_duration_minutes || 60,
      description,
      is_active: true
    }).returning('*');

    logger.info(`Shift created: ${name} by ${req.user!.id}`);

    return res.status(201).json({
      success: true,
      data: shift[0],
      message: 'Shift created successfully'
    });
  } catch (error) {
    logger.error('Error creating shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create shift'
      }
    });
  }
};

/**
 * Get all shifts
 */
export const getShifts = async (req: AuthRequest, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = db('attendance_shifts').orderBy('name', 'asc');

    if (is_active !== undefined) {
      query = query.where('is_active', is_active === 'true');
    }

    const shifts = await query;

    return res.json({
      success: true,
      data: shifts
    });
  } catch (error) {
    logger.error('Error fetching shifts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch shifts'
      }
    });
  }
};

/**
 * Update shift
 */
export const updateShift = async (req: AuthRequest, res: Response) => {
  try {
    const { shift_id } = req.params;
    const { name, start_time, end_time, grace_period_minutes, break_duration_minutes, description, is_active } = req.body;

    const shift = await db('attendance_shifts').where({ id: shift_id }).first();

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHIFT_NOT_FOUND',
          message: 'Shift not found'
        }
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (grace_period_minutes !== undefined) updateData.grace_period_minutes = grace_period_minutes;
    if (break_duration_minutes !== undefined) updateData.break_duration_minutes = break_duration_minutes;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    await db('attendance_shifts').where({ id: shift_id }).update(updateData);

    const updated = await db('attendance_shifts').where({ id: shift_id }).first();

    logger.info(`Shift ${shift_id} updated by ${req.user!.id}`);

    return res.json({
      success: true,
      data: updated,
      message: 'Shift updated successfully'
    });
  } catch (error) {
    logger.error('Error updating shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update shift'
      }
    });
  }
};

/**
 * Delete shift
 */
export const deleteShift = async (req: AuthRequest, res: Response) => {
  try {
    const { shift_id } = req.params;

    const shift = await db('attendance_shifts').where({ id: shift_id }).first();

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHIFT_NOT_FOUND',
          message: 'Shift not found'
        }
      });
    }

    // Check if shift is assigned to employees
    const assignedCount = await db('employee_shifts')
      .where({ shift_id, is_active: true })
      .count('* as count')
      .first();

    if (assignedCount && parseInt(assignedCount.count as string) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHIFT_IN_USE',
          message: `Cannot delete shift. It is assigned to ${assignedCount.count} employee(s)`
        }
      });
    }

    // Soft delete
    await db('attendance_shifts').where({ id: shift_id }).update({ is_active: false });

    logger.info(`Shift ${shift_id} deleted by ${req.user!.id}`);

    return res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete shift'
      }
    });
  }
};

/**
 * Assign shift to employee
 */
export const assignShiftToEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, shift_id, effective_from, effective_until } = req.body;

    // Validate employee
    const employee = await db('users').where({ id: employee_id }).first();
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee not found'
        }
      });
    }

    // Validate shift
    const shift = await db('attendance_shifts').where({ id: shift_id, is_active: true }).first();
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHIFT_NOT_FOUND',
          message: 'Shift not found or inactive'
        }
      });
    }

    // Deactivate current shift assignment if exists
    await db('employee_shifts')
      .where({ employee_id, is_active: true })
      .update({ is_active: false });

    // Create new assignment
    const assignment = await db('employee_shifts').insert({
      employee_id,
      shift_id,
      effective_from: effective_from ? new Date(effective_from) : new Date(),
      effective_until: effective_until ? new Date(effective_until) : null,
      is_active: true,
      assigned_by: req.user!.id
    }).returning('*');

    logger.info(`Shift ${shift_id} assigned to employee ${employee_id} by ${req.user!.id}`);

    return res.status(201).json({
      success: true,
      data: assignment[0],
      message: 'Shift assigned successfully'
    });
  } catch (error) {
    logger.error('Error assigning shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to assign shift'
      }
    });
  }
};

/**
 * Get employee shift assignments
 */
export const getEmployeeShifts = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id } = req.params;

    const shifts = await db('employee_shifts')
      .leftJoin('attendance_shifts', 'employee_shifts.shift_id', 'attendance_shifts.id')
      .leftJoin('users as assigned_user', 'employee_shifts.assigned_by', 'assigned_user.id')
      .where('employee_shifts.employee_id', employee_id)
      .orderBy('employee_shifts.effective_from', 'desc')
      .select(
        'employee_shifts.*',
        'attendance_shifts.name as shift_name',
        'attendance_shifts.start_time',
        'attendance_shifts.end_time',
        'attendance_shifts.grace_period_minutes',
        'attendance_shifts.break_duration_minutes',
        'assigned_user.name as assigned_by_name'
      );

    return res.json({
      success: true,
      data: shifts
    });
  } catch (error) {
    logger.error('Error fetching employee shifts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employee shifts'
      }
    });
  }
};

/**
 * Get current shift for employee
 */
export const getCurrentShift = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id } = req.params;
    const today = new Date();

    const shift = await db('employee_shifts')
      .leftJoin('attendance_shifts', 'employee_shifts.shift_id', 'attendance_shifts.id')
      .where('employee_shifts.employee_id', employee_id)
      .where('employee_shifts.is_active', true)
      .where('employee_shifts.effective_from', '<=', today)
      .where(function(this: any) {
        this.whereNull('employee_shifts.effective_until')
          .orWhere('employee_shifts.effective_until', '>=', today);
      })
      .select(
        'employee_shifts.*',
        'attendance_shifts.name as shift_name',
        'attendance_shifts.start_time',
        'attendance_shifts.end_time',
        'attendance_shifts.grace_period_minutes',
        'attendance_shifts.break_duration_minutes'
      )
      .first();

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_SHIFT_ASSIGNED',
          message: 'No active shift assigned to employee'
        }
      });
    }

    return res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    logger.error('Error fetching current shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch current shift'
      }
    });
  }
};

/**
 * Bulk assign shifts to department
 */
export const bulkAssignShift = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id, shift_id, effective_from } = req.body;

    // Validate shift
    const shift = await db('attendance_shifts').where({ id: shift_id, is_active: true }).first();
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SHIFT_NOT_FOUND',
          message: 'Shift not found or inactive'
        }
      });
    }

    // Get all employees in department
    const employees = await db('users')
      .where({ department_id, is_active: true })
      .whereIn('role', ['employee', 'host', 'secretary']);

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_EMPLOYEES',
          message: 'No active employees found in department'
        }
      });
    }

    // Deactivate current assignments
    await db('employee_shifts')
      .whereIn('employee_id', employees.map(e => e.id))
      .where('is_active', true)
      .update({ is_active: false });

    // Create new assignments
    const assignments = employees.map(emp => ({
      employee_id: emp.id,
      shift_id,
      effective_from: effective_from ? new Date(effective_from) : new Date(),
      effective_until: null,
      is_active: true,
      assigned_by: req.user!.id
    }));

    await db('employee_shifts').insert(assignments);

    logger.info(`Shift ${shift_id} bulk assigned to ${employees.length} employees in department ${department_id} by ${req.user!.id}`);

    return res.json({
      success: true,
      message: `Shift assigned to ${employees.length} employee(s)`,
      data: {
        shift_id,
        department_id,
        employees_count: employees.length
      }
    });
  } catch (error) {
    logger.error('Error bulk assigning shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to bulk assign shift'
      }
    });
  }
};
