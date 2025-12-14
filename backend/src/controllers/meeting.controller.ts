import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';
import db from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { io } from '../server';

const BUSINESS_START_MINUTES = 9 * 60;  // 09:00
const BUSINESS_END_MINUTES = 18 * 60;   // 18:00
const DEFAULT_SLOT_MINUTES = 30;

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const buildOverlapQuery = (query: any, hostId: string, startTs: string, durationMinutes: number) => {
  // Overlap: existing_start < requested_end AND existing_end > requested_start
  // existing_end = meeting_time + duration_minutes
  return query
    .where('host_id', hostId)
    .whereNot('status', 'cancelled')
    .andWhereRaw(
      `meeting_time < (?::timestamp + (?::text || ' minutes')::interval)`,
      [startTs, durationMinutes]
    )
    .andWhereRaw(
      `(meeting_time + (duration_minutes::text || ' minutes')::interval) > ?::timestamp`,
      [startTs]
    );
};

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

    const requestedDuration = Number(duration_minutes || 60);

    // Prevent double-booking for the same host
    const conflictingMeeting = await buildOverlapQuery(
      db('meetings').select('id', 'meeting_time', 'duration_minutes').limit(1),
      host_id,
      meeting_time,
      requestedDuration
    ).first();

    if (conflictingMeeting) {
      res.status(409).json({
        success: false,
        error: {
          code: 'TIME_SLOT_UNAVAILABLE',
          message: 'This host is already booked for the selected time. Please choose another slot.'
        }
      });
      return;
    }

    // Create meeting
    const [meeting] = await db('meetings')
      .insert({
        host_id,
        meeting_time,
        duration_minutes: requestedDuration,
        location,
        purpose,
        status: 'scheduled'
      })
      .returning('*');

    // Create visitors and generate QR codes
    const qrCodes = [];
    const createdVisitors: any[] = [];
    for (const visitor of visitors) {
      const visitorId = uuidv4();

      // Generate secure JWT-based QR code
      const qrExpiresAt = new Date(meeting_time);
      qrExpiresAt.setHours(qrExpiresAt.getHours() + parseInt(process.env.QR_CODE_EXPIRY_HOURS || '24'));

      const qrCode = await QRCodeService.generateQRCode(meeting.id, visitorId, visitor.email, qrExpiresAt);

      // Insert visitor with the generated QR token (qr_code is UNIQUE+NOT NULL)
      const [visitorRecord] = await db('visitors')
        .insert({
          id: visitorId,
          meeting_id: meeting.id,
          its_id: visitor.its_id || null,
          name: visitor.name,
          email: visitor.email,
          phone: visitor.phone,
          company: visitor.company,
          visitor_type: visitor.visitor_type || 'guest',
          qr_code: qrCode.token,
          qr_code_expires_at: qrExpiresAt
        })
        .returning('*');

      // Send notifications with QR code
      await NotificationService.sendMeetingInvite(visitorRecord, meeting, qrCode.image);

      createdVisitors.push(visitorRecord);

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

    // Notify host once with meeting summary
    await NotificationService.sendHostMeetingScheduled(host_id, createdVisitors, meeting);

    logger.info(`Meeting created: ${meeting.id} by requester ${requesterId} for host ${host_id}`);

    // Emit real-time update
    io.emit('meeting:created', { meeting_id: meeting.id });

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

export const getMeetingAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { host_id, date, duration_minutes, slot_minutes } = req.query as any;

    if (!host_id || !date) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'host_id and date (YYYY-MM-DD) are required'
        }
      });
      return;
    }

    const requestedDuration = Math.max(1, Number(duration_minutes || 60));
    const slotSize = Math.max(5, Number(slot_minutes || DEFAULT_SLOT_MINUTES));

    // Treat meeting_time as a "local" timestamp without timezone.
    const dayStart = `${date} 00:00:00`;
    const dayEnd = `${date} 23:59:59.999`;

    const meetings = await db('meetings')
      .where('host_id', host_id)
      .whereNot('status', 'cancelled')
      .andWhereRaw(`meeting_time < ?::timestamp`, [dayEnd])
      .andWhereRaw(`(meeting_time + (duration_minutes::text || ' minutes')::interval) > ?::timestamp`, [dayStart])
      .select([
        db.raw(`to_char(meeting_time, 'HH24:MI') as start_time`),
        'duration_minutes'
      ]);

    const bookedRanges: Array<{ start: number; end: number }> = [];
    for (const m of meetings as any[]) {
      const startMin = timeToMinutes(m.start_time);
      if (startMin === null) continue;
      const dur = Number(m.duration_minutes || 0);
      bookedRanges.push({ start: startMin, end: startMin + dur });
    }

    const slots: Array<{ time: string; available: boolean }> = [];
    for (let start = BUSINESS_START_MINUTES; start <= BUSINESS_END_MINUTES - requestedDuration; start += slotSize) {
      const end = start + requestedDuration;
      const overlaps = bookedRanges.some((b) => b.start < end && b.end > start);
      slots.push({ time: minutesToTime(start), available: !overlaps });
    }

    res.json({
      success: true,
      data: {
        host_id,
        date,
        duration_minutes: requestedDuration,
        slot_minutes: slotSize,
        business_hours: {
          start: minutesToTime(BUSINESS_START_MINUTES),
          end: minutesToTime(BUSINESS_END_MINUTES)
        },
        slots
      }
    });
  } catch (error) {
    logger.error('Error fetching meeting availability:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch availability'
      }
    });
  }
};

