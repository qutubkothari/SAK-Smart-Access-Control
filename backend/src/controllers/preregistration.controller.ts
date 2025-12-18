import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';
import db from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Visitor Pre-Registration Controller
 * Allows visitors to register themselves before their visit
 */

export const preRegisterVisitor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      its_id,
      name, 
      email, 
      phone, 
      company, 
      city,
      state,
      visitor_type,
      host_its_id, 
      visit_date, 
      purpose,
      id_proof_type,
      id_proof_number,
      nda_accepted
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !host_its_id || !visit_date) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, email, phone, host_its_id, visit_date'
        }
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
      return;
    }

    // Validate phone format
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone)) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_PHONE',
          message: 'Invalid phone number format'
        }
      });
      return;
    }

    // Check if visitor is blacklisted
    const blacklisted = await db('blacklist')
      .where({ is_active: true })
      .andWhere(function() {
        this.where('email', email).orWhere('phone', phone);
      })
      .first();

    if (blacklisted) {
      logger.warn(`Blacklisted visitor attempted pre-registration: ${email}`);
      res.status(403).json({
        success: false,
        error: {
          code: 'BLACKLISTED',
          message: 'Access denied. Please contact security.'
        }
      });
      return;
    }

    // Find host by ITS ID
    const host = await db('users')
      .where({ its_id: host_its_id, is_active: true })
      .first();

    if (!host) {
      res.status(404).json({
        success: false,
        error: {
          code: 'HOST_NOT_FOUND',
          message: 'Host not found or inactive'
        }
      });
      return;
    }

    // Check if meeting already exists (avoid duplicates)
    const existingMeeting = await db('meetings')
      .where({
        host_id: host.id,
        meeting_time: new Date(visit_date),
        status: 'scheduled'
      })
      .whereExists(function() {
        this.select('*')
          .from('visitors')
          .whereRaw('visitors.meeting_id = meetings.id')
          .andWhere('visitors.email', email);
      })
      .first();

    if (existingMeeting) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_REGISTERED',
          message: 'You are already registered for a meeting at this time'
        }
      });
      return;
    }

    // Create meeting
    const [meeting] = await db('meetings')
      .insert({
        host_id: host.id,
        meeting_time: new Date(visit_date),
        duration_minutes: 60,
        location: 'Reception Area',
        purpose: purpose || 'Pre-registered Visit',
        status: 'scheduled'
      })
      .returning('*');

    // Calculate QR expiry (24 hours after meeting)
    const qrExpiresAt = new Date(visit_date);
    qrExpiresAt.setHours(qrExpiresAt.getHours() + 24);

    const visitorId = uuidv4();

    // Generate QR code (qr_code is UNIQUE+NOT NULL)
    const qrCode = await QRCodeService.generateQRCode(meeting.id, visitorId, email, qrExpiresAt);

    // Create visitor record with generated QR
    const [visitor] = await db('visitors')
      .insert({
        id: visitorId,
        meeting_id: meeting.id,
        its_id: its_id || null,
        name,
        email,
        phone,
        company: company || null,
        city: city || null,
        state: state || null,
        visitor_type: visitor_type || 'guest',
        id_proof_type: id_proof_type || null,
        id_proof_number: id_proof_number || null,
        purpose_of_visit: purpose || 'Pre-registered Visit',
        nda_signed: nda_accepted || false,
        nda_signed_at: nda_accepted ? new Date() : null,
        qr_code: qrCode.token,
        qr_code_expires_at: qrExpiresAt
      })
      .returning('*');

    // Send notification to visitor
    await NotificationService.sendMeetingInvite(
      { ...visitor, qr_code: qrCode.token },
      meeting,
      qrCode.image,
      qrCode.qrId
    );

    // Notify host about pre-registration
    await db('notifications').insert({
      recipient_id: host.id,
      type: 'visitor_preregistered',
      channel: 'email',
      subject: 'New Visitor Pre-Registration',
      message: `${name} from ${company || 'N/A'} has pre-registered for a visit on ${new Date(visit_date).toLocaleDateString()}`,
      metadata: {
        visitor_name: name,
        visitor_email: email,
        visitor_company: company,
        visit_date,
        meeting_id: meeting.id
      },
      status: 'pending',
      created_at: new Date()
    });

    logger.info(`Visitor pre-registered: ${visitor.id} for host ${host.its_id}`);

    res.status(201).json({
      success: true,
      message: 'Pre-registration successful! QR code sent to your email.',
      data: {
        visitor_id: visitor.id,
        meeting_id: meeting.id,
        qr_code: qrCode.image,
        host_name: host.name,
        visit_date,
        status: 'pending_approval'
      }
    });
  } catch (error) {
    logger.error('Error in pre-registration:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete pre-registration'
      }
    });
  }
};

export const getPreRegisteredVisitors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { date } = req.query;

    let query = db('visitors')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .where('meetings.host_id', userId)
      .whereNull('visitors.check_in_time')
      .select('visitors.*', 'meetings.meeting_time', 'meetings.location');

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.whereBetween('meetings.meeting_time', [startOfDay, endOfDay]);
    }

    const visitors = await query.orderBy('meetings.meeting_time', 'desc');

    res.json({
      success: true,
      data: visitors
    });
  } catch (error) {
    logger.error('Error fetching pre-registered visitors:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pre-registered visitors'
      }
    });
  }
};

export const uploadVisitorPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitor_id } = req.params;
    
    if (!req.file) {
      res.status(422).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No photo uploaded'
        }
      });
      return;
    }

    // Verify visitor exists
    const visitor = await db('visitors')
      .where({ id: visitor_id })
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

    // In production, upload to S3/CloudStorage
    // For now, we'll use base64 data URL
    const photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Update visitor with photo
    await db('visitors')
      .where({ id: visitor_id })
      .update({
        photo_url: photoBase64,
        updated_at: new Date()
      });

    logger.info(`Photo uploaded for visitor: ${visitor_id}`);

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photo_url: photoBase64
      }
    });
  } catch (error) {
    logger.error('Error uploading photo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload photo'
      }
    });
  }
};

export const approvePreRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitor_id } = req.params;
    const userId = req.user!.id;

    // Get visitor with meeting
    const visitor = await db('visitors')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .where('visitors.id', visitor_id)
      .where('meetings.host_id', userId)
      .select('visitors.*', 'meetings.id as meeting_id', 'meetings.host_id')
      .first();

    if (!visitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VISITOR_NOT_FOUND',
          message: 'Visitor not found or you do not have permission'
        }
      });
      return;
    }

    // Update meeting status to approved
    await db('meetings')
      .where({ id: visitor.meeting_id })
      .update({
        status: 'scheduled',
        updated_at: new Date()
      });

    // Send approval notification to visitor
    await db('notifications').insert({
      recipient_id: userId,
      type: 'visitor_approved',
      channel: 'email',
      subject: 'Visit Approved',
      message: `Your visit request has been approved. Please bring your QR code on ${new Date(visitor.meeting_time).toLocaleDateString()}.`,
      metadata: {
        visitor_email: visitor.email,
        visitor_name: visitor.name
      },
      status: 'pending',
      created_at: new Date()
    });

    logger.info(`Pre-registration approved: ${visitor_id} by ${userId}`);

    res.json({
      success: true,
      message: 'Visitor approved successfully'
    });
  } catch (error) {
    logger.error('Error approving visitor:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to approve visitor'
      }
    });
  }
};
