import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import auditService from '../services/audit.service';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Validate if employee has access to a specific floor/zone
 */
export const validateAccess = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, floor_number, card_number, its_id } = req.body;

    if ((!employee_id && !card_number && !its_id) || !floor_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Employee identifier (employee_id, card_number, or its_id) and floor_number are required'
        }
      });
      return;
    }

    // Find employee
    let employee: any;
    if (employee_id) {
      employee = await db('users').where({ id: employee_id, is_active: true }).first();
    } else if (card_number) {
      employee = await db('users').where({ card_number, is_active: true }).first();
    } else if (its_id) {
      employee = await db('users').where({ its_id, is_active: true }).first();
    }

    if (!employee) {
      res.status(404).json({
        success: false,
        access_granted: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee not found or inactive'
        }
      });
      return;
    }

    // Check if employee has access to this floor
    const currentTime = new Date();
    const currentTimeStr = currentTime.toTimeString().slice(0, 8); // HH:MM:SS
    const currentDate = currentTime.toISOString().split('T')[0];

    const floorAccess = await db('employee_floor_access')
      .where({
        employee_id: employee.id,
        floor_number,
        is_active: true
      })
      .where(function(this: any) {
        this.whereNull('valid_from').orWhere('valid_from', '<=', currentDate);
      })
      .where(function(this: any) {
        this.whereNull('valid_until').orWhere('valid_until', '>=', currentDate);
      })
      .first();

    if (!floorAccess) {
      res.status(403).json({
        success: false,
        access_granted: false,
        error: {
          code: 'ACCESS_DENIED',
          message: `Employee does not have access to floor ${floor_number}`
        },
        employee: {
          id: employee.id,
          name: employee.name,
          its_id: employee.its_id
        }
      });
      return;
    }

    // Check time-based access if applicable
    if (floorAccess.access_type === 'time_based' && floorAccess.allowed_from_time && floorAccess.allowed_to_time) {
      if (currentTimeStr < floorAccess.allowed_from_time || currentTimeStr > floorAccess.allowed_to_time) {
        res.status(403).json({
          success: false,
          access_granted: false,
          error: {
            code: 'ACCESS_DENIED_TIME',
            message: `Access allowed only between ${floorAccess.allowed_from_time} and ${floorAccess.allowed_to_time}`
          },
          employee: {
            id: employee.id,
            name: employee.name,
            its_id: employee.its_id
          }
        });
        return;
      }
    }

    // Access granted!
    res.json({
      success: true,
      access_granted: true,
      message: 'Access granted',
      employee: {
        id: employee.id,
        name: employee.name,
        its_id: employee.its_id,
        email: employee.email,
        department_id: employee.department_id
      },
      access_details: {
        floor_number: floorAccess.floor_number,
        building: floorAccess.building,
        zone: floorAccess.zone,
        access_type: floorAccess.access_type,
        valid_until: floorAccess.valid_until
      }
    });
  } catch (error) {
    logger.error('Error validating access:', error);
    res.status(500).json({
      success: false,
      access_granted: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate access'
      }
    });
  }
};

/**
 * Log employee access (check-in or check-out)
 */
