import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get all meeting rooms
 */
export const getAllMeetingRooms = async (req: AuthRequest, res: Response) => {
  try {
    const { floor, building, is_active = true } = req.query;

    let query = db('meeting_rooms').select('*');

    if (floor) {
      query = query.where('floor_number', floor);
    }

    if (building) {
      query = query.where('building', building);
    }

    if (is_active !== undefined) {
      query = query.where('is_active', is_active === 'true' || is_active === true);
    }

    const rooms = await query.orderBy('floor_number', 'asc').orderBy('name', 'asc');

    res.json({
      success: true,
      data: rooms
    });
  } catch (error) {
    logger.error('Error fetching meeting rooms:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting rooms'
      }
    });
  }
};

/**
 * Get meeting room by ID
 */
export const getMeetingRoomById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await db('meeting_rooms').where({ id }).first();

    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Meeting room not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    logger.error('Error fetching meeting room:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting room'
      }
    });
  }
};

/**
 * Create new meeting room (Admin only)
 */
export const createMeetingRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, floor_number, building, capacity, equipment, description } = req.body;

    if (!name || !code || !floor_number || !capacity) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, code, floor_number, capacity'
        }
      });
      return;
    }

    // Check if code already exists
    const existing = await db('meeting_rooms').where({ code }).first();
    if (existing) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_CODE',
          message: 'Meeting room code already exists'
        }
      });
      return;
    }

    const [room] = await db('meeting_rooms')
      .insert({
        name,
        code,
        floor_number,
        building,
        capacity,
        equipment: equipment || {},
        description,
        is_active: true
      })
      .returning('*');

    logger.info(`Meeting room created: ${room.id} (${room.name})`);

    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    logger.error('Error creating meeting room:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create meeting room'
      }
    });
  }
};

/**
 * Update meeting room (Admin only)
 */
export const updateMeetingRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [room] = await db('meeting_rooms')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning('*');

    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Meeting room not found'
        }
      });
      return;
    }

    logger.info(`Meeting room updated: ${id}`);

    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    logger.error('Error updating meeting room:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update meeting room'
      }
    });
  }
};

/**
 * Check meeting room availability
 */
export const checkRoomAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, date, start_time, duration_minutes } = req.query;

    if (!room_id || !date || !start_time || !duration_minutes) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters: room_id, date, start_time, duration_minutes'
        }
      });
      return;
    }

    const requestedStart = `${date} ${start_time}`;
    const requestedDuration = Number(duration_minutes);

    // Find conflicting meetings
    const conflicts = await db('meetings')
      .where('meeting_room_id', room_id)
      .whereNot('status', 'cancelled')
      .andWhereRaw(
        `meeting_time < (?::timestamp + (?::text || ' minutes')::interval)`,
        [requestedStart, requestedDuration]
      )
      .andWhereRaw(
        `(meeting_time + (duration_minutes::text || ' minutes')::interval) > ?::timestamp`,
        [requestedStart]
      )
      .select('id', 'meeting_time', 'duration_minutes', 'purpose', 'host_id');

    res.json({
      success: true,
      data: {
        available: conflicts.length === 0,
        conflicting_meetings: conflicts
      }
    });
  } catch (error) {
    logger.error('Error checking room availability:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check availability'
      }
    });
  }
};

/**
 * Get room schedule for a specific date
 */
export const getRoomSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, date } = req.query;

    if (!room_id || !date) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters: room_id, date'
        }
      });
      return;
    }

    const dayStart = `${date} 00:00:00`;
    const dayEnd = `${date} 23:59:59`;

    const bookings = await db('meetings')
      .where('meeting_room_id', room_id)
      .whereNot('status', 'cancelled')
      .andWhereBetween('meeting_time', [dayStart, dayEnd])
      .leftJoin('users', 'meetings.host_id', 'users.id')
      .select(
        'meetings.id',
        'meetings.meeting_time',
        'meetings.duration_minutes',
        'meetings.purpose',
        'meetings.status',
        'meetings.meeting_type',
        'users.name as host_name',
        'users.its_id as host_its_id'
      )
      .orderBy('meetings.meeting_time', 'asc');

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    logger.error('Error fetching room schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch room schedule'
      }
    });
  }
};
