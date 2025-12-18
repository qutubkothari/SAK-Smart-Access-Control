import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get comprehensive system analytics
 */
export const getSystemAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30', start_date, end_date } = req.query;

    // Calculate date range
    let startDate: Date;
    let endDate: Date = new Date();

    if (start_date && end_date) {
      startDate = new Date(start_date as string);
      endDate = new Date(end_date as string);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period as string));
    }

    // System overview metrics
    const [totalUsers] = await db('users').where('is_active', true).count('* as count');
    const [totalMeetings] = await db('meetings').count('* as count');
    const [totalVisitors] = await db('visitors').count('* as count');
    const [activeMeetings] = await db('meetings')
      .where('status', 'scheduled')
      .where('meeting_time', '>=', new Date())
      .count('* as count');

    // Daily trends for the period
    const dailyTrends = await db('meetings')
      .select(
        db.raw("DATE(meeting_time) as date"),
        db.raw('COUNT(*) as meeting_count')
      )
      .whereBetween('meeting_time', [startDate, endDate])
      .groupBy(db.raw("DATE(meeting_time)"))
      .orderBy('date');

    const dailyVisitors = await db('visitors')
      .select(
        db.raw("DATE(created_at) as date"),
        db.raw('COUNT(*) as visitor_count')
      )
      .whereBetween('created_at', [startDate, endDate])
      .groupBy(db.raw("DATE(created_at)"))
      .orderBy('date');

    // Check-in statistics
    const checkInStats = await db('visitors')
      .select(
        db.raw("COUNT(*) as total"),
        db.raw("COUNT(CASE WHEN check_in_time IS NOT NULL THEN 1 END) as checked_in"),
        db.raw("COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as checked_out"),
        db.raw("COUNT(CASE WHEN check_in_time IS NULL AND meeting_time < NOW() THEN 1 END) as no_show")
      )
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, endDate])
      .first();

    // Top departments by visitor count
    const topDepartments = await db('meetings')
      .select(
        'departments.name as department_name',
        db.raw('COUNT(DISTINCT visitors.id) as visitor_count'),
        db.raw('COUNT(DISTINCT meetings.id) as meeting_count')
      )
      .join('users', 'meetings.host_id', 'users.id')
      .join('departments', 'users.department_id', 'departments.id')
      .join('visitors', 'meetings.id', 'visitors.meeting_id')
      .whereBetween('meetings.meeting_time', [startDate, endDate])
      .groupBy('departments.id', 'departments.name')
      .orderBy('visitor_count', 'desc')
      .limit(10);

    // Peak hours analysis
    const peakHours = await db('meetings')
      .select(
        db.raw("EXTRACT(HOUR FROM meeting_time) as hour"),
        db.raw('COUNT(*) as count')
      )
      .whereBetween('meeting_time', [startDate, endDate])
      .groupBy(db.raw("EXTRACT(HOUR FROM meeting_time)"))
      .orderBy('count', 'desc');

    // Meeting status distribution
    const meetingStatus = await db('meetings')
      .select('status')
      .count('* as count')
      .whereBetween('meeting_time', [startDate, endDate])
      .groupBy('status');

    logger.info(`System analytics retrieved by ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        period: {
          start: startDate,
          end: endDate,
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        overview: {
          total_users: parseInt((totalUsers as any).count),
          total_meetings: parseInt((totalMeetings as any).count),
          total_visitors: parseInt((totalVisitors as any).count),
          active_meetings: parseInt((activeMeetings as any).count)
        },
        check_in_stats: {
          total: parseInt((checkInStats as any)?.total || '0'),
          checked_in: parseInt((checkInStats as any)?.checked_in || '0'),
          checked_out: parseInt((checkInStats as any)?.checked_out || '0'),
          no_show: parseInt((checkInStats as any)?.no_show || '0'),
          check_in_rate: (checkInStats as any)?.total > 0 
            ? Math.round(((checkInStats as any).checked_in / (checkInStats as any).total) * 100) 
            : 0
        },
        daily_trends: dailyTrends.map((d: any) => ({
          date: d.date,
          meetings: parseInt(d.meeting_count)
        })),
        daily_visitors: dailyVisitors.map((d: any) => ({
          date: d.date,
          visitors: parseInt(d.visitor_count)
        })),
        top_departments: topDepartments.map((d: any) => ({
          department: d.department_name,
          visitors: parseInt(d.visitor_count),
          meetings: parseInt(d.meeting_count)
        })),
        peak_hours: peakHours.map((h: any) => ({
          hour: parseInt(h.hour),
          count: parseInt(h.count)
        })),
        meeting_status: meetingStatus.map((s: any) => ({
          status: s.status,
          count: parseInt(s.count)
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching system analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch system analytics'
      }
    });
  }
};

/**
 * Get visitor analytics and patterns
 */
export const getVisitorAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30' } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period as string));

    // Top visitors by visit count
    const topVisitors = await db('visitors')
      .select(
        'visitors.email',
        'visitors.name',
        'visitors.company',
        db.raw('COUNT(*) as visit_count'),
        db.raw('MAX(meetings.meeting_time) as last_visit')
      )
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .groupBy('visitors.email', 'visitors.name', 'visitors.company')
      .orderBy('visit_count', 'desc')
      .limit(20);

    // Top companies
    const topCompanies = await db('visitors')
      .select(
        'visitors.company',
        db.raw('COUNT(DISTINCT visitors.email) as unique_visitors'),
        db.raw('COUNT(*) as total_visits')
      )
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .whereNotNull('visitors.company')
      .groupBy('visitors.company')
      .orderBy('total_visits', 'desc')
      .limit(10);

    // Visitor type distribution
    const visitorTypes = await db('visitors')
      .select('visitor_type')
      .count('* as count')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .groupBy('visitor_type');

    // Average visit duration
    const visitDuration = await db('visitors')
      .select(
        db.raw("AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 60) as avg_duration_minutes")
      )
      .whereNotNull('check_in_time')
      .whereNotNull('check_out_time')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .first();

    // Geographic distribution (by city)
    const geography = await db('visitors')
      .select(
        'visitors.city',
        db.raw('COUNT(DISTINCT visitors.email) as visitor_count')
      )
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .whereNotNull('visitors.city')
      .groupBy('visitors.city')
      .orderBy('visitor_count', 'desc')
      .limit(10);

    logger.info(`Visitor analytics retrieved by ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        period_days: parseInt(period as string),
        top_visitors: topVisitors.map((v: any) => ({
          email: v.email,
          name: v.name,
          company: v.company,
          visit_count: parseInt(v.visit_count),
          last_visit: v.last_visit
        })),
        top_companies: topCompanies.map((c: any) => ({
          company: c.company,
          unique_visitors: parseInt(c.unique_visitors),
          total_visits: parseInt(c.total_visits)
        })),
        visitor_types: visitorTypes.map((t: any) => ({
          type: t.visitor_type,
          count: parseInt(t.count)
        })),
        avg_visit_duration_minutes: Math.round(parseFloat((visitDuration as any)?.avg_duration_minutes || '0')),
        geography: geography.map((g: any) => ({
          city: g.city,
          visitors: parseInt(g.visitor_count)
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching visitor analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch visitor analytics'
      }
    });
  }
};

