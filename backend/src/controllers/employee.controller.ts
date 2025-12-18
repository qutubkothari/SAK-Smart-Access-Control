import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get employee's own attendance records
 * Employees can view their attendance history
 */
export const getMyAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;
    const { start_date, end_date, status } = req.query;

    // Build query
    let query = db('attendance_records as ar')
      .join('attendance_shifts as s', 'ar.shift_id', 's.shift_id')
      .select(
        'ar.record_id',
        'ar.date',
        'ar.check_in_time',
        'ar.check_out_time',
        'ar.status',
        'ar.work_hours',
        'ar.notes',
        's.shift_name',
        's.start_time',
        's.end_time'
      )
      .where('ar.employee_id', employee_id)
      .orderBy('ar.date', 'desc');

    // Apply filters
    if (start_date && end_date) {
      query = query.whereBetween('ar.date', [start_date, end_date]);
    }

    if (status) {
      query = query.where('ar.status', status);
    }

    const records = await query;

    // Calculate summary statistics
    const summary = await db('attendance_records')
      .select(
        db.raw('COUNT(*) as total_days'),
        db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days"),
        db.raw("COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days"),
        db.raw("COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days"),
        db.raw("COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_days"),
        db.raw("COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave_days"),
        db.raw('AVG(work_hours) as avg_work_hours')
      )
      .where('employee_id', employee_id)
      .modify((queryBuilder) => {
        if (start_date && end_date) {
          queryBuilder.whereBetween('date', [start_date, end_date]);
        }
      })
      .first();

    logger.info(`Employee ${employee_id} retrieved their attendance records`);

    return res.json({
      success: true,
      message: 'Attendance records retrieved successfully',
      data: {
        records: records.map((r: any) => ({
          record_id: r.record_id,
          date: r.date,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          status: r.status,
          work_hours: parseFloat(r.work_hours || 0),
          notes: r.notes,
          shift: {
            name: r.shift_name,
            start_time: r.start_time,
            end_time: r.end_time
          }
        })),
        summary: {
          total_days: parseInt(summary?.total_days || 0),
          present_days: parseInt(summary?.present_days || 0),
          late_days: parseInt(summary?.late_days || 0),
          absent_days: parseInt(summary?.absent_days || 0),
          half_days: parseInt(summary?.half_days || 0),
          leave_days: parseInt(summary?.leave_days || 0),
          avg_work_hours: parseFloat(parseFloat(summary?.avg_work_hours || 0).toFixed(2)),
          attendance_percentage: parseInt(summary?.total_days || 0) > 0
            ? parseFloat(((parseInt(summary?.present_days || 0) + parseInt(summary?.late_days || 0)) / parseInt(summary?.total_days || 0) * 100).toFixed(2))
            : 0
        }
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving employee attendance:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ATTENDANCE_RETRIEVAL_FAILED',
        message: 'Failed to retrieve attendance records'
      }
    });
  }
};

/**
 * Get employee's own access logs
 * Employees can view their building/floor access history
 */
export const getMyAccessLogs = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;
    const { start_date, end_date, floor_number, access_granted } = req.query;

    // Build query
    let query = db('employee_access_logs as eal')
      .join('access_points as ap', 'eal.access_point_id', 'ap.access_point_id')
      .select(
        'eal.log_id',
        'eal.access_time',
        'eal.access_granted',
        'eal.denial_reason',
        'ap.access_point_name',
        'ap.floor_number',
        'ap.location'
      )
      .where('eal.employee_id', employee_id)
      .orderBy('eal.access_time', 'desc')
      .limit(100);

    // Apply filters
    if (start_date && end_date) {
      query = query.whereBetween('eal.access_time', [start_date, end_date]);
    }

    if (floor_number) {
      query = query.where('ap.floor_number', floor_number);
    }

    if (access_granted !== undefined) {
      query = query.where('eal.access_granted', access_granted === 'true');
    }

    const logs = await query;

    // Get summary statistics
    const summary = await db('employee_access_logs')
      .select(
        db.raw('COUNT(*) as total_attempts'),
        db.raw('COUNT(CASE WHEN access_granted = true THEN 1 END) as granted_count'),
        db.raw('COUNT(CASE WHEN access_granted = false THEN 1 END) as denied_count')
      )
      .where('employee_id', employee_id)
      .modify((queryBuilder) => {
        if (start_date && end_date) {
          queryBuilder.whereBetween('access_time', [start_date, end_date]);
        }
      })
      .first();

    logger.info(`Employee ${employee_id} retrieved their access logs`);

    return res.json({
      success: true,
      message: 'Access logs retrieved successfully',
      data: {
        logs: logs.map((l: any) => ({
          log_id: l.log_id,
          access_time: l.access_time,
          access_granted: l.access_granted,
          denial_reason: l.denial_reason,
          access_point: {
            name: l.access_point_name,
            floor_number: l.floor_number,
            location: l.location
          }
        })),
        summary: {
          total_attempts: parseInt(summary?.total_attempts || 0),
          granted_count: parseInt(summary?.granted_count || 0),
          denied_count: parseInt(summary?.denied_count || 0)
        }
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving employee access logs:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ACCESS_LOGS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve access logs'
      }
    });
  }
};

