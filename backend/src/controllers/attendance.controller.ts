import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Auto-calculate attendance from access logs
 * Run this as a cron job daily or trigger manually
 */
export const calculateAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { date, employee_id } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get employees to process
    let employees: any[];
    if (employee_id) {
      const emp = await db('users').where({ id: employee_id as string }).first();
      employees = emp ? [emp] : [];
    } else {
      employees = await db('users')
        .whereIn('role', ['employee', 'host', 'secretary'])
        .where('is_active', true);
    }

    const processedRecords = [];

    for (const employee of employees) {
      // Get employee's shift for this date
      const employeeShift = await db('employee_shifts')
        .leftJoin('attendance_shifts', 'employee_shifts.shift_id', 'attendance_shifts.id')
        .where('employee_shifts.employee_id', employee.id)
        .where('employee_shifts.is_active', true)
        .where('employee_shifts.effective_from', '<=', targetDate)
        .where(function(this: any) {
          this.whereNull('employee_shifts.effective_until')
            .orWhere('employee_shifts.effective_until', '>=', targetDate);
        })
        .select(
          'attendance_shifts.*',
          'employee_shifts.shift_id'
        )
        .first();

      if (!employeeShift) {
        logger.warn(`No shift found for employee ${employee.id} on ${targetDate.toISOString()}`);
        continue;
      }

      // Check if it's a weekend/holiday
      const dayOfWeek = targetDate.getDay();
      const deptConfig = await db('department_shift_config')
        .where('department_id', employee.department_id)
        .first();

      const weekendDays = deptConfig?.weekend_days || [0]; // Sunday by default
      const isWeekend = weekendDays.includes(dayOfWeek);

      const holiday = await db('holidays')
        .where('date', targetDate)
        .where('is_active', true)
        .where(function(this: any) {
          this.whereNull('applicable_to_department')
            .orWhere('applicable_to_department', employee.department_id);
        })
        .first();

      if (isWeekend) {
        // Mark as weekend (check if employee still came in)
        const accessLogs = await db('employee_access_logs')
          .where('employee_id', employee.id)
          .where('entry_time', '>=', targetDate)
          .where('entry_time', '<', nextDay)
          .where('access_granted', true)
          .orderBy('entry_time', 'asc');

        if (accessLogs.length > 0) {
          // Employee came on weekend - mark as overtime
          await upsertAttendanceRecord(employee.id, targetDate, employeeShift, accessLogs, 'overtime');
          processedRecords.push({ employee_id: employee.id, status: 'overtime' });
        } else {
          await upsertAttendanceRecord(employee.id, targetDate, employeeShift, [], 'weekend');
          processedRecords.push({ employee_id: employee.id, status: 'weekend' });
        }
        continue;
      }

      if (holiday) {
        const accessLogs = await db('employee_access_logs')
          .where('employee_id', employee.id)
          .where('entry_time', '>=', targetDate)
          .where('entry_time', '<', nextDay)
          .where('access_granted', true)
          .orderBy('entry_time', 'asc');

        if (accessLogs.length > 0) {
          await upsertAttendanceRecord(employee.id, targetDate, employeeShift, accessLogs, 'overtime');
          processedRecords.push({ employee_id: employee.id, status: 'overtime_holiday' });
        } else {
          await upsertAttendanceRecord(employee.id, targetDate, employeeShift, [], 'holiday');
          processedRecords.push({ employee_id: employee.id, status: 'holiday' });
        }
        continue;
      }

      // Check for approved leave
      const leave = await db('employee_leaves')
        .where('employee_id', employee.id)
        .where('from_date', '<=', targetDate)
        .where('to_date', '>=', targetDate)
        .where('status', 'approved')
        .first();

      if (leave) {
        await upsertAttendanceRecord(employee.id, targetDate, employeeShift, [], 'leave');
        processedRecords.push({ employee_id: employee.id, status: 'leave' });
        continue;
      }

      // Get access logs for the day
      const accessLogs = await db('employee_access_logs')
        .where('employee_id', employee.id)
        .where('entry_time', '>=', targetDate)
        .where('entry_time', '<', nextDay)
        .where('access_granted', true)
        .orderBy('entry_time', 'asc');

      if (accessLogs.length === 0) {
        // Absent
        await upsertAttendanceRecord(employee.id, targetDate, employeeShift, [], 'absent');
        processedRecords.push({ employee_id: employee.id, status: 'absent' });
        continue;
      }

      // Calculate attendance
      await upsertAttendanceRecord(employee.id, targetDate, employeeShift, accessLogs);
      processedRecords.push({ employee_id: employee.id, status: 'processed' });
    }

    res.json({
      success: true,
      message: `Attendance calculated for ${processedRecords.length} employees`,
      data: processedRecords,
      date: targetDate.toISOString().split('T')[0]
    });
  } catch (error) {
    logger.error('Error calculating attendance:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to calculate attendance'
      }
    });
  }
};

/**
 * Helper function to upsert attendance record
 */
