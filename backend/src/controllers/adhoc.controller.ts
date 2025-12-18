import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../server';

/**
 * Create adhoc/walk-in visit (Angadiya)
 * Quick registration without pre-scheduled meeting
 */
export const createAdhocVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      visitor_name,
      visitor_phone,
      visitor_email,
      visitor_company,
      host_its_id,
      purpose,
      badge_number
    } = req.body;

    if (!visitor_name || !visitor_phone || !host_its_id) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Visitor name, phone, and host ITS ID are required'
        }
      });
      return;
    }

    // Find host
    const host = await db('users').where({ its_id: host_its_id }).first();

    if (!host) {
      res.status(404).json({
        success: false,
        error: {
          code: 'HOST_NOT_FOUND',
          message: 'Host not found'
        }
      });
      return;
    }

    // Create adhoc meeting (valid for 2 hours)
    const now = new Date();
    const meetingEndTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const [meeting] = await db('meetings')
      .insert({
        host_id: host.id,
        meeting_time: now,
        duration_minutes: 120,
        location: 'Reception',
        purpose: purpose || 'Walk-in Visit',
        status: 'scheduled'
      })
      .returning('*');

    // Create visitor record
    const visitorId = uuidv4();
    const [visitor] = await db('visitors')
      .insert({
        id: visitorId,
        meeting_id: meeting.id,
        name: visitor_name,
        email: visitor_email || `adhoc_${visitorId}@temp.local`,
        phone: visitor_phone,
        company: visitor_company || '',
        visitor_type: 'adhoc',
        qr_code: `ADHOC_${visitorId}`, // Simple token for adhoc visits
        qr_code_expires_at: meetingEndTime,
        check_in_time: now,
        checked_in_by: req.user!.id,
        badge_number: badge_number
      })
      .returning('*');

    // Log access entry
    await db('visitor_access_log').insert({
      visitor_id: visitor.id,
      meeting_id: meeting.id,
      entry_time: now,
      entry_point: 'main_reception',
      checked_in_by: req.user!.id,
      notes: 'Adhoc walk-in visit'
    });

    // Emit real-time notification to host
    io.to(`user_${host.id}`).emit('adhoc_visitor_arrived', {
      visitor_name,
      visitor_company,
      time: now
    });

    logger.info(`Adhoc visit created for ${visitor_name} with host ${host.its_id}`);

    res.status(201).json({
      success: true,
      data: {
        visitor: {
          id: visitor.id,
          name: visitor.name,
          phone: visitor.phone,
          company: visitor.company,
          badge_number: visitor.badge_number
        },
        meeting: {
          id: meeting.id,
          host_name: host.name,
          meeting_time: meeting.meeting_time,
          duration_minutes: meeting.duration_minutes,
          location: meeting.location
        }
      },
      message: 'Adhoc visit created successfully'
    });
  } catch (error) {
    logger.error('Error creating adhoc visit:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create adhoc visit'
      }
    });
  }
};

/**
 * Get all adhoc visits
 */
export const getAdhocVisits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, status = 'active' } = req.query;

    let query = db('visitors')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .join('users', 'meetings.host_id', 'users.id')
      .where('visitors.visitor_type', 'adhoc')
      .select(
        'visitors.*',
        'meetings.meeting_time',
        'meetings.location',
        'meetings.duration_minutes',
        'users.name as host_name',
        'users.its_id as host_its_id'
      );

    if (status === 'active') {
      query = query.whereNotNull('visitors.check_in_time').whereNull('visitors.check_out_time');
    } else if (status === 'completed') {
      query = query.whereNotNull('visitors.check_out_time');
    }

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.whereBetween('visitors.check_in_time', [startOfDay, endOfDay]);
    }

    const visits = await query.orderBy('visitors.check_in_time', 'desc');

    res.json({
      success: true,
      data: visits
    });
  } catch (error) {
    logger.error('Error fetching adhoc visits:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch adhoc visits'
      }
    });
  }
};
