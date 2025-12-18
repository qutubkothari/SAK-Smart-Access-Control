import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import auditService from '../services/audit.service';
import db from '../config/database';
import logger from '../utils/logger';
import { io } from '../server';
import { notifyLeaveApplication, notifyLeaveStatusUpdate } from './notification.controller';

/**
 * Apply for leave
 */
export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leave_type, from_date, to_date, reason, half_day, half_day_period } = req.body;
    const employee_id = req.user!.id;

    // Validate dates
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);
    
    if (toDate < fromDate) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'End date must be after start date'
        }
      });
      return;
    }

    // Calculate leave days
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const leaveDays = half_day ? 0.5 : daysDiff;

    // Check leave balance
    const employee = await db('users').where({ id: employee_id }).first();
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

    // Get department head for approval
    const department = await db('departments').where({ id: employee.department_id }).first();
    
    const leave = await db('employee_leaves').insert({
      employee_id,
      leave_type,
      from_date: fromDate,
      to_date: toDate,
      number_of_days: leaveDays,
      reason,
      half_day: half_day || false,
      half_day_period: half_day ? half_day_period : null,
      status: 'pending',
      applied_at: new Date()
    }).returning('*');

    // Notify department head
    if (department?.head_id) {
      io.to(`user_${department.head_id}`).emit('leave_application', {
        type: 'leave_application',
        employee_name: employee.name,
        employee_its_id: employee.its_id,
        leave_type,
        from_date,
        to_date,
        days: leaveDays,
        leave_id: leave[0].id
      });
    }

    // Send email notification to managers
    await notifyLeaveApplication(
      employee_id,
      leave_type,
      from_date,
      to_date,
      reason
    );

    // Log leave application
    await auditService.logCreate(
      employee_id,
      'leave_application',
      leave[0].id,
      { leave_type, from_date, to_date, number_of_days: leaveDays, status: 'pending' },
      req.ip,
      req.get('user-agent')
    );

    logger.info(`Leave applied by employee ${employee_id}: ${leave_type} for ${leaveDays} days`);

    res.status(201).json({
      success: true,
      data: leave[0],
      message: 'Leave application submitted successfully'
    });
  } catch (error) {
    logger.error('Error applying leave:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to apply for leave'
      }
    });
  }
};

/**
 * Get leave applications
 */
export const getLeaveApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employee_id, department_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userRole = req.user!.role;

    let query = db('employee_leaves')
      .leftJoin('users', 'employee_leaves.employee_id', 'users.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .select(
        'employee_leaves.*',
        'users.name as employee_name',
        'users.its_id',
        'departments.name as department_name'
      )
      .orderBy('employee_leaves.applied_at', 'desc');

    // Role-based filtering
    if (userRole === 'employee' || userRole === 'host' || userRole === 'secretary') {
      // Employees see only their own leaves
      query = query.where('employee_leaves.employee_id', req.user!.id);
    } else if (userRole === 'security' || userRole === 'receptionist') {
      // Security/receptionist see all leaves
    } else if (userRole === 'admin') {
      // Admin sees all
    }

    if (employee_id) {
      query = query.where('employee_leaves.employee_id', employee_id as string);
    }

    if (department_id) {
      query = query.where('users.department_id', department_id as string);
    }

    if (status) {
      query = query.where('employee_leaves.status', status as string);
    }

    if (from_date) {
      query = query.where('employee_leaves.from_date', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('employee_leaves.to_date', '<=', to_date as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const leaves = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: leaves,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching leave applications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leave applications'
      }
    });
  }
};

/**
 * Approve or reject leave
 */
export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leave_id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be either approved or rejected'
        }
      });
      return;
    }

    const leave = await db('employee_leaves').where({ id: leave_id }).first();
    
    if (!leave) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LEAVE_NOT_FOUND',
          message: 'Leave application not found'
        }
      });
      return;
    }

    if (leave.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: {
          code: 'LEAVE_ALREADY_PROCESSED',
          message: `Leave already ${leave.status}`
        }
      });
      return;
    }

    const updateData: any = {
      status,
      reviewed_by: req.user!.id,
      reviewed_at: new Date()
    };

    if (status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason;
    }

    await db('employee_leaves')
      .where({ id: leave_id })
      .update(updateData);

    // Log leave status update
    await auditService.logUpdate(
      req.user!.id,
      'leave_application',
      leave_id,
      { status: leave.status },
      { status, reviewed_by: req.user!.id, reviewed_at: new Date(), rejection_reason },
      req.ip,
      req.get('user-agent')
    );

    // Notify employee
    io.to(`user_${leave.employee_id}`).emit('leave_status_update', {
      type: 'leave_status_update',
      leave_id,
      status,
      rejection_reason,
      from_date: leave.from_date,
      to_date: leave.to_date,
      leave_type: leave.leave_type
    });

    // Send email notification to employee
    await notifyLeaveStatusUpdate(
      leave.employee_id,
      status,
      leave.leave_type,
      leave.from_date,
      leave.to_date,
      rejection_reason
    );

    logger.info(`Leave ${leave_id} ${status} by ${req.user!.id}`);

    res.json({
      success: true,
      message: `Leave ${status} successfully`,
      data: {
        leave_id,
        status,
        reviewed_by: req.user!.id,
        reviewed_at: updateData.reviewed_at
      }
    });
  } catch (error) {
    logger.error('Error updating leave status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update leave status'
      }
    });
  }
};