/**
 * Get attendance analytics
 */
export const getAttendanceAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30', department_id } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period as string));

    let baseQuery = db('attendance_records')
      .whereBetween('date', [startDate, new Date()]);

    if (department_id) {
      baseQuery = baseQuery
        .join('users', 'attendance_records.employee_id', 'users.id')
        .where('users.department_id', department_id as string);
    }

    // Overall attendance statistics
    const overallStats = await baseQuery.clone()
      .select(
        db.raw('COUNT(*) as total_records'),
        db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count"),
        db.raw("COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count"),
        db.raw("COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count"),
        db.raw("COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_day_count"),
        db.raw("COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave_count"),
        db.raw("AVG(work_hours) as avg_work_hours")
      )
      .first();

    // Daily attendance trends
    const dailyTrends = await baseQuery.clone()
      .select(
        db.raw("DATE(date) as date"),
        db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present"),
        db.raw("COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent"),
        db.raw("COUNT(CASE WHEN status = 'late' THEN 1 END) as late")
      )
      .groupBy(db.raw("DATE(date)"))
      .orderBy('date');

    // Department-wise attendance (if not filtered)
    let departmentStats: any[] = [];
    if (!department_id) {
      departmentStats = await db('attendance_records')
        .select(
          'departments.name as department_name',
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN status = 'present' THEN 1 END) as present"),
          db.raw("ROUND(COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / COUNT(*), 2) as attendance_rate")
        )
        .join('users', 'attendance_records.employee_id', 'users.id')
        .join('departments', 'users.department_id', 'departments.id')
        .whereBetween('attendance_records.date', [startDate, new Date()])
        .groupBy('departments.id', 'departments.name')
        .orderBy('attendance_rate', 'desc');
    }

    // Late arrivals by hour
    const latePatterns = await baseQuery.clone()
      .select(
        db.raw("EXTRACT(HOUR FROM first_check_in) as hour"),
        db.raw('COUNT(*) as count')
      )
      .where('status', 'late')
      .whereNotNull('first_check_in')
      .groupBy(db.raw("EXTRACT(HOUR FROM first_check_in)"))
      .orderBy('count', 'desc')
      .limit(10);

    const attendanceRate = (overallStats as any)?.total_records > 0
      ? Math.round(((overallStats as any).present_count / (overallStats as any).total_records) * 100)
      : 0;

    logger.info(`Attendance analytics retrieved by ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        period_days: parseInt(period as string),
        overall: {
          total_records: parseInt((overallStats as any)?.total_records || '0'),
          present: parseInt((overallStats as any)?.present_count || '0'),
          absent: parseInt((overallStats as any)?.absent_count || '0'),
          late: parseInt((overallStats as any)?.late_count || '0'),
          half_day: parseInt((overallStats as any)?.half_day_count || '0'),
          leave: parseInt((overallStats as any)?.leave_count || '0'),
          attendance_rate: attendanceRate,
          avg_work_hours: parseFloat(parseFloat((overallStats as any)?.avg_work_hours || '0').toFixed(2))
        },
        daily_trends: dailyTrends.map((d: any) => ({
          date: d.date,
          present: parseInt(d.present),
          absent: parseInt(d.absent),
          late: parseInt(d.late)
        })),
        department_stats: departmentStats.map((d: any) => ({
          department: d.department_name,
          total: parseInt(d.total),
          present: parseInt(d.present),
          attendance_rate: parseFloat(d.attendance_rate)
        })),
        late_patterns: latePatterns.map((p: any) => ({
          hour: parseInt(p.hour),
          count: parseInt(p.count)
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching attendance analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch attendance analytics'
      }
    });
  }
};

/**
 * Get meeting room utilization analytics
 */
export const getMeetingRoomAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30' } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period as string));

    // Meeting duration analysis
    const durationStats = await db('meetings')
      .select(
        db.raw('COUNT(*) as total_meetings'),
        db.raw('AVG(duration_minutes) as avg_duration'),
        db.raw('MIN(duration_minutes) as min_duration'),
        db.raw('MAX(duration_minutes) as max_duration')
      )
      .whereBetween('meeting_time', [startDate, new Date()])
      .first();

    // Most active hosts
    const activeHosts = await db('meetings')
      .select(
        'users.name as host_name',
        'users.email as host_email',
        'departments.name as department',
        db.raw('COUNT(*) as meeting_count'),
        db.raw('COUNT(DISTINCT visitors.id) as total_visitors')
      )
      .join('users', 'meetings.host_id', 'users.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('visitors', 'meetings.id', 'visitors.meeting_id')
      .whereBetween('meetings.meeting_time', [startDate, new Date()])
      .groupBy('users.id', 'users.name', 'users.email', 'departments.name')
      .orderBy('meeting_count', 'desc')
      .limit(10);

    // Meeting location distribution
    const locationDistribution = await db('meetings')
      .select('location')
      .count('* as count')
      .whereBetween('meeting_time', [startDate, new Date()])
      .groupBy('location')
      .orderBy('count', 'desc')
      .limit(10);

    // Time slot utilization (hourly)
    const timeSlots = await db('meetings')
      .select(
        db.raw("EXTRACT(HOUR FROM meeting_time) as hour"),
        db.raw('COUNT(*) as meeting_count'),
        db.raw('SUM(duration_minutes) as total_minutes')
      )
      .whereBetween('meeting_time', [startDate, new Date()])
      .groupBy(db.raw("EXTRACT(HOUR FROM meeting_time)"))
      .orderBy('hour');

    // Meeting purpose distribution (if available)
    const purposes = await db('meetings')
      .select('purpose')
      .count('* as count')
      .whereBetween('meeting_time', [startDate, new Date()])
      .whereNotNull('purpose')
      .where('purpose', '!=', '')
      .groupBy('purpose')
      .orderBy('count', 'desc')
      .limit(10);

    logger.info(`Meeting room analytics retrieved by ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        period_days: parseInt(period as string),
        duration_stats: {
          total_meetings: parseInt((durationStats as any)?.total_meetings || '0'),
          avg_duration_minutes: Math.round(parseFloat((durationStats as any)?.avg_duration || '0')),
          min_duration: parseInt((durationStats as any)?.min_duration || '0'),
          max_duration: parseInt((durationStats as any)?.max_duration || '0')
        },
        active_hosts: activeHosts.map((h: any) => ({
          name: h.host_name,
          email: h.host_email,
          department: h.department,
          meetings: parseInt(h.meeting_count),
          visitors: parseInt(h.total_visitors)
        })),
        location_distribution: locationDistribution.map((l: any) => ({
          location: l.location,
          count: parseInt(l.count)
        })),
        hourly_utilization: timeSlots.map((t: any) => ({
          hour: parseInt(t.hour),
          meetings: parseInt(t.meeting_count),
          total_minutes: parseInt(t.total_minutes),
          avg_minutes: Math.round(parseInt(t.total_minutes) / parseInt(t.meeting_count))
        })),
        top_purposes: purposes.map((p: any) => ({
          purpose: p.purpose,
          count: parseInt(p.count)
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching meeting room analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting room analytics'
      }
    });
  }
};