export const logEmployeeAccess = async (req: AuthRequest, res: Response) => {
  try {
    const {
      employee_id,
      access_point_code,
      access_method,
      card_number,
      its_id,
      floor_number,
      building = 'Main',
      zone,
      is_entry = true
    } = req.body;

    // Validate required fields
    if (!access_method || (!employee_id && !card_number && !its_id)) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'access_method and employee identifier required'
        }
      });
      return;
    }

    // Find employee
    let employee: any;
    if (employee_id) {
      employee = await db('users').where({ id: employee_id }).first();
    } else if (card_number) {
      employee = await db('users').where({ card_number }).first();
    } else if (its_id) {
      employee = await db('users').where({ its_id }).first();
    }

    if (!employee) {
      res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee not found'
        }
      });
      return;
    }

    // Get access point
    let accessPoint: any;
    if (access_point_code) {
      accessPoint = await db('access_points').where({ code: access_point_code, is_active: true }).first();
    }

    // Validate access first
    const validationResult = await validateAccessInternal(
      employee.id,
      floor_number || accessPoint?.floor_number
    );

    if (!validationResult.access_granted) {
      // Log denied access
      await db('employee_access_logs').insert({
        employee_id: employee.id,
        access_point_id: accessPoint?.id,
        entry_time: new Date(),
        access_method,
        card_number: card_number || employee.card_number,
        its_id: its_id || employee.its_id,
        floor_number: floor_number || accessPoint?.floor_number,
        building: building || accessPoint?.building,
        zone: zone || accessPoint?.zone,
        access_granted: false,
        denial_reason: validationResult.denial_reason
      });

      // Log security event for denied access
      await auditService.logAccessAttempt(
        employee.id,
        false,
        accessPoint?.id || 'unknown',
        req.ip,
        req.get('user-agent')
      );

      res.status(403).json({
        success: false,
        access_granted: false,
        error: {
          code: 'ACCESS_DENIED',
          message: validationResult.denial_reason || 'Access denied'
        }
      });
      return;
    }

    // Check if there's an open entry (no exit yet)
    if (!is_entry) {
      const openEntry = await db('employee_access_logs')
        .where({ employee_id: employee.id })
        .whereNull('exit_time')
        .orderBy('entry_time', 'desc')
        .first();

      if (openEntry) {
        // Update with exit time
        await db('employee_access_logs')
          .where({ id: openEntry.id })
          .update({ exit_time: new Date() });

        res.json({
          success: true,
          access_granted: true,
          message: 'Exit logged successfully',
          log: {
            id: openEntry.id,
            entry_time: openEntry.entry_time,
            exit_time: new Date()
          }
        });
        return;
      }
    }

    // Log new entry
    const [logEntry] = await db('employee_access_logs')
      .insert({
        employee_id: employee.id,
        access_point_id: accessPoint?.id,
        entry_time: new Date(),
        access_method,
        card_number: card_number || employee.card_number,
        its_id: its_id || employee.its_id,
        floor_number: floor_number || accessPoint?.floor_number,
        building: building || accessPoint?.building,
        zone: zone || accessPoint?.zone,
        access_granted: true
      })
      .returning('*');

    // Log successful access
    await auditService.logAccessAttempt(
      employee.id,
      true,
      accessPoint?.id || 'unknown',
      req.ip,
      req.get('user-agent')
    );

    logger.info(`Employee access logged: ${employee.name} at floor ${logEntry.floor_number}`);

    res.json({
      success: true,
      access_granted: true,
      message: 'Access logged successfully',
      log: logEntry,
      employee: {
        id: employee.id,
        name: employee.name,
        its_id: employee.its_id
      }
    });
  } catch (error) {
    logger.error('Error logging employee access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log access'
      }
    });
  }
};

/**
 * Internal function to validate access (used by logEmployeeAccess)
 */
async function validateAccessInternal(
  employee_id: string,
  floor_number: number
): Promise<{ access_granted: boolean; denial_reason?: string }> {
  if (!floor_number) {
    return { access_granted: true }; // No floor restriction
  }

  const currentTime = new Date();
  const currentTimeStr = currentTime.toTimeString().slice(0, 8);
  const currentDate = currentTime.toISOString().split('T')[0];

  const floorAccess = await db('employee_floor_access')
    .where({
      employee_id,
      floor_number,
      is_active: true
    })
    .where(function(this: any) {
      this.whereNull('valid_from').orWhere('valid_from', '<=', currentDate);
    })
    .where(function(this: any) {
      this.whereNull('valid_until').orWhere('valid_until', '>=', currentDate);
    })
    .first();

  if (!floorAccess) {
    return {
      access_granted: false,
      denial_reason: `No access permission for floor ${floor_number}`
    };
  }

  // Check time-based access
  if (floorAccess.access_type === 'time_based' && floorAccess.allowed_from_time && floorAccess.allowed_to_time) {
    if (currentTimeStr < floorAccess.allowed_from_time || currentTimeStr > floorAccess.allowed_to_time) {
      return {
        access_granted: false,
        denial_reason: `Access allowed only between ${floorAccess.allowed_from_time} and ${floorAccess.allowed_to_time}`
      };
    }
  }

  return { access_granted: true };
}