async function upsertAttendanceRecord(
  employee_id: string,
  date: Date,
  shift: any,
  accessLogs: any[],
  status?: string
) {
  const dateStr = date.toISOString().split('T')[0];

  if (status === 'absent' || status === 'weekend' || status === 'holiday' || status === 'leave') {
    await db('attendance_records')
      .insert({
        employee_id,
        shift_id: shift.id,
        date: dateStr,
        status,
        expected_check_in: shift.start_time,
        expected_check_out: shift.end_time
      })
      .onConflict(['employee_id', 'date'])
      .merge();
    return;
  }

  // Calculate from access logs
  const firstEntry = accessLogs[0];
  const lastEntry = accessLogs[accessLogs.length - 1];

  const firstCheckIn = new Date(firstEntry.entry_time);
  const lastCheckOut = lastEntry.exit_time ? new Date(lastEntry.exit_time) : new Date();

  // Calculate total hours
  const totalMilliseconds = lastCheckOut.getTime() - firstCheckIn.getTime();
  const totalHours = totalMilliseconds / (1000 * 60 * 60);

  // Calculate late/early
  const expectedCheckIn = new Date(date);
  const [hours, minutes] = shift.start_time.split(':');
  expectedCheckIn.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  const lateMilliseconds = firstCheckIn.getTime() - expectedCheckIn.getTime();
  const lateMinutes = Math.max(0, Math.floor(lateMilliseconds / (1000 * 60)));

  const gracePeriod = shift.grace_period_minutes || 15;
  const isLate = lateMinutes > gracePeriod;

  const expectedCheckOut = new Date(date);
  const [endHours, endMinutes] = shift.end_time.split(':');
  expectedCheckOut.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

  const earlyMilliseconds = expectedCheckOut.getTime() - lastCheckOut.getTime();
  const earlyMinutes = Math.max(0, Math.floor(earlyMilliseconds / (1000 * 60)));
  const isEarlyExit = earlyMinutes > 15;

  // Calculate overtime
  const overtimeMilliseconds = Math.max(0, lastCheckOut.getTime() - expectedCheckOut.getTime());
  const overtimeMinutes = Math.floor(overtimeMilliseconds / (1000 * 60));

  // Determine status
  let finalStatus = 'present';
  if (isLate) {
    finalStatus = 'late';
  }
  if (isEarlyExit) {
    finalStatus = 'early_exit';
  }
  if (totalHours < 4) {
    finalStatus = 'half_day';
  }
  if (overtimeMinutes > 60) {
    finalStatus = 'overtime';
  }

  const breakHours = shift.break_duration_minutes ? shift.break_duration_minutes / 60 : 1;
  const workHours = Math.max(0, totalHours - breakHours);

  await db('attendance_records')
    .insert({
      employee_id,
      shift_id: shift.id,
      date: dateStr,
      first_check_in: firstCheckIn,
      last_check_out: lastCheckOut,
      total_hours: totalHours.toFixed(2),
      work_hours: workHours.toFixed(2),
      break_hours: breakHours.toFixed(2),
      status: finalStatus,
      expected_check_in: shift.start_time,
      expected_check_out: shift.end_time,
      is_late: isLate,
      late_by_minutes: isLate ? lateMinutes : null,
      is_early_exit: isEarlyExit,
      early_exit_by_minutes: isEarlyExit ? earlyMinutes : null,
      overtime_minutes: overtimeMinutes > 0 ? overtimeMinutes : null
    })
    .onConflict(['employee_id', 'date'])
    .merge();
}

/**
 * Get attendance records
 */
export const getAttendanceRecords = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, department_id, from_date, to_date, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('attendance_records')
      .leftJoin('users', 'attendance_records.employee_id', 'users.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('attendance_shifts', 'attendance_records.shift_id', 'attendance_shifts.id')
      .select(
        'attendance_records.*',
        'users.name as employee_name',
        'users.its_id',
        'departments.name as department_name',
        'attendance_shifts.name as shift_name'
      )
      .orderBy('attendance_records.date', 'desc');

    if (employee_id) {
      query = query.where('attendance_records.employee_id', employee_id as string);
    }

    if (department_id) {
      query = query.where('users.department_id', department_id as string);
    }

    if (from_date) {
      query = query.where('attendance_records.date', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('attendance_records.date', '<=', to_date as string);
    }

    if (status) {
      query = query.where('attendance_records.status', status as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const records = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: records,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch attendance records'
      }
    });
  }
};

/**
 * Get attendance summary for employee
 */
export const getEmployeeAttendanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id } = req.params;
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month as string) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();

    const fromDate = new Date(targetYear, targetMonth - 1, 1);
    const toDate = new Date(targetYear, targetMonth, 0);

    const records = await db('attendance_records')
      .where('employee_id', employee_id)
      .where('date', '>=', fromDate.toISOString().split('T')[0])
      .where('date', '<=', toDate.toISOString().split('T')[0]);

    const summary = {
      total_days: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      half_day: records.filter(r => r.status === 'half_day').length,
      early_exit: records.filter(r => r.status === 'early_exit').length,
      leave: records.filter(r => r.status === 'leave').length,
      weekend: records.filter(r => r.status === 'weekend').length,
      holiday: records.filter(r => r.status === 'holiday').length,
      overtime: records.filter(r => r.status === 'overtime').length,
      total_work_hours: records.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0).toFixed(2),
      total_overtime_minutes: records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0)
    };

    res.json({
      success: true,
      data: {
        employee_id,
        month: targetMonth,
        year: targetYear,
        summary,
        records
      }
    });
  } catch (error) {
    logger.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch attendance summary'
      }
    });
  }
};

/**
 * Get department attendance summary
 */
export const getDepartmentAttendanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { department_id } = req.params;
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const records = await db('attendance_records')
      .leftJoin('users', 'attendance_records.employee_id', 'users.id')
      .where('users.department_id', department_id)
      .where('attendance_records.date', dateStr)
      .select('attendance_records.*', 'users.name as employee_name', 'users.its_id');

    const summary = {
      date: dateStr,
      total_employees: records.length,
      present: records.filter(r => ['present', 'late', 'early_exit', 'overtime'].includes(r.status)).length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      on_leave: records.filter(r => r.status === 'leave').length
    };

    res.json({
      success: true,
      data: {
        department_id,
        summary,
        records
      }
    });
  } catch (error) {
    logger.error('Error fetching department attendance summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch department attendance summary'
      }
    });
  }
};