/**
 * Get employee's own leave applications
 * Employees can view their leave history and status
 */
export const getMyLeaves = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;
    const { status, leave_type } = req.query;

    // Build query
    let query = db('employee_leaves as el')
      .leftJoin('users as reviewer', 'el.reviewed_by', 'reviewer.user_id')
      .select(
        'el.leave_id',
        'el.leave_type',
        'el.start_date',
        'el.end_date',
        'el.half_day',
        'el.reason',
        'el.status',
        'el.applied_at',
        'el.reviewed_at',
        'reviewer.full_name as reviewed_by_name',
        'el.review_notes'
      )
      .where('el.employee_id', employee_id)
      .orderBy('el.applied_at', 'desc');

    // Apply filters
    if (status) {
      query = query.where('el.status', status);
    }

    if (leave_type) {
      query = query.where('el.leave_type', leave_type);
    }

    const leaves = await query;

    // Get leave balance
    const currentYear = new Date().getFullYear();
    const usedLeaves = await db('employee_leaves')
      .select(
        'leave_type',
        db.raw('SUM(CASE WHEN half_day THEN 0.5 ELSE (end_date::date - start_date::date + 1) END) as used_days')
      )
      .where('employee_id', employee_id)
      .where('status', 'approved')
      .whereRaw('EXTRACT(YEAR FROM start_date) = ?', [currentYear])
      .groupBy('leave_type');

    const leaveAllocations = {
      annual: 20,
      sick: 15,
      casual: 10,
      emergency: 5
    };

    const balance = Object.entries(leaveAllocations).map(([type, allocated]) => {
      const used = usedLeaves.find((l: any) => l.leave_type === type);
      return {
        leave_type: type,
        allocated,
        used: parseFloat(used?.used_days || 0),
        remaining: allocated - parseFloat(used?.used_days || 0)
      };
    });

    logger.info(`Employee ${employee_id} retrieved their leave records`);

    return res.json({
      success: true,
      message: 'Leave records retrieved successfully',
      data: {
        leaves: leaves.map((l: any) => ({
          leave_id: l.leave_id,
          leave_type: l.leave_type,
          start_date: l.start_date,
          end_date: l.end_date,
          half_day: l.half_day,
          reason: l.reason,
          status: l.status,
          applied_at: l.applied_at,
          reviewed_at: l.reviewed_at,
          reviewed_by: l.reviewed_by_name,
          review_notes: l.review_notes
        })),
        balance
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving employee leaves:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LEAVES_RETRIEVAL_FAILED',
        message: 'Failed to retrieve leave records'
      }
    });
  }
};

/**
 * Get employee's current shift assignment
 * Employees can view their assigned shift details
 */
export const getMyShift = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;

    // Get current active shift
    const currentShift = await db('employee_shifts as es')
      .join('attendance_shifts as s', 'es.shift_id', 's.shift_id')
      .leftJoin('users as assigned_by_user', 'es.assigned_by', 'assigned_by_user.user_id')
      .select(
        'es.assignment_id',
        'es.effective_from',
        'es.effective_until',
        's.shift_id',
        's.shift_name',
        's.start_time',
        's.end_time',
        's.grace_period_minutes',
        's.break_duration_minutes',
        'assigned_by_user.full_name as assigned_by_name',
        'es.assigned_at'
      )
      .where('es.employee_id', employee_id)
      .where('es.is_active', true)
      .where('es.effective_from', '<=', db.fn.now())
      .where(function() {
        this.whereNull('es.effective_until').orWhere('es.effective_until', '>=', db.fn.now());
      })
      .first();

    if (!currentShift) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_SHIFT_ASSIGNED',
          message: 'No active shift assigned'
        }
      });
    }

    // Get shift history
    const shiftHistory = await db('employee_shifts as es')
      .join('attendance_shifts as s', 'es.shift_id', 's.shift_id')
      .leftJoin('users as assigned_by_user', 'es.assigned_by', 'assigned_by_user.user_id')
      .select(
        'es.assignment_id',
        'es.effective_from',
        'es.effective_until',
        's.shift_name',
        's.start_time',
        's.end_time',
        'assigned_by_user.full_name as assigned_by_name',
        'es.assigned_at'
      )
      .where('es.employee_id', employee_id)
      .orderBy('es.assigned_at', 'desc')
      .limit(5);

    logger.info(`Employee ${employee_id} retrieved their shift information`);

    return res.json({
      success: true,
      message: 'Shift information retrieved successfully',
      data: {
        current_shift: {
          assignment_id: currentShift.assignment_id,
          effective_from: currentShift.effective_from,
          effective_until: currentShift.effective_until,
          shift: {
            shift_id: currentShift.shift_id,
            shift_name: currentShift.shift_name,
            start_time: currentShift.start_time,
            end_time: currentShift.end_time,
            grace_period_minutes: currentShift.grace_period_minutes,
            break_duration_minutes: currentShift.break_duration_minutes
          },
          assigned_by: currentShift.assigned_by_name,
          assigned_at: currentShift.assigned_at
        },
        history: shiftHistory.map((h: any) => ({
          assignment_id: h.assignment_id,
          effective_from: h.effective_from,
          effective_until: h.effective_until,
          shift_name: h.shift_name,
          start_time: h.start_time,
          end_time: h.end_time,
          assigned_by: h.assigned_by_name,
          assigned_at: h.assigned_at
        }))
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving employee shift:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SHIFT_RETRIEVAL_FAILED',
        message: 'Failed to retrieve shift information'
      }
    });
  }
};

