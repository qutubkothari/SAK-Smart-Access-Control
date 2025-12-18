import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';
import auditService from '../services/audit.service';
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

    // Check if already checked in (prompt for checkout confirmation)
    const meetingEndTime = new Date(meeting.meeting_time);
    const durationMinutes = Number(meeting.duration_minutes || 60);
    meetingEndTime.setMinutes(meetingEndTime.getMinutes() + durationMinutes);
    
    if (visitor.check_in_time && !visitor.check_out_time) {
      // Already checked in - return checkout prompt
      res.status(200).json({
        success: true,
        action_required: 'CHECKOUT_CONFIRMATION',
        data: {
          visitor_id: visitor.id,
          visitor_name: visitor.name,
          company: visitor.company,
          check_in_time: visitor.check_in_time,
          message: 'Visitor is already checked in. Scan again to checkout?'
        }
      });
      return;
    }

    // Allow re-entry if:
    // 1. Previously checked out OR
    // 2. Still within meeting timeframe (for multiple entries)
    let currentTime = new Date();
    const canReEnter = visitor.check_out_time || (currentTime <= meetingEndTime);
    
    if (!canReEnter) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MEETING_ENDED',
          message: 'Meeting has ended. Cannot check in again.'
        }
      });
      return;
    }

    // Check if check-in is within allowed time window:
    // - 30 minutes before meeting time
    // - 15 minutes after meeting time
    const meetingTime = new Date(meeting.meeting_time);
    currentTime = new Date();
    const thirtyMinutesBefore = new Date(meetingTime.getTime() - 30 * 60 * 1000);
    const fifteenMinutesAfter = new Date(meetingTime.getTime() + 15 * 60 * 1000);

    if (currentTime < thirtyMinutesBefore) {
      const minutesUntilWindow = Math.ceil((thirtyMinutesBefore.getTime() - currentTime.getTime()) / 60000);
      res.status(400).json({
        success: false,
        error: {
          code: 'TOO_EARLY',
          message: `Check-in opens 30 minutes before meeting. Please wait ${minutesUntilWindow} more minutes.`
        }
      });
      return;
    }

    if (currentTime > fifteenMinutesAfter) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TOO_LATE',
          message: 'Check-in window closed. Meeting check-in is allowed until 15 minutes after scheduled time.'
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
    const checkInTime = new Date();
    await db('visitors')
      .where({ id: visitor.id })
      .update({
        check_in_time: checkInTime,
        checked_in_by: req.user!.id,
        photo_url: photoUrl,
        check_out_time: null  // Reset checkout time for re-entry
      });

    // Log check-in event
    await auditService.log({
      user_id: req.user!.id,
      action_type: 'CREATE',
      entity_type: 'visitor_checkin',
      entity_id: visitor.id,
      new_values: { check_in_time: checkInTime, meeting_id: meeting.id, photo_updated: !!photoUrl },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      description: `Visitor ${visitor.name} checked in for meeting ${meeting.id}`
    });

    // Log access entry (for multiple entries tracking)
    await db('visitor_access_log').insert({
      visitor_id: visitor.id,
      meeting_id: meeting.id,
      entry_time: checkInTime,
      entry_point: 'main_reception',
      checked_in_by: req.user!.id
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

export const checkOutVisitorByQR = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Verify QR code
    const qrData = await QRCodeService.verifyQrCodeInput(qr_code);

    if (!qrData || qrData.error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QR_CODE',
          message: qrData?.message || 'QR code is invalid or expired'
        }
      });
      return;
    }

    // Get visitor
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

    // Check if visitor is checked in
    if (!visitor.check_in_time) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NOT_CHECKED_IN',
          message: 'Visitor has not checked in yet'
        }
      });
      return;
    }

    // Check if already checked out
    if (visitor.check_out_time) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_CHECKED_OUT',
          message: 'Visitor already checked out'
        }
      });
      return;
    }

    // Check out visitor
    const checkOutTime = new Date();
    await db('visitors')
      .where({ id: visitor.id })
      .update({
        check_out_time: checkOutTime
      });

    // Log check-out event
    await auditService.log({
      user_id: req.user!.id,
      action_type: 'UPDATE',
      entity_type: 'visitor_checkout',
      entity_id: visitor.id,
      old_values: { check_in_time: visitor.check_in_time },
      new_values: { check_out_time: checkOutTime },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      description: `Visitor ${visitor.name} checked out from meeting ${visitor.meeting_id}`
    });

    // Update access log
    await db('visitor_access_log')
      .where({ visitor_id: visitor.id })
      .whereNull('exit_time')
      .orderBy('entry_time', 'desc')
      .limit(1)
      .update({
        exit_time: checkOutTime,
        checked_out_by: req.user!.id
      });

    logger.info(`Visitor checked out via QR: ${visitor.name}`);

    // Emit real-time update
    io.emit('visitor:checkout', {
      visitor_id: visitor.id,
      meeting_id: visitor.meeting_id,
      check_out_time: new Date()
    });

    res.json({
      success: true,
      data: {
        visitor: {
          id: visitor.id,
          name: visitor.name,
          company: visitor.company,
          check_in_time: visitor.check_in_time,
          check_out_time: new Date()
        }
      },
      message: 'Visitor checked out successfully'
    });
  } catch (error) {
    logger.error('Error checking out visitor by QR:', error);
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
      .orderByRaw('visitors.check_in_time DESC NULLS FIRST, visitors.created_at DESC');

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
        .select('its_id', 'name', 'email', 'phone', 'company', 'city', 'state')
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
              company: directory.company,
              city: directory.city,
              state: directory.state
            }
          }
        });
        return;
      }

      const prevByIts = await db('visitors')
        .select('its_id', 'name', 'email', 'phone', 'company', 'city', 'state')
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
              company: prevByIts.company,
              city: prevByIts.city,
              state: prevByIts.state
            }
          }
        });
        return;
      }
    }

    if (phone) {
      const directoryByPhone = await db('visitor_directory')
        .select('its_id', 'name', 'email', 'phone', 'company', 'city', 'state')
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
              company: directoryByPhone.company,
              city: directoryByPhone.city,
              state: directoryByPhone.state
            }
          }
        });
        return;
      }

      const prev = await db('visitors')
        .select('its_id', 'name', 'email', 'phone', 'company', 'city', 'state')
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
              company: prev.company,
              city: prev.city,
              state: prev.state
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