/**
 * Get employee access logs
 */
export const getEmployeeAccessLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, from_date, to_date, floor_number, access_granted, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('employee_access_logs')
      .leftJoin('users', 'employee_access_logs.employee_id', 'users.id')
      .leftJoin('access_points', 'employee_access_logs.access_point_id', 'access_points.id')
      .select(
        'employee_access_logs.*',
        'users.name as employee_name',
        'users.its_id as employee_its_id',
        'access_points.name as access_point_name',
        'access_points.code as access_point_code'
      )
      .orderBy('employee_access_logs.entry_time', 'desc');

    if (employee_id) {
      query = query.where('employee_access_logs.employee_id', employee_id as string);
    }

    if (from_date) {
      query = query.where('employee_access_logs.entry_time', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('employee_access_logs.entry_time', '<=', to_date as string);
    }

    if (floor_number) {
      query = query.where('employee_access_logs.floor_number', Number(floor_number));
    }

    if (access_granted !== undefined) {
      query = query.where('employee_access_logs.access_granted', access_granted === 'true');
    }

    const [{ count }] = await query.clone().count('* as count');
    const logs = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: logs,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching employee access logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch access logs'
      }
    });
  }
};

/**
 * Get employee floor access permissions
 */
export const getEmployeeFloorAccess = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id } = req.params;

    const access = await db('employee_floor_access')
      .where({ employee_id, is_active: true })
      .orderBy('floor_number', 'asc');

    res.json({
      success: true,
      data: access
    });
  } catch (error) {
    logger.error('Error fetching employee floor access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch floor access'
      }
    });
  }
};

/**
 * Grant floor access to employee (Admin only)
 */
export const grantFloorAccess = async (req: AuthRequest, res: Response) => {
  try {
    const {
      employee_id,
      floor_number,
      building = 'Main',
      zone,
      access_type = 'permanent',
      allowed_from_time,
      allowed_to_time,
      valid_from,
      valid_until
    } = req.body;

    if (!employee_id || !floor_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'employee_id and floor_number are required'
        }
      });
      return;
    }

    // Check if access already exists
    const existing = await db('employee_floor_access')
      .where({ employee_id, floor_number, is_active: true })
      .first();

    if (existing) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ACCESS_EXISTS',
          message: 'Employee already has access to this floor'
        }
      });
      return;
    }

    const [access] = await db('employee_floor_access')
      .insert({
        employee_id,
        floor_number,
        building,
        zone,
        access_type,
        allowed_from_time,
        allowed_to_time,
        valid_from,
        valid_until,
        is_active: true,
        granted_by: req.user!.id
      })
      .returning('*');

    // Log access grant
    await auditService.logCreate(
      req.user!.id,
      'floor_access',
      access.id,
      { employee_id, floor_number, building, zone, access_type, valid_from, valid_until },
      req.ip,
      req.get('user-agent')
    );

    logger.info(`Floor access granted: Employee ${employee_id} to floor ${floor_number}`);

    res.json({
      success: true,
      message: 'Floor access granted successfully',
      data: access
    });
  } catch (error) {
    logger.error('Error granting floor access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to grant floor access'
      }
    });
  }
};

/**
 * Revoke floor access (Admin only)
 */
export const revokeFloorAccess = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get access record before revocation
    const accessRecord = await db('employee_floor_access').where({ id }).first();

    if (!accessRecord) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Floor access record not found'
        }
      });
      return;
    }

    await db('employee_floor_access')
      .where({ id })
      .update({ is_active: false, updated_at: new Date() });

    // Log access revocation
    await auditService.logDelete(
      req.user!.id,
      'floor_access',
      id,
      { employee_id: accessRecord.employee_id, floor_number: accessRecord.floor_number, building: accessRecord.building },
      req.ip,
      req.get('user-agent')
    );

    logger.info(`Floor access revoked: ID ${id}`);

    res.json({
      success: true,
      message: 'Floor access revoked successfully'
    });
  } catch (error) {
    logger.error('Error revoking floor access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke floor access'
      }
    });
  }
};
