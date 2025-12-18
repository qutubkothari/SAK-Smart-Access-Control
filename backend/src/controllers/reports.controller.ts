import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get department-wise access control report
 * Aggregates employee access logs by department with statistics
 */
export const getDepartmentAccessReport = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, department_id } = req.query;

    // Validate date range
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Base query for department access statistics
    let query = db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select(
        'd.department_id',
        'd.department_name',
        db.raw('COUNT(DISTINCT eal.employee_id) as unique_employees'),
        db.raw('COUNT(*) as total_entries'),
        db.raw('COUNT(DISTINCT DATE(eal.access_time)) as total_days'),
        db.raw('AVG(EXTRACT(HOUR FROM eal.access_time::time)) as avg_entry_hour')
      )
      .whereBetween('eal.access_time', [start_date, end_date])
      .where('eal.access_granted', true)
      .groupBy('d.department_id', 'd.department_name')
      .orderBy('total_entries', 'desc');

    // Filter by department if specified
    if (department_id) {
      query = query.where('d.department_id', department_id);
    }

    const departmentStats = await query;

    // Get floor access distribution for each department
    const floorAccessQuery = db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .join('access_points as ap', 'eal.access_point_id', 'ap.access_point_id')
      .select(
        'u.department_id',
        'ap.floor_number',
        db.raw('COUNT(*) as access_count')
      )
      .whereBetween('eal.access_time', [start_date, end_date])
      .where('eal.access_granted', true)
      .groupBy('u.department_id', 'ap.floor_number');

    if (department_id) {
      floorAccessQuery.where('u.department_id', department_id);
    }

    const floorAccess = await floorAccessQuery;

    // Get peak hours for each department
    const peakHoursQuery = db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .select(
        'u.department_id',
        db.raw('EXTRACT(HOUR FROM eal.access_time::time) as hour'),
        db.raw('COUNT(*) as entry_count')
      )
      .whereBetween('eal.access_time', [start_date, end_date])
      .where('eal.access_granted', true)
      .groupBy('u.department_id', db.raw('EXTRACT(HOUR FROM eal.access_time::time)'))
      .orderBy('entry_count', 'desc');

    if (department_id) {
      peakHoursQuery.where('u.department_id', department_id);
    }

    const peakHours = await peakHoursQuery;

    // Get denied access attempts by department
    const deniedAccessQuery = db('employee_access_logs as eal')
      .join('users as u', 'eal.employee_id', 'u.user_id')
      .select(
        'u.department_id',
        db.raw('COUNT(*) as denied_count')
      )
      .whereBetween('eal.access_time', [start_date, end_date])
      .where('eal.access_granted', false)
      .groupBy('u.department_id');

    if (department_id) {
      deniedAccessQuery.where('u.department_id', department_id);
    }

    const deniedAccess = await deniedAccessQuery;

    // Combine all data
    const report = departmentStats.map((dept: any) => {
      const floors = floorAccess
        .filter((f: any) => f.department_id === dept.department_id)
        .map((f: any) => ({
          floor_number: f.floor_number,
          access_count: parseInt(f.access_count)
        }));

      const hours = peakHours
        .filter((h: any) => h.department_id === dept.department_id)
        .slice(0, 5) // Top 5 peak hours
        .map((h: any) => ({
          hour: parseInt(h.hour),
          entry_count: parseInt(h.entry_count)
        }));

      const denied = deniedAccess.find((d: any) => d.department_id === dept.department_id);

      return {
        department_id: dept.department_id,
        department_name: dept.department_name,
        statistics: {
          unique_employees: parseInt(dept.unique_employees),
          total_entries: parseInt(dept.total_entries),
          total_days: parseInt(dept.total_days),
          avg_entries_per_day: parseFloat((dept.total_entries / dept.total_days).toFixed(2)),
          avg_entry_hour: parseFloat(parseFloat(dept.avg_entry_hour).toFixed(1)),
          denied_attempts: denied ? parseInt(denied.denied_count) : 0
        },
        floor_distribution: floors,
        peak_hours: hours
      };
    });

    logger.info(`📊 Department access report generated for ${start_date} to ${end_date}`);

    return res.json({
      success: true,
      message: 'Department access report generated successfully',
      data: {
        date_range: { start_date, end_date },
        departments: report,
        summary: {
          total_departments: report.length,
          total_entries: report.reduce((sum: number, d: any) => sum + d.statistics.total_entries, 0),
          total_denied: report.reduce((sum: number, d: any) => sum + d.statistics.denied_attempts, 0)
        }
      }
    });
  } catch (error: any) {
    logger.error('Error generating department access report:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate department access report'
      }
    });
  }
};

