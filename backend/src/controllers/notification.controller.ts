import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import { io } from '../server';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { unread, type, page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('notifications')
      .where('recipient_id', userId)
      .orderBy('created_at', 'desc');

    if (unread === 'true') {
      query = query.whereNull('read_at');
    }

    if (type) {
      query = query.where('type', type as string);
    }

    const [{ count }] = await query.clone().clearOrder().count('* as count');
    const notifications = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: notifications,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch notifications'
      }
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await db('notifications')
      .where({ id, recipient_id: userId })
      .update({ read_at: new Date() });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark notification as read'
      }
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    await db('notifications')
      .where({ recipient_id: userId })
      .whereNull('read_at')
      .update({ read_at: new Date() });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark all notifications as read'
      }
    });
  }
};

/**
 * Send daily attendance summary to all managers
 * Called by cron job or manually
 */
export const sendDailyAttendanceSummaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get department managers
    const managers = await db('users as u')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select('u.email', 'u.full_name', 'd.department_id', 'd.department_name')
      .where('u.role', 'admin')
      .where('u.is_active', true);

    const summaries = [];

    for (const manager of managers) {
      // Get attendance summary for this manager's department
      const summary = await db('attendance_records as ar')
        .join('users as u', 'ar.employee_id', 'u.user_id')
        .select(
          db.raw('COUNT(*) as total_employees'),
          db.raw("COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present"),
          db.raw("COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late"),
          db.raw("COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent"),
          db.raw("COUNT(CASE WHEN ar.status = 'leave' THEN 1 END) as on_leave")
        )
        .where('ar.date', targetDate)
        .where('u.department_id', manager.department_id)
        .first();

      if (summary && Number(summary.total_employees) > 0) {
        const emailSent = await emailService.sendDailyAttendanceSummary(
          manager.email,
          String(targetDate),
          {
            department: manager.department_name,
            total_employees: Number(summary.total_employees),
            present: Number(summary.present),
            late: Number(summary.late),
            absent: Number(summary.absent),
            on_leave: Number(summary.on_leave)
          }
        );

        summaries.push({
          manager: manager.full_name,
          department: manager.department_name,
          email_sent: emailSent
        });
      }
    }

    logger.info(`Daily attendance summaries sent for ${targetDate}`);

    res.json({
      success: true,
      message: `Attendance summaries sent to ${summaries.length} managers`,
      data: summaries
    });
  } catch (error: any) {
    logger.error('Error sending attendance summaries:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_FAILED',
        message: 'Failed to send attendance summaries'
      }
    });
  }
};

/**
 * Send late arrival alerts to employees
 * Called by cron job after attendance calculation
 */
export const sendLateArrivalAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get all late arrivals for the date
    const lateArrivals = await db('attendance_records as ar')
      .join('users as u', 'ar.employee_id', 'u.user_id')
      .join('attendance_shifts as s', 'ar.shift_id', 's.shift_id')
      .select(
        'u.email',
        'u.full_name',
        'ar.date',
        'ar.check_in_time',
        's.start_time',
        's.grace_period_minutes'
      )
      .where('ar.date', targetDate)
      .where('ar.status', 'late');

    const alerts = [];

    for (const late of lateArrivals) {
      // Calculate minutes late
      const checkIn = new Date(`2000-01-01 ${late.check_in_time}`);
      const shiftStart = new Date(`2000-01-01 ${late.start_time}`);
      const graceEnd = new Date(shiftStart.getTime() + late.grace_period_minutes * 60000);
      const lateBy = Math.round((checkIn.getTime() - graceEnd.getTime()) / 60000);

      const emailSent = await emailService.sendLateArrivalAlert(
        late.email,
        late.full_name,
        late.date,
        late.check_in_time,
        lateBy
      );

      alerts.push({
        employee: late.full_name,
        late_by: lateBy,
        email_sent: emailSent
      });
    }

    logger.info(`Late arrival alerts sent for ${targetDate}`);

    res.json({
      success: true,
      message: `Alerts sent to ${alerts.length} employees`,
      data: alerts
    });
  } catch (error: any) {
    logger.error('Error sending late arrival alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_FAILED',
        message: 'Failed to send late arrival alerts'
      }
    });
  }
};

/**
 * Send notification when leave is applied (called from leave controller)
 */
export const notifyLeaveApplication = async (
  employeeId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string
) => {
  try {
    // Get employee and manager info
    const employee = await db('users as u')
      .join('departments as d', 'u.department_id', 'd.department_id')
      .select('u.full_name', 'u.email', 'd.department_id', 'd.department_name')
      .where('u.user_id', employeeId)
      .first();

    if (!employee) return;

    // Get department manager/admin
    const managers = await db('users')
      .select('user_id', 'email', 'full_name')
      .where('role', 'admin')
      .where('is_active', true);

    // Send email to managers
    for (const manager of managers) {
      await emailService.sendLeaveApplicationNotification(
        manager.email,
        employee.full_name,
        leaveType,
        startDate,
        endDate,
        reason
      );

      // Send Socket.IO notification
      io.to(`user_${manager.user_id}`).emit('leave_application', {
        employee_name: employee.full_name,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        department: employee.department_name
      });
    }

    logger.info(`Leave application notifications sent for employee ${employeeId}`);
  } catch (error: any) {
    logger.error('Error sending leave application notification:', error);
  }
};

/**
 * Send notification when leave status is updated (called from leave controller)
 */
export const notifyLeaveStatusUpdate = async (
  employeeId: string,
  status: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reviewNotes?: string
) => {
  try {
    // Get employee info
    const employee = await db('users')
      .select('email', 'full_name')
      .where('user_id', employeeId)
      .first();

    if (!employee) return;

    // Send email
    await emailService.sendLeaveStatusUpdate(
      employee.email,
      status,
      leaveType,
      startDate,
      endDate,
      reviewNotes
    );

    // Send Socket.IO notification
    io.to(`user_${employeeId}`).emit('leave_status_update', {
      status,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      review_notes: reviewNotes
    });

    logger.info(`Leave status update notification sent to employee ${employeeId}`);
  } catch (error: any) {
    logger.error('Error sending leave status update notification:', error);
  }
};
