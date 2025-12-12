import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';
import db from '../config/database';
import logger from '../utils/logger';
import { io } from '../server';

export const checkInVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { qr_code } = req.body;

    if (!qr_code) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'QR code is required'
        }
      });
      return;
    }

    // Verify JWT-based QR code (with one-time use enforcement)
    const qrData = await QRCodeService.verifyQRCode(qr_code);

    if (!qrData) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QR_CODE',
          message: 'QR code is invalid or expired'
        }
      });
      return;
    }

    // Check if QR was already used (replay attack)
    if (qrData.error === 'QR_CODE_ALREADY_USED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'QR_CODE_ALREADY_USED',
          message: qrData.message
        }
      });
      return;
    }

    // Check if QR expired
    if (qrData.error === 'QR_CODE_EXPIRED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'QR_CODE_EXPIRED',
          message: qrData.message
        }
      });
      return;
    }

    // Get visitor by ID from JWT claim
    const visitor = await db('visitors')
      .where({ id: qrData.visitor_id })
      .first();

    if (!visitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VISITOR_NOT_FOUND',
          message: 'Visitor not found'
        }
      });
      return;
    }

    // Check if already checked in
    if (visitor.check_in_time) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_CHECKED_IN',
          message: 'Visitor already checked in'
        }
      });
      return;
    }

    // Check blacklist
    const blacklisted = await db('blacklist')
      .where({ is_active: true })
      .andWhere(function() {
        this.where('email', visitor.email).orWhere('phone', visitor.phone);
      })
      .first();

    if (blacklisted) {
      logger.warn(`Blacklisted visitor attempted check-in: ${visitor.email}`);
      res.status(403).json({
        success: false,
        error: {
          code: 'BLACKLISTED',
          message: 'Visitor is blacklisted'
        }
      });
      return;
    }

    // Check-in visitor
    await db('visitors')
      .where({ id: visitor.id })
      .update({
        check_in_time: new Date(),
        checked_in_by: req.user!.id
      });

    // Get meeting and host info
    const meeting = await db('meetings')
      .where({ id: visitor.meeting_id })
      .first();

    const host = await db('users')
      .where({ id: meeting.host_id })
      .first();

    // Send real-time notification to host
    await NotificationService.sendVisitorArrivalNotification(host, visitor, meeting);

    // Emit socket event
    io.to(`user_${host.id}`).emit('visitor_arrived', {
      visitor_name: visitor.name,
      meeting_time: meeting.meeting_time,
      location: meeting.location
    });

    logger.info(`Visitor checked in: ${visitor.name} for meeting ${meeting.id}`);

    res.json({
      success: true,
      data: {
        visitor: {
          name: visitor.name,
          company: visitor.company,
          photo_url: visitor.photo_url
        },
        meeting: {
          host_name: host.name,
          location: meeting.location,
          time: meeting.meeting_time
        },
        notification_sent: true
      }
    });
  } catch (error) {
    logger.error('Error checking in visitor:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check in visitor'
      }
    });
  }
};

export const checkOutVisitor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await db('visitors')
      .where({ id })
      .update({
        check_out_time: new Date()
      });

    logger.info(`Visitor checked out: ${id}`);

    res.json({
      success: true,
      message: 'Visitor checked out successfully'
    });
  } catch (error) {
    logger.error('Error checking out visitor:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check out visitor'
      }
    });
  }
};

export const getVisitors = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('visitors')
      .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
      .leftJoin('users', 'meetings.host_id', 'users.id')
      .select(
        'visitors.*',
        'meetings.meeting_time',
        'meetings.location',
        'users.name as host_name'
      )
      .orderBy('visitors.check_in_time', 'desc');

    if (status === 'checked_in') {
      query = query.whereNotNull('visitors.check_in_time').whereNull('visitors.check_out_time');
    } else if (status === 'checked_out') {
      query = query.whereNotNull('visitors.check_out_time');
    }

    const [{ count }] = await query.clone().count('visitors.id as count');
    const visitors = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: visitors,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching visitors:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch visitors'
      }
    });
  }
};

export const getVisitorById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const visitor = await db('visitors')
      .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
      .leftJoin('users', 'meetings.host_id', 'users.id')
      .select(
        'visitors.*',
        'meetings.meeting_time',
        'meetings.location',
        'meetings.purpose',
        'users.name as host_name',
        'users.email as host_email'
      )
      .where('visitors.id', id)
      .first();

    if (!visitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Visitor not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: visitor
    });
  } catch (error) {
    logger.error('Error fetching visitor:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch visitor'
      }
    });
  }
};

export const lookupVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const itsIdRaw = (req.query.its_id as string | undefined) ?? undefined;
    const phoneRaw = (req.query.phone as string | undefined) ?? undefined;

    const its_id = itsIdRaw?.trim();
    const phone = phoneRaw?.trim();

    if (!its_id && !phone) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Provide its_id or phone'
        }
      });
      return;
    }

    if (its_id) {
      const user = await db('users')
        .select('its_id', 'name', 'email', 'phone')
        .where({ its_id })
        .first();

      if (user) {
        res.json({
          success: true,
          data: {
            source: 'users',
            visitor: {
              its_id: user.its_id,
              name: user.name,
              email: user.email,
              phone: user.phone
            }
          }
        });
        return;
      }
    }

    if (phone) {
      const prev = await db('visitors')
        .select('name', 'email', 'phone', 'company')
        .where({ phone })
        .orderBy('updated_at', 'desc')
        .first();

      if (prev) {
        res.json({
          success: true,
          data: {
            source: 'visitors',
            visitor: {
              name: prev.name,
              email: prev.email,
              phone: prev.phone,
              company: prev.company
            }
          }
        });
        return;
      }
    }

    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'No matching record found'
      }
    });
  } catch (error) {
    logger.error('Error looking up visitor:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to lookup visitor'
      }
    });
  }
};