/**
 * Get employee's profile with department info
 * Employees can view their complete profile
 */
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;

    // Get employee profile
    const profile = await db('users as u')
      .leftJoin('departments as d', 'u.department_id', 'd.department_id')
      .select(
        'u.user_id',
        'u.full_name',
        'u.email',
        'u.phone',
        'u.role',
        'u.nfc_card_id',
        'u.is_active',
        'u.created_at',
        'd.department_id',
        'd.department_name',
        'd.description as department_description'
      )
      .where('u.user_id', employee_id)
      .first();

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Employee profile not found'
        }
      });
    }

    // Get floor permissions
    const floorPermissions = await db('employee_floor_permissions as efp')
      .join('access_points as ap', 'efp.floor_number', 'ap.floor_number')
      .select('efp.floor_number')
      .where('efp.employee_id', employee_id)
      .where('efp.is_active', true)
      .distinct('efp.floor_number')
      .orderBy('efp.floor_number');

    // Get time restrictions
    const timeRestrictions = await db('employee_time_restrictions')
      .select('restriction_id', 'day_of_week', 'start_time', 'end_time')
      .where('employee_id', employee_id)
      .where('is_active', true)
      .orderBy('day_of_week');

    logger.info(`Employee ${employee_id} retrieved their profile`);

    return res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        nfc_card_id: profile.nfc_card_id,
        is_active: profile.is_active,
        created_at: profile.created_at,
        department: profile.department_id ? {
          department_id: profile.department_id,
          department_name: profile.department_name,
          description: profile.department_description
        } : null,
        floor_permissions: floorPermissions.map((f: any) => f.floor_number),
        time_restrictions: timeRestrictions.map((t: any) => ({
          restriction_id: t.restriction_id,
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time
        }))
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving employee profile:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_RETRIEVAL_FAILED',
        message: 'Failed to retrieve profile'
      }
    });
  }
};

/**
 * Get upcoming holidays
 * Employees can view company and department holidays
 */
export const getMyHolidays = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user?.id;

    // Get employee's department
    const employee = await db('users')
      .select('department_id')
      .where('user_id', employee_id)
      .first();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee not found'
        }
      });
    }

    // Get holidays (company-wide + department-specific + optional)
    const holidays = await db('holidays as h')
      .leftJoin('departments as d', 'h.department_id', 'd.department_id')
      .select(
        'h.holiday_id',
        'h.holiday_name',
        'h.holiday_date',
        'h.is_optional',
        'd.department_name'
      )
      .where('h.holiday_date', '>=', db.fn.now())
      .where(function() {
        this.whereNull('h.department_id')
          .orWhere('h.department_id', employee.department_id);
      })
      .orderBy('h.holiday_date', 'asc');

    logger.info(`Employee ${employee_id} retrieved holidays`);

    return res.json({
      success: true,
      message: 'Holidays retrieved successfully',
      data: holidays.map((h: any) => ({
        holiday_id: h.holiday_id,
        holiday_name: h.holiday_name,
        holiday_date: h.holiday_date,
        is_optional: h.is_optional,
        department_specific: h.department_name ? true : false,
        department_name: h.department_name
      }))
    });
  } catch (error: any) {
    logger.error('Error retrieving holidays:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'HOLIDAYS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve holidays'
      }
    });
  }
};