/**
 * Cancel leave application
 */
export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leave_id } = req.params;

    const leave = await db('employee_leaves').where({ id: leave_id }).first();
    
    if (!leave) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LEAVE_NOT_FOUND',
          message: 'Leave application not found'
        }
      });
      return;
    }

    // Only employee can cancel their own pending leave
    if (leave.employee_id !== req.user!.id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only cancel your own leave applications'
        }
      });
      return;
    }

    if (leave.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Cannot cancel ${leave.status} leave application`
        }
      });
      return;
    }

    await db('employee_leaves')
      .where({ id: leave_id })
      .update({
        status: 'cancelled',
        reviewed_at: new Date()
      });

    logger.info(`Leave cancelled by employee: ${leave_id}`);

    res.json({
      success: true,
      message: 'Leave cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling leave:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel leave'
      }
    });
  }
};

/**
 * Get leave balance for employee
 */
export const getLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employee_id } = req.params;
    const targetEmployeeId = employee_id || req.user!.id;

    // Get employee
    const employee = await db('users').where({ id: targetEmployeeId }).first();
    
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

    // Get current year's leave usage
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const leaves = await db('employee_leaves')
      .where('employee_id', targetEmployeeId)
      .where('status', 'approved')
      .where('from_date', '>=', yearStart)
      .where('to_date', '<=', yearEnd)
      .select('leave_type', db.raw('SUM(number_of_days) as days_used'));

    const leaveByType: any = {};
    leaves.forEach((leave: any) => {
      leaveByType[leave.leave_type] = parseFloat(leave.days_used || 0);
    });

    // Standard leave allocations (can be moved to department config)
    const leaveAllocations = {
      annual: 20,
      sick: 15,
      casual: 10,
      emergency: 5
    };

    const balance = {
      annual: {
        allocated: leaveAllocations.annual,
        used: leaveByType.annual || 0,
        remaining: leaveAllocations.annual - (leaveByType.annual || 0)
      },
      sick: {
        allocated: leaveAllocations.sick,
        used: leaveByType.sick || 0,
        remaining: leaveAllocations.sick - (leaveByType.sick || 0)
      },
      casual: {
        allocated: leaveAllocations.casual,
        used: leaveByType.casual || 0,
        remaining: leaveAllocations.casual - (leaveByType.casual || 0)
      },
      emergency: {
        allocated: leaveAllocations.emergency,
        used: leaveByType.emergency || 0,
        remaining: leaveAllocations.emergency - (leaveByType.emergency || 0)
      },
      unpaid: {
        used: leaveByType.unpaid || 0
      }
    };

    res.json({
      success: true,
      data: {
        employee_id: targetEmployeeId,
        employee_name: employee.name,
        its_id: employee.its_id,
        year: currentYear,
        balance
      }
    });
  } catch (error) {
    logger.error('Error fetching leave balance:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leave balance'
      }
    });
  }
};

/**
 * Get leave statistics
 */
export const getLeaveStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department_id, year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31);

    let query = db('employee_leaves')
      .leftJoin('users', 'employee_leaves.employee_id', 'users.id')
      .where('employee_leaves.from_date', '>=', yearStart)
      .where('employee_leaves.to_date', '<=', yearEnd)
      .where('employee_leaves.status', 'approved');

    if (department_id) {
      query = query.where('users.department_id', department_id as string);
    }

    const leaves = await query.select(
      'employee_leaves.leave_type',
      db.raw('COUNT(*) as count'),
      db.raw('SUM((employee_leaves.to_date - employee_leaves.from_date) + 1) as total_days')
    ).groupBy('employee_leaves.leave_type');

    const stats: any = {
      total_applications: 0,
      total_days: 0,
      by_type: {}
    };

    leaves.forEach((leave: any) => {
      stats.total_applications += parseInt(leave.count);
      stats.total_days += parseFloat(leave.total_days || 0);
      stats.by_type[leave.leave_type] = {
        count: parseInt(leave.count),
        days: parseFloat(leave.total_days || 0)
      };
    });

    res.json({
      success: true,
      data: {
        year: targetYear,
        department_id: department_id || 'all',
        statistics: stats
      }
    });
  } catch (error) {
    logger.error('Error fetching leave statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leave statistics'
      }
    });
  }
};
