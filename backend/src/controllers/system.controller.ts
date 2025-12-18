import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get comprehensive system dashboard
 * Provides overview of all system metrics in one call
 */
export const getSystemDashboard = async (_req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Get total counts
    const [totalEmployees] = await db('users')
      .count('* as count')
      .where('role', '!=', 'admin');

    const [activeEmployees] = await db('users')
      .count('* as count')
      .where('role', '!=', 'admin')
      .where('is_active', true);

    const [totalDepartments] = await db('departments')
      .count('* as count');

    const [totalShifts] = await db('attendance_shifts')
      .count('* as count')
      .where('is_active', true);

    // Today's attendance
    const todayAttendance = await db('attendance_records')
      .select(
        db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present"),
        db.raw("COUNT(CASE WHEN status = 'late' THEN 1 END) as late"),
        db.raw("COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent"),
        db.raw("COUNT(CASE WHEN status = 'leave' THEN 1 END) as on_leave")
      )
      .where('date', today)
      .first();

    // Today's access attempts
    const todayAccess = await db('employee_access_logs')
      .select(
        db.raw('COUNT(*) as total_attempts'),
        db.raw('COUNT(CASE WHEN access_granted = true THEN 1 END) as granted'),
        db.raw('COUNT(CASE WHEN access_granted = false THEN 1 END) as denied')
      )
      .whereRaw('DATE(access_time) = ?', [today])
      .first();

    // Active visitors today
    const [activeVisitors] = await db('visitor_nfc_cards')
      .count('* as count')
      .where('is_active', true)
      .whereRaw('DATE(issued_at) = ?', [today]);

    const todayVisitorAccess = await db('visitor_floor_access_logs as vfal')
      .join('visitor_nfc_cards as vnc', 'vfal.card_id', 'vnc.card_id')
      .count('* as count')
      .whereRaw('DATE(vfal.access_time) = ?', [today])
      .first();

    // Pending leave applications
    const [pendingLeaves] = await db('employee_leaves')
      .count('* as count')
      .where('status', 'pending');

    // This month's leave statistics
    const monthlyLeaves = await db('employee_leaves')
      .select(
        db.raw("COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved"),
        db.raw("COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected"),
        db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending")
      )
      .whereRaw("TO_CHAR(applied_at, 'YYYY-MM') = ?", [thisMonth])
      .first();

    // Upcoming holidays (next 30 days)
    const upcomingHolidays = await db('holidays')
      .count('* as count')
      .whereBetween('holiday_date', [today, db.raw("CURRENT_DATE + INTERVAL '30 days'")])
      .first();

    // Recent access violations (denied in last 24 hours)
    const recentViolations = await db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .join('access_points as ap', 'eal.access_point_id', 'ap.access_point_id')
      .select(
        'u.full_name',
        'ap.access_point_name',
        'ap.floor_number',
        'eal.denial_reason',
        'eal.access_time'
      )
      .where('eal.access_granted', false)
      .where('eal.access_time', '>=', db.raw("NOW() - INTERVAL '24 hours'"))
      .orderBy('eal.access_time', 'desc')
      .limit(10);

    // Department-wise employee count
    const departmentStats = await db('users as u')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select(
        'd.department_name',
        db.raw('COUNT(*) as employee_count'),
        db.raw('COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_count')
      )
      .where('u.role', '!=', 'admin')
      .groupBy('d.department_id', 'd.department_name')
      .orderBy('employee_count', 'desc');

    // Top 5 most accessed floors today
    const topFloors = await db('employee_access_logs as eal')
      .join('access_points as ap', 'eal.access_point_id', 'ap.access_point_id')
      .select(
        'ap.floor_number',
        db.raw('COUNT(*) as access_count')
      )
      .whereRaw('DATE(eal.access_time) = ?', [today])
      .where('eal.access_granted', true)
      .groupBy('ap.floor_number')
      .orderBy('access_count', 'desc')
      .limit(5);

    // System health indicators
    const lastAttendanceCalc = await db('attendance_records')
      .max('date as last_date')
      .first();

    const lastBackup = null; // Implement if you have backup system

    logger.info('System dashboard data retrieved');

    return res.json({
      success: true,
      message: 'System dashboard retrieved successfully',
      data: {
        overview: {
          total_employees: Number(totalEmployees?.count || 0),
          active_employees: Number(activeEmployees?.count || 0),
          total_departments: Number(totalDepartments?.count || 0),
          active_shifts: Number(totalShifts?.count || 0)
        },
        today_attendance: {
          present: Number(todayAttendance?.present || 0),
          late: Number(todayAttendance?.late || 0),
          absent: Number(todayAttendance?.absent || 0),
          on_leave: Number(todayAttendance?.on_leave || 0),
          attendance_percentage: Number(activeEmployees?.count || 0) > 0
            ? parseFloat(((Number(todayAttendance?.present || 0) + Number(todayAttendance?.late || 0)) / Number(activeEmployees?.count || 0) * 100).toFixed(2))
            : 0
        },
        today_access: {
          total_attempts: Number(todayAccess?.total_attempts || 0),
          granted: Number(todayAccess?.granted || 0),
          denied: Number(todayAccess?.denied || 0),
          success_rate: Number(todayAccess?.total_attempts || 0) > 0
            ? parseFloat((Number(todayAccess?.granted || 0) / Number(todayAccess?.total_attempts || 0) * 100).toFixed(2))
            : 0
        },
        visitors: {
          active_today: Number(activeVisitors?.count || 0),
          total_accesses_today: Number(todayVisitorAccess?.count || 0)
        },
        leaves: {
          pending_applications: Number(pendingLeaves?.count || 0),
          this_month: {
            approved: Number(monthlyLeaves?.approved || 0),
            rejected: Number(monthlyLeaves?.rejected || 0),
            pending: Number(monthlyLeaves?.pending || 0)
          }
        },
        holidays: {
          upcoming_count: Number(upcomingHolidays?.count || 0)
        },
        recent_violations: recentViolations.map((v: any) => ({
          employee_name: v.full_name,
          access_point: v.access_point_name,
          floor_number: v.floor_number,
          denial_reason: v.denial_reason,
          time: v.access_time
        })),
        department_distribution: departmentStats.map((d: any) => ({
          department_name: d.department_name,
          total_employees: Number(d.employee_count),
          active_employees: Number(d.active_count)
        })),
        top_accessed_floors: topFloors.map((f: any) => ({
          floor_number: f.floor_number,
          access_count: Number(f.access_count)
        })),
        system_health: {
          last_attendance_calculation: lastAttendanceCalc?.last_date || null,
          last_backup: lastBackup,
          database_status: 'healthy',
          api_status: 'online'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving system dashboard:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_RETRIEVAL_FAILED',
        message: 'Failed to retrieve system dashboard'
      }
    });
  }
};

