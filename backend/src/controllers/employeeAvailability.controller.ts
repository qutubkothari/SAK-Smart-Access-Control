import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Create availability block (employee blocks their own time)
 */
export const createAvailabilityBlock = async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user?.id;
    const { start_time, end_time, reason, block_type } = req.body;

    if (!start_time || !end_time) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'start_time and end_time are required' }
      });
      return;
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (endDate <= startDate) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_TIME_RANGE', message: 'end_time must be after start_time' }
      });
      return;
    }

    // Check for overlapping blocks
    const overlapping = await db('employee_availability_blocks')
      .where('employee_id', employeeId)
      .andWhere((builder) => {
        builder
          .where('start_time', '<', end_time)
          .andWhere('end_time', '>', start_time);
      })
      .first();

    if (overlapping) {
      res.status(409).json({
        success: false,
        error: {
          code: 'TIME_CONFLICT',
          message: 'You already have a block during this time period'
        }
      });
      return;
    }

    const [block] = await db('employee_availability_blocks')
      .insert({
        employee_id: employeeId,
        start_time,
        end_time,
        reason: reason || 'Busy',
        block_type: block_type || 'busy'
      })
      .returning('*');

    res.status(201).json({
      success: true,
      data: block
    });
  } catch (error) {
    logger.error('Error creating availability block:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create availability block' }
    });
  }
};

/**
 * Get employee's availability blocks
 */
export const getMyAvailabilityBlocks = async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user?.id;
    const { start_date, end_date } = req.query;

    let query = db('employee_availability_blocks')
      .where('employee_id', employeeId)
      .orderBy('start_time', 'asc');

    if (start_date) {
      query = query.where('start_time', '>=', start_date);
    }
    if (end_date) {
      query = query.where('end_time', '<=', end_date);
    }

    const blocks = await query;

    res.json({
      success: true,
      data: blocks
    });
  } catch (error) {
    logger.error('Error fetching availability blocks:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch availability blocks' }
    });
  }
};

/**
 * Check if employee is available (for secretary booking)
 */
export const checkEmployeeAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, start_time, duration_minutes } = req.body;

    if (!employee_id || !start_time || !duration_minutes) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'employee_id, start_time, and duration_minutes are required' }
      });
      return;
    }

    const endTime = new Date(new Date(start_time).getTime() + duration_minutes * 60000);

    // Check availability blocks
    const blocks = await db('employee_availability_blocks')
      .where('employee_id', employee_id)
      .andWhere((builder) => {
        builder
          .where('start_time', '<', endTime.toISOString())
          .andWhere('end_time', '>', start_time);
      })
      .select('*');

    // Check existing meetings
    const meetings = await db('internal_meeting_participants as imp')
      .join('meetings as m', 'imp.meeting_id', 'm.id')
      .where('imp.user_id', employee_id)
      .where('imp.is_primary_employee', true)
      .where('m.status', '!=', 'cancelled')
      .andWhereRaw(
        `m.meeting_time < (?::timestamp + (?::text || ' minutes')::interval)`,
        [start_time, duration_minutes]
      )
      .andWhereRaw(
        `(m.meeting_time + (m.duration_minutes::text || ' minutes')::interval) > ?::timestamp`,
        [start_time]
      )
      .select('m.id', 'm.meeting_time', 'm.duration_minutes', 'm.purpose', 'm.location');

    const isAvailable = blocks.length === 0 && meetings.length === 0;

    res.json({
      success: true,
      data: {
        is_available: isAvailable,
        blocks: blocks.length > 0 ? blocks : [],
        conflicting_meetings: meetings.length > 0 ? meetings : []
      }
    });
  } catch (error) {
    logger.error('Error checking employee availability:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check availability' }
    });
  }
};

/**
 * Delete availability block
 */
export const deleteAvailabilityBlock = async (req: AuthRequest, res: Response) => {
  try {
    const { block_id } = req.params;
    const employeeId = req.user?.id;

    const block = await db('employee_availability_blocks')
      .where({ id: block_id, employee_id: employeeId })
      .first();

    if (!block) {
      res.status(404).json({
        success: false,
        error: { code: 'BLOCK_NOT_FOUND', message: 'Availability block not found' }
      });
      return;
    }

    await db('employee_availability_blocks')
      .where({ id: block_id })
      .del();

    res.json({
      success: true,
      data: { message: 'Availability block deleted successfully' }
    });
  } catch (error) {
    logger.error('Error deleting availability block:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete availability block' }
    });
  }
};

/**
 * Get employee's upcoming meetings
 */
export const getMyUpcomingMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user?.id;

    const meetings = await db('internal_meeting_participants as imp')
      .join('meetings as m', 'imp.meeting_id', 'm.id')
      .leftJoin('meeting_rooms as mr', 'm.meeting_room_id', 'mr.id')
      .leftJoin('users as secretary', 'm.booked_by_secretary_id', 'secretary.id')
      .where('imp.user_id', employeeId)
      .where('m.status', '!=', 'cancelled')
      .where('m.meeting_time', '>=', new Date())
      .select(
        'm.id',
        'm.meeting_time',
        'm.duration_minutes',
        'm.purpose',
        'm.location',
        'm.status',
        'mr.name as room_name',
        'mr.floor_number',
        'imp.is_primary_employee',
        'imp.is_organizer',
        'secretary.name as booked_by_secretary'
      )
      .orderBy('m.meeting_time', 'asc');

    res.json({
      success: true,
      data: meetings
    });
  } catch (error) {
    logger.error('Error fetching upcoming meetings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch upcoming meetings' }
    });
  }
};