export const getMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const { status, date_from, date_to, page = 1, limit = 20, host_id, sort_by = 'meeting_time', sort_order = 'desc' } = req.query as any;
    const userId = req.user!.id;
    const userRole = req.user?.role;
    const offset = (Number(page) - 1) * Number(limit);

    // Role-based filtering
    let effectiveHostId: string | undefined;
    if (userRole === 'admin') {
      effectiveHostId = host_id as string | undefined;
    } else if (userRole === 'host') {
      effectiveHostId = userId;
    } else {
      // receptionist/security can see all meetings
      effectiveHostId = undefined;
    }

    const countQuery = db('meetings');
    let query = db('meetings')
      .leftJoin('users', 'meetings.host_id', 'users.id')
      .select([
        'meetings.*',
        'users.first_name as host_first_name',
        'users.last_name as host_last_name',
        'users.email as host_email'
      ])
      .orderBy(`meetings.${sort_by}`, sort_order);

    if (effectiveHostId) {
      countQuery.where('host_id', effectiveHostId);
      query = query.where('meetings.host_id', effectiveHostId);
    }

    if (status) {
      countQuery.where('status', status as string);
      query = query.where('meetings.status', status as string);
    }

    if (date_from) {
      countQuery.where('meeting_time', '>=', date_from as string);
      query = query.where('meetings.meeting_time', '>=', date_from as string);
    }

    if (date_to) {
      countQuery.where('meeting_time', '<=', date_to as string);
      query = query.where('meetings.meeting_time', '<=', date_to as string);
    }

    const [{ count }] = await countQuery.count('* as count');
    const meetings = await query.limit(Number(limit)).offset(offset);

    // Enrich with visitor count and names
    const meetingIds = meetings.map((m: any) => m.id);
    const visitors = await db('visitors')
      .whereIn('meeting_id', meetingIds)
      .select('meeting_id', 'full_name', 'email', 'check_in_time', 'check_out_time');

    const enrichedMeetings = meetings.map((meeting: any) => {
      const meetingVisitors = visitors.filter((v: any) => v.meeting_id === meeting.id);
      return {
        ...meeting,
        host_name: `${meeting.host_first_name} ${meeting.host_last_name}`,
        visitor_count: meetingVisitors.length,
        visitors: meetingVisitors
      };
    });

    res.json({
      success: true,
      data: enrichedMeetings,
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

    let qrCodeUrl: string | undefined;
    const token = visitors?.[0]?.qr_code;
    if (token) {
      try {
        const decoded: any = jwt.decode(token);
        const qrPayload = decoded?.jti ? String(decoded.jti) : String(token);

        qrCodeUrl = await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (e) {
        logger.warn('Failed to render QR code image for meeting', { meeting_id: id, error: e });
      }
    }

    res.json({
      success: true,
      data: {
        ...meeting,
        qr_code_url: qrCodeUrl,
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
    const isAdmin = req.user?.role === 'admin';

    // Verify meeting exists and user has permission
    const query = isAdmin
      ? db('meetings').where({ id })
      : db('meetings').where({ id, host_id: userId });

    const meeting = await query.first();

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

    // Check for time conflicts if meeting_time or duration_minutes changed
    if (updates.meeting_time || updates.duration_minutes) {
      const newTime = updates.meeting_time || meeting.meeting_time;
      const newDuration = updates.duration_minutes || meeting.duration_minutes;

      const conflictingMeeting = await buildOverlapQuery(
        db('meetings').select('id').whereNot('id', id).limit(1),
        meeting.host_id,
        newTime,
        newDuration
      ).first();

      if (conflictingMeeting) {
        res.status(409).json({
          success: false,
          error: {
            code: 'TIME_SLOT_UNAVAILABLE',
            message: 'This host is already booked for the selected time. Please choose another slot.'
          }
        });
        return;
      }
    }

    await db('meetings').where({ id }).update({
      ...updates,
      updated_at: new Date()
    });

    // Emit real-time update
    io.emit('meeting:updated', { meeting_id: id });

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
    const isAdmin = req.user?.role === 'admin';

    const query = isAdmin
      ? db('meetings').where({ id })
      : db('meetings').where({ id, host_id: userId });

    const meeting = await query.first();

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