/**
 * Bulk approve leave applications
 * Admin can approve multiple leaves at once
 */
export const bulkApproveLeaves = async (req: AuthRequest, res: Response) => {
  try {
    const { leave_ids } = req.body;
    const admin_id = req.user?.id;

    if (!leave_ids || !Array.isArray(leave_ids) || leave_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'leave_ids array is required'
        }
      });
    }

    // Update all specified leaves
    const updated = await db('employee_leaves')
      .whereIn('leave_id', leave_ids)
      .where('status', 'pending')
      .update({
        status: 'approved',
        reviewed_by: admin_id,
        reviewed_at: db.fn.now()
      });

    // Get updated leaves with employee info for notifications
    const leaves = await db('employee_leaves as el')
      .join('users as u', 'el.employee_id', 'u.user_id')
      .select('el.leave_id', 'el.employee_id', 'u.full_name', 'el.leave_type', 'el.start_date', 'el.end_date')
      .whereIn('el.leave_id', leave_ids);

    // TODO: Send notifications via Socket.IO to affected employees

    logger.info(`Bulk approved ${updated} leave applications by admin ${admin_id}`);

    return res.json({
      success: true,
      message: `${updated} leave applications approved`,
      data: {
        approved_count: updated,
        leaves
      }
    });
  } catch (error: any) {
    logger.error('Error bulk approving leaves:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'BULK_APPROVE_FAILED',
        message: 'Failed to approve leave applications'
      }
    });
  }
};

/**
 * Bulk reject leave applications
 * Admin can reject multiple leaves at once
 */
