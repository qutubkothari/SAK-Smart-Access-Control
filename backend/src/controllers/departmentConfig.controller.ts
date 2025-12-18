import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get or create department shift configuration
 */
export const getDepartmentConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id } = req.params;

    let config = await db('department_shift_config')
      .leftJoin('attendance_shifts', 'department_shift_config.default_shift_id', 'attendance_shifts.id')
      .where('department_shift_config.department_id', department_id)
      .select(
        'department_shift_config.*',
        'attendance_shifts.name as default_shift_name',
        'attendance_shifts.start_time as default_shift_start',
        'attendance_shifts.end_time as default_shift_end'
      )
      .first();

    // If no config exists, create default
    if (!config) {
      const defaultShift = await db('attendance_shifts')
        .where({ name: 'General (9-6)' })
        .first();

      const newConfig = await db('department_shift_config').insert({
        department_id,
        default_shift_id: defaultShift?.id || null,
        working_days: [1, 2, 3, 4, 5, 6], // Monday to Saturday
        weekend_days: [0], // Sunday
        require_checkout: true,
        auto_checkout_after_hours: 12,
        late_arrival_threshold_minutes: 15,
        early_departure_threshold_minutes: 15
      }).returning('*');

      config = newConfig[0];
    }

    return res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching department config:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch department configuration'
      }
    });
  }
};

/**
 * Update department shift configuration
 */
export const updateDepartmentConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id } = req.params;
    const {
      default_shift_id,
      working_days,
      weekend_days,
      require_checkout,
      auto_checkout_after_hours,
      late_arrival_threshold_minutes,
      early_departure_threshold_minutes
    } = req.body;

    // Check if department exists
    const department = await db('departments').where({ id: department_id }).first();
    if (!department) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEPARTMENT_NOT_FOUND',
          message: 'Department not found'
        }
      });
    }

    // Validate shift if provided
    if (default_shift_id) {
      const shift = await db('attendance_shifts').where({ id: default_shift_id, is_active: true }).first();
      if (!shift) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SHIFT_NOT_FOUND',
            message: 'Shift not found or inactive'
          }
        });
      }
    }

    // Validate working_days and weekend_days
    if (working_days && !Array.isArray(working_days)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WORKING_DAYS',
          message: 'working_days must be an array of day numbers (0-6)'
        }
      });
    }

    if (weekend_days && !Array.isArray(weekend_days)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WEEKEND_DAYS',
          message: 'weekend_days must be an array of day numbers (0-6)'
        }
      });
    }

    // Check if config exists
    const existingConfig = await db('department_shift_config')
      .where({ department_id })
      .first();

    const updateData: any = {};
    if (default_shift_id !== undefined) updateData.default_shift_id = default_shift_id;
    if (working_days !== undefined) updateData.working_days = JSON.stringify(working_days);
    if (weekend_days !== undefined) updateData.weekend_days = JSON.stringify(weekend_days);
    if (require_checkout !== undefined) updateData.require_checkout = require_checkout;
    if (auto_checkout_after_hours !== undefined) updateData.auto_checkout_after_hours = auto_checkout_after_hours;
    if (late_arrival_threshold_minutes !== undefined) updateData.late_arrival_threshold_minutes = late_arrival_threshold_minutes;
    if (early_departure_threshold_minutes !== undefined) updateData.early_departure_threshold_minutes = early_departure_threshold_minutes;

    let config;
    if (existingConfig) {
      // Update existing
      await db('department_shift_config')
        .where({ department_id })
        .update(updateData);

      config = await db('department_shift_config')
        .where({ department_id })
        .first();
    } else {
      // Create new
      config = await db('department_shift_config').insert({
        department_id,
        ...updateData
      }).returning('*');
      config = config[0];
    }

    logger.info(`Department config updated for ${department_id} by ${req.user!.id}`);

    return res.json({
      success: true,
      data: config,
      message: 'Department configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating department config:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update department configuration'
      }
    });
  }
};

/**
 * Get all department configurations
 */
export const getAllDepartmentConfigs = async (_req: AuthRequest, res: Response) => {
  try {
    const configs = await db('department_shift_config')
      .leftJoin('departments', 'department_shift_config.department_id', 'departments.id')
      .leftJoin('attendance_shifts', 'department_shift_config.default_shift_id', 'attendance_shifts.id')
      .select(
        'department_shift_config.*',
        'departments.name as department_name',
        'attendance_shifts.name as default_shift_name',
        'attendance_shifts.start_time as default_shift_start',
        'attendance_shifts.end_time as default_shift_end'
      )
      .orderBy('departments.name', 'asc');

    return res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    logger.error('Error fetching department configs:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch department configurations'
      }
    });
  }
};

/**
 * Reset department configuration to defaults
 */
export const resetDepartmentConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id } = req.params;

    const defaultShift = await db('attendance_shifts')
      .where({ name: 'General (9-6)' })
      .first();

    await db('department_shift_config')
      .where({ department_id })
      .update({
        default_shift_id: defaultShift?.id || null,
        working_days: JSON.stringify([1, 2, 3, 4, 5, 6]),
        weekend_days: JSON.stringify([0]),
        require_checkout: true,
        auto_checkout_after_hours: 12,
        late_arrival_threshold_minutes: 15,
        early_departure_threshold_minutes: 15
      });

    const config = await db('department_shift_config')
      .where({ department_id })
      .first();

    logger.info(`Department config reset to defaults for ${department_id} by ${req.user!.id}`);

    return res.json({
      success: true,
      data: config,
      message: 'Department configuration reset to defaults'
    });
  } catch (error) {
    logger.error('Error resetting department config:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset department configuration'
      }
    });
  }
};