/**
 * Get visitor access report
 * Aggregates visitor access logs with statistics
 */
export const getVisitorAccessReport = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, host_id } = req.query;

    // Validate date range
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Get visitor statistics
    let visitorQuery = db('visitor_nfc_cards as vnc')
      .join('visitor_floor_access_logs as vfal', 'vnc.card_id', 'vfal.card_id')
      .join('users as host', 'vnc.host_id', 'host.user_id')
      .select(
        'vnc.visitor_name',
        'vnc.visitor_company',
        'vnc.visitor_phone',
        'host.full_name as host_name',
        'host.department_id',
        db.raw('COUNT(*) as total_accesses'),
        db.raw('MIN(vfal.access_time) as first_access'),
        db.raw('MAX(vfal.access_time) as last_access')
      )
      .whereBetween('vfal.access_time', [start_date, end_date])
      .where('vnc.is_active', true)
      .groupBy('vnc.card_id', 'vnc.visitor_name', 'vnc.visitor_company', 'vnc.visitor_phone', 'host.full_name', 'host.department_id')
      .orderBy('total_accesses', 'desc');

    if (host_id) {
      visitorQuery = visitorQuery.where('vnc.host_id', host_id);
    }

    const visitors = await visitorQuery;

    // Get floor access distribution for visitors
    const floorAccessQuery = db('visitor_floor_access_logs as vfal')
      .join('visitor_nfc_cards as vnc', 'vfal.card_id', 'vnc.card_id')
      .select(
        'vfal.floor_number',
        db.raw('COUNT(*) as access_count'),
        db.raw('COUNT(DISTINCT vnc.card_id) as unique_visitors')
      )
      .whereBetween('vfal.access_time', [start_date, end_date])
      .groupBy('vfal.floor_number')
      .orderBy('access_count', 'desc');

    if (host_id) {
      floorAccessQuery.where('vnc.host_id', host_id);
    }

    const floorAccess = await floorAccessQuery;

    // Get host-wise visitor statistics
    const hostStatsQuery = db('visitor_nfc_cards as vnc')
      .join('visitor_floor_access_logs as vfal', 'vnc.card_id', 'vfal.card_id')
      .join('users as host', 'vnc.host_id', 'host.user_id')
      .join('departments as d', 'host.department_id', 'd.department_id')
      .select(
        'host.user_id as host_id',
        'host.full_name as host_name',
        'd.department_name',
        db.raw('COUNT(DISTINCT vnc.card_id) as unique_visitors'),
        db.raw('COUNT(*) as total_accesses')
      )
      .whereBetween('vfal.access_time', [start_date, end_date])
      .groupBy('host.user_id', 'host.full_name', 'd.department_name')
      .orderBy('total_accesses', 'desc');

    if (host_id) {
      hostStatsQuery.where('host.user_id', host_id);
    }

    const hostStats = await hostStatsQuery;

    // Get daily visitor trend
    const dailyTrendQuery = db('visitor_floor_access_logs as vfal')
      .join('visitor_nfc_cards as vnc', 'vfal.card_id', 'vnc.card_id')
      .select(
        db.raw('DATE(vfal.access_time) as date'),
        db.raw('COUNT(DISTINCT vnc.card_id) as unique_visitors'),
        db.raw('COUNT(*) as total_accesses')
      )
      .whereBetween('vfal.access_time', [start_date, end_date])
      .groupBy(db.raw('DATE(vfal.access_time)'))
      .orderBy('date', 'asc');

    if (host_id) {
      dailyTrendQuery.where('vnc.host_id', host_id);
    }

    const dailyTrend = await dailyTrendQuery;

    logger.info(`📊 Visitor access report generated for ${start_date} to ${end_date}`);

    return res.json({
      success: true,
      message: 'Visitor access report generated successfully',
      data: {
        date_range: { start_date, end_date },
        visitors: visitors.map((v: any) => ({
          visitor_name: v.visitor_name,
          visitor_company: v.visitor_company,
          visitor_phone: v.visitor_phone,
          host_name: v.host_name,
          total_accesses: parseInt(v.total_accesses),
          first_access: v.first_access,
          last_access: v.last_access
        })),
        floor_distribution: floorAccess.map((f: any) => ({
          floor_number: f.floor_number,
          access_count: parseInt(f.access_count),
          unique_visitors: parseInt(f.unique_visitors)
        })),
        host_statistics: hostStats.map((h: any) => ({
          host_id: h.host_id,
          host_name: h.host_name,
          department_name: h.department_name,
          unique_visitors: parseInt(h.unique_visitors),
          total_accesses: parseInt(h.total_accesses)
        })),
        daily_trend: dailyTrend.map((d: any) => ({
          date: d.date,
          unique_visitors: parseInt(d.unique_visitors),
          total_accesses: parseInt(d.total_accesses)
        })),
        summary: {
          total_visitors: visitors.length,
          total_accesses: visitors.reduce((sum: number, v: any) => sum + parseInt(v.total_accesses), 0),
          avg_accesses_per_visitor: visitors.length > 0 
            ? parseFloat((visitors.reduce((sum: number, v: any) => sum + parseInt(v.total_accesses), 0) / visitors.length).toFixed(2))
            : 0
        }
      }
    });
  } catch (error: any) {
    logger.error('Error generating visitor access report:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate visitor access report'
      }
    });
  }
};

