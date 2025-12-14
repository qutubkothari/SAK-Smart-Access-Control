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

    // Verify QR code input (supports short QR id/URL and legacy JWT tokens)
    const qrData = await QRCodeService.verifyQrCodeInput(qr_code);

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

    // Get meeting to check time window
    const meeting = await db('meetings')
      .where({ id: qrData.meeting_id })
      .first();

    if (!meeting) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MEETING_NOT_FOUND',
          message: 'Meeting not found'
        }
      });
      return;
    }

    // Check if check-in is within 30 minutes before meeting time
    const meetingTime = new Date(meeting.meeting_time);
    const now = new Date();
    const thirtyMinutesBefore = new Date(meetingTime.getTime() - 30 * 60 * 1000);

    if (now < thirtyMinutesBefore) {
      const minutesUntilWindow = Math.ceil((thirtyMinutesBefore.getTime() - now.getTime()) / 60000);
      res.status(400).json({
        success: false,
        error: {
          code: 'TOO_EARLY',
          message: `Check-in opens 30 minutes before meeting. Please wait ${minutesUntilWindow} more minutes.`
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

    // Handle photo upload if provided
    let photoUrl = visitor.photo_url;
    if (req.file) {
      // Convert to base64 data URL
      photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Check-in visitor
    await db('visitors')
      .where({ id: visitor.id })
      .update({
        check_in_time: new Date(),
        checked_in_by: req.user!.id,
        photo_url: photoUrl
      });

    // Get host info
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

    // Emit real-time update
    io.emit('visitor:checkin', {
      visitor_id: visitor.id,
      meeting_id: meeting.id,
      check_in_time: new Date()
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

    const visitor = await db('visitors').where({ id }).first();

    await db('visitors')
      .where({ id })
      .update({
        check_out_time: new Date()
      });

    logger.info(`Visitor checked out: ${id}`);

    // Emit real-time update
    io.emit('visitor:checkout', {
      visitor_id: id,
      meeting_id: visitor.meeting_id,
      check_out_time: new Date()
    });

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

    const countQuery = db('visitors');

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
      countQuery.whereNotNull('visitors.check_in_time').whereNull('visitors.check_out_time');
      query = query.whereNotNull('visitors.check_in_time').whereNull('visitors.check_out_time');
    } else if (status === 'checked_out') {
      countQuery.whereNotNull('visitors.check_out_time');
      query = query.whereNotNull('visitors.check_out_time');
    }

    const [{ count }] = await countQuery.count('visitors.id as count');

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
      const directory = await db('visitor_directory')
        .select('its_id', 'name', 'email', 'phone', 'company')
        .where({ its_id })
        .first();

      if (directory) {
        res.json({
          success: true,
          data: {
            source: 'visitor_directory',
            visitor: {
              its_id: directory.its_id,
              name: directory.name,
              email: directory.email,
              phone: directory.phone,
              company: directory.company
            }
          }
        });
        return;
      }

      const prevByIts = await db('visitors')
        .select('its_id', 'name', 'email', 'phone', 'company')
        .where({ its_id })
        .orderBy('updated_at', 'desc')
        .first();

      if (prevByIts) {
        res.json({
          success: true,
          data: {
            source: 'visitors',
            visitor: {
              its_id: prevByIts.its_id,
              name: prevByIts.name,
              email: prevByIts.email,
              phone: prevByIts.phone,
              company: prevByIts.company
            }
          }
        });
        return;
      }
    }

    if (phone) {
      const directoryByPhone = await db('visitor_directory')
        .select('its_id', 'name', 'email', 'phone', 'company')
        .where({ phone })
        .first();

      if (directoryByPhone) {
        res.json({
          success: true,
          data: {
            source: 'visitor_directory',
            visitor: {
              its_id: directoryByPhone.its_id,
              name: directoryByPhone.name,
              email: directoryByPhone.email,
              phone: directoryByPhone.phone,
              company: directoryByPhone.company
            }
          }
        });
        return;
      }

      const prev = await db('visitors')
        .select('its_id', 'name', 'email', 'phone', 'company')
        .where({ phone })
        .orderBy('updated_at', 'desc')
        .first();

      if (prev) {
        res.json({
          success: true,
          data: {
            source: 'visitors',
            visitor: {
              its_id: prev.its_id,
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

    // Backward-compatible fallback: allow lookups against users (employee directory)
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
