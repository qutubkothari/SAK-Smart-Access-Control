import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';
import db from '../config/database';
import logger from '../utils/logger';

export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { host_id, meeting_time, duration_minutes, location, purpose, visitors } = req.body;
    const requesterId = req.user!.id;

    // Validate input
    if (!host_id || !meeting_time || !location || !visitors || visitors.length === 0) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields'
        }
      });
      return;
    }

    // Create meeting
    const [meeting] = await db('meetings')
      .insert({
        host_id,
        meeting_time,
        duration_minutes: duration_minutes || 60,
        location,
        purpose,
        status: 'scheduled'
      })
      .returning('*');

    // Create visitors and generate QR codes
    const qrCodes = [];
    for (const visitor of visitors) {
      // Insert visitor first to get ID
      const [visitorRecord] = await db('visitors')
        .insert({
          meeting_id: meeting.id,
          name: visitor.name,
          email: visitor.email,
          phone: visitor.phone,
          company: visitor.company,
          visitor_type: visitor.visitor_type || 'guest',
          qr_code: 'pending', // Temporary placeholder
          qr_code_expires_at: new Date(meeting_time)
        })
        .returning('*');

      // Generate secure JWT-based QR code
      const qrExpiresAt = new Date(meeting_time);
      qrExpiresAt.setHours(qrExpiresAt.getHours() + parseInt(process.env.QR_CODE_EXPIRY_HOURS || '24'));

      const qrCode = await QRCodeService.generateQRCode(
        meeting.id,
        visitorRecord.id,
        visitor.email,
        qrExpiresAt
      );

      // Update visitor with actual QR code token
      await db('visitors')
        .where({ id: visitorRecord.id })
        .update({
          qr_code: qrCode.token,
          qr_code_expires_at: qrExpiresAt
        });

      visitorRecord.qr_code = qrCode.token;

      // Send notifications with QR code
      await NotificationService.sendMeetingInvite(visitorRecord, meeting, qrCode.image);

      qrCodes.push({
        visitor_id: visitorRecord.id,
        visitor_name: visitor.name,
        qr_code: qrCode.image,
        qr_token: qrCode.token,
        qr_id: qrCode.qrId,
        email_sent: true,
        whatsapp_sent: true
      });
    }

    logger.info(`Meeting created: ${meeting.id} by requester ${requesterId} for host ${host_id}`);

    res.status(201).json({
      success: true,
      data: {
        meeting_id: meeting.id,
        qr_codes: qrCodes
      }
    });
  } catch (error) {
    logger.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create meeting'
      }
    });
  }
};

export const getMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const { status, date_from, date_to, page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('meetings')
      .where('host_id', userId)
      .orderBy('meeting_time', 'desc');

    if (status) {
      query = query.where('status', status as string);
    }

    if (date_from) {
      query = query.where('meeting_time', '>=', date_from as string);
    }

    if (date_to) {
      query = query.where('meeting_time', '<=', date_to as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const meetings = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: meetings,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching meetings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meetings'
      }
    });
  }
};

export const getMeetingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const meeting = await db('meetings')
      .where({ id })
      .first();

    if (!meeting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting not found'
        }
      });
      return;
    }

    const visitors = await db('visitors')
      .where('meeting_id', id);

    res.json({
      success: true,
      data: {
        ...meeting,
        visitors
      }
    });
  } catch (error) {
    logger.error('Error fetching meeting:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting'
      }
    });
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user!.id;

    const meeting = await db('meetings').where({ id, host_id: userId }).first();

    if (!meeting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting not found or unauthorized'
        }
      });
      return;
    }

    await db('meetings').where({ id }).update({
      ...updates,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Meeting updated successfully'
    });
  } catch (error) {
    logger.error('Error updating meeting:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update meeting'
      }
    });
  }
};

export const cancelMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const meeting = await db('meetings').where({ id, host_id: userId }).first();

    if (!meeting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting not found or unauthorized'
        }
      });
      return;
    }

    await db('meetings').where({ id }).update({
      status: 'cancelled',
      updated_at: new Date()
    });

    // Notify visitors
    const visitors = await db('visitors').where('meeting_id', id);
    for (const visitor of visitors) {
      await NotificationService.sendCancellationNotice(visitor, meeting);
    }

    res.json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling meeting:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel meeting'
      }
    });
  }
};

export const checkInHost = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await db('meetings').where({ id, host_id: userId }).update({
      host_checked_in: true,
      host_check_in_time: new Date()
    });

    res.json({
      success: true,
      message: 'Host checked in successfully'
    });
  } catch (error) {
    logger.error('Error checking in host:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check in'
      }
    });
  }
};