/**
 * Get attendance dashboard data
 * Provides comprehensive attendance analytics with charts data
 */
export const getAttendanceDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, department_id } = req.query;

    // Validate date range
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Overall attendance statistics
    let overallQuery = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .select(
        db.raw('COUNT(DISTINCT ar.employee_id) as total_employees'),
        db.raw('COUNT(*) as total_records'),
        db.raw("COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'half_day' THEN 1 END) as half_day_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'leave' THEN 1 END) as leave_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'weekend' THEN 1 END) as weekend_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'holiday' THEN 1 END) as holiday_count"),
        db.raw('AVG(ar.work_hours) as avg_work_hours')
      )
      .whereBetween('ar.date', [start_date, end_date]);

    if (department_id) {
      overallQuery = overallQuery.where('u.department_id', department_id);
    }

    const [overallStats] = await overallQuery;

    // Department-wise attendance statistics
    let deptQuery = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select(
        'd.department_id',
        'd.department_name',
        db.raw('COUNT(DISTINCT ar.employee_id) as employee_count'),
        db.raw("COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count"),
        db.raw("COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count"),
        db.raw('AVG(ar.work_hours) as avg_work_hours'),
        db.raw('COUNT(*) as total_records')
      )
      .whereBetween('ar.date', [start_date, end_date])
      .groupBy('d.department_id', 'd.department_name')
      .orderBy('d.department_name');

    if (department_id) {
      deptQuery = deptQuery.where('d.department_id', department_id);
    }

    const deptStats = await deptQuery;

    // Daily attendance trend
    let dailyTrendQuery = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .select(
        'ar.date',
        db.raw("COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present"),
        db.raw("COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late"),
        db.raw("COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent"),
        db.raw("COUNT(CASE WHEN ar.status = 'half_day' THEN 1 END) as half_day"),
        db.raw("COUNT(CASE WHEN ar.status = 'leave' THEN 1 END) as leave")
      )
      .whereBetween('ar.date', [start_date, end_date])
      .groupBy('ar.date')
      .orderBy('ar.date', 'asc');

    if (department_id) {
      dailyTrendQuery = dailyTrendQuery.where('u.department_id', department_id);
    }

    const dailyTrend = await dailyTrendQuery;

    // Late arrival distribution by hour
    let lateArrivalQuery = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .select(
        db.raw('EXTRACT(HOUR FROM ar.check_in_time::time) as hour'),
        db.raw('COUNT(*) as count')
      )
      .whereBetween('ar.date', [start_date, end_date])
      .where('ar.status', 'late')
      .groupBy(db.raw('EXTRACT(HOUR FROM ar.check_in_time::time)'))
      .orderBy('hour');

    if (department_id) {
      lateArrivalQuery = lateArrivalQuery.where('u.department_id', department_id);
    }

    const lateArrivals = await lateArrivalQuery;

    // Top performers (highest attendance percentage)
    let topPerformersQuery = db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select(
        'u.user_id',
        'u.full_name',
        'd.department_name',
        db.raw('COUNT(*) as total_days'),
        db.raw("COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END) as present_days"),
        db.raw("ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2) as attendance_percentage"),
        db.raw('AVG(ar.work_hours) as avg_work_hours')
      )
      .whereBetween('ar.date', [start_date, end_date])
      .whereNotIn('ar.status', ['weekend', 'holiday'])
      .groupBy('u.user_id', 'u.full_name', 'd.department_name')
      .orderBy('attendance_percentage', 'desc')
      .limit(10);

    if (department_id) {
      topPerformersQuery = topPerformersQuery.where('u.department_id', department_id);
    }

    const topPerformers = await topPerformersQuery;

    // Calculate attendance percentages
    const totalWorkingDays = parseInt(overallStats.total_records) - 
                            parseInt(overallStats.weekend_count) - 
                            parseInt(overallStats.holiday_count);
    
    const attendancePercentage = totalWorkingDays > 0 
      ? parseFloat(((parseInt(overallStats.present_count) + parseInt(overallStats.late_count)) / totalWorkingDays * 100).toFixed(2))
      : 0;

    logger.info(`📊 Attendance dashboard generated for ${start_date} to ${end_date}`);

    return res.json({
      success: true,
      message: 'Attendance dashboard data retrieved successfully',
      data: {
        date_range: { start_date, end_date },
        overall_statistics: {
          total_employees: parseInt(overallStats.total_employees),
          total_records: parseInt(overallStats.total_records),
          present_count: parseInt(overallStats.present_count),
          late_count: parseInt(overallStats.late_count),
          absent_count: parseInt(overallStats.absent_count),
          half_day_count: parseInt(overallStats.half_day_count),
          leave_count: parseInt(overallStats.leave_count),
          weekend_count: parseInt(overallStats.weekend_count),
          holiday_count: parseInt(overallStats.holiday_count),
          avg_work_hours: parseFloat(parseFloat(overallStats.avg_work_hours || 0).toFixed(2)),
          attendance_percentage: attendancePercentage
        },
        department_statistics: deptStats.map((d: any) => ({
          department_id: d.department_id,
          department_name: d.department_name,
          employee_count: parseInt(d.employee_count),
          present_count: parseInt(d.present_count),
          late_count: parseInt(d.late_count),
          absent_count: parseInt(d.absent_count),
          avg_work_hours: parseFloat(parseFloat(d.avg_work_hours || 0).toFixed(2)),
          attendance_percentage: parseInt(d.total_records) > 0
            ? parseFloat(((parseInt(d.present_count) + parseInt(d.late_count)) / parseInt(d.total_records) * 100).toFixed(2))
            : 0
        })),
        daily_trend: dailyTrend.map((d: any) => ({
          date: d.date,
          present: parseInt(d.present),
          late: parseInt(d.late),
          absent: parseInt(d.absent),
          half_day: parseInt(d.half_day),
          leave: parseInt(d.leave)
        })),
        late_arrival_distribution: lateArrivals.map((l: any) => ({
          hour: parseInt(l.hour),
          count: parseInt(l.count)
        })),
        top_performers: topPerformers.map((t: any) => ({
          user_id: t.user_id,
          full_name: t.full_name,
          department_name: t.department_name,
          total_days: parseInt(t.total_days),
          present_days: parseInt(t.present_days),
          attendance_percentage: parseFloat(t.attendance_percentage),
          avg_work_hours: parseFloat(parseFloat(t.avg_work_hours || 0).toFixed(2))
        }))
      }
    });
  } catch (error: any) {
    logger.error('Error generating attendance dashboard:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_GENERATION_FAILED',
        message: 'Failed to generate attendance dashboard'
      }
    });
  }
};