export const bulkRejectLeaves = async (req: AuthRequest, res: Response) => {
  try {
    const { leave_ids, review_notes } = req.body;
    const admin_id = req.user?.id;

    if (!leave_ids || !Array.isArray(leave_ids) || leave_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'leave_ids array is required'
        }
      });
    }

    // Update all specified leaves
    const updated = await db('employee_leaves')
      .whereIn('leave_id', leave_ids)
      .where('status', 'pending')
      .update({
        status: 'rejected',
        reviewed_by: admin_id,
        reviewed_at: db.fn.now(),
        review_notes: review_notes || 'Bulk rejected'
      });

    logger.info(`Bulk rejected ${updated} leave applications by admin ${admin_id}`);

    return res.json({
      success: true,
      message: `${updated} leave applications rejected`,
      data: {
        rejected_count: updated
      }
    });
  } catch (error: any) {
    logger.error('Error bulk rejecting leaves:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'BULK_REJECT_FAILED',
        message: 'Failed to reject leave applications'
      }
    });
  }
};

/**
 * Export attendance records to CSV
 * Returns CSV data for specified date range
 */
export const exportAttendanceCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, department_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Fetch attendance records
    let query = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .join('attendance_shifts as s', 'ar.shift_id', 's.shift_id')
      .select(
        'u.full_name',
        'u.email',
        'd.department_name',
        'ar.date',
        's.shift_name',
        'ar.check_in_time',
        'ar.check_out_time',
        'ar.status',
        'ar.work_hours',
        'ar.notes'
      )
      .whereBetween('ar.date', [start_date, end_date])
      .orderBy('ar.date', 'desc')
      .orderBy('u.full_name');

    if (department_id) {
      query = query.where('u.department_id', department_id);
    }

    const records = await query;

    // Generate CSV
    const csvHeader = 'Employee Name,Email,Department,Date,Shift,Check In,Check Out,Status,Work Hours,Notes\n';
    const csvRows = records.map((r: any) => {
      return [
        r.full_name,
        r.email,
        r.department_name,
        r.date,
        r.shift_name,
        r.check_in_time || 'N/A',
        r.check_out_time || 'N/A',
        r.status,
        r.work_hours || '0',
        (r.notes || '').replace(/,/g, ';') // Replace commas in notes
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    logger.info(`Attendance CSV exported for ${start_date} to ${end_date}`);

    // Return CSV as downloadable file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${start_date}_${end_date}.csv`);
    return res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting attendance CSV:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CSV_EXPORT_FAILED',
        message: 'Failed to export attendance data'
      }
    });
  }
};

/**
 * Export access logs to CSV
 * Returns CSV data for specified date range
 */
export const exportAccessLogsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, department_id, access_granted } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Fetch access logs
    let query = db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .join('access_points as ap', 'eal.access_point_id', 'ap.access_point_id')
      .select(
        'u.full_name',
        'u.email',
        'd.department_name',
        'eal.access_time',
        'ap.access_point_name',
        'ap.floor_number',
        'ap.location',
        'eal.access_granted',
        'eal.denial_reason'
      )
      .whereBetween('eal.access_time', [start_date, end_date])
      .orderBy('eal.access_time', 'desc');

    if (department_id) {
      query = query.where('u.department_id', department_id);
    }

    if (access_granted !== undefined) {
      query = query.where('eal.access_granted', access_granted === 'true');
    }

    const logs = await query;

    // Generate CSV
    const csvHeader = 'Employee Name,Email,Department,Access Time,Access Point,Floor,Location,Access Granted,Denial Reason\n';
    const csvRows = logs.map((l: any) => {
      return [
        l.full_name,
        l.email,
        l.department_name,
        l.access_time,
        l.access_point_name,
        l.floor_number,
        l.location,
        l.access_granted ? 'Yes' : 'No',
        (l.denial_reason || 'N/A').replace(/,/g, ';')
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    logger.info(`Access logs CSV exported for ${start_date} to ${end_date}`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=access_logs_${start_date}_${end_date}.csv`);
    return res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting access logs CSV:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CSV_EXPORT_FAILED',
        message: 'Failed to export access logs'
      }
    });
  }
};
