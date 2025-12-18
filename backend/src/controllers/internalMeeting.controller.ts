import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';
import QRCodeService from '../services/qrcode.service';
import NotificationService from '../services/notification.service';

/**
 * Check participant availability for internal meeting
 * Returns conflicts if any participant is already booked
 */
export const checkParticipantAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const { participant_its_ids, meeting_time, duration_minutes } = req.body;

    if (!participant_its_ids || !Array.isArray(participant_its_ids) || !meeting_time || !duration_minutes) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: participant_its_ids (array), meeting_time, duration_minutes'
        }
      });
      return;
    }

    const requestedDuration = Number(duration_minutes);

    // Get user IDs from ITS IDs
    const users = await db('users')
      .whereIn('its_id', participant_its_ids)
      .select('id', 'its_id', 'name', 'email', 'phone');

    const userIds = users.map(u => u.id);

    if (userIds.length === 0) {
      res.json({
        success: true,
        data: {
          conflicts: [],
          available_participants: [],
          conflicted_participants: []
        }
      });
      return;
    }

    // Find conflicting meetings for these participants
    const conflicts = await db('internal_meeting_participants as imp')
      .join('meetings as m', 'imp.meeting_id', 'm.id')
      .join('users as u', 'imp.user_id', 'u.id')
      .whereIn('imp.user_id', userIds)
      .where('m.status', '!=', 'cancelled')
      .andWhereRaw(
        `m.meeting_time < (?::timestamp + (?::text || ' minutes')::interval)`,
        [meeting_time, requestedDuration]
      )
      .andWhereRaw(
        `(m.meeting_time + (m.duration_minutes::text || ' minutes')::interval) > ?::timestamp`,
        [meeting_time]
      )
      .select(
        'm.id as meeting_id',
        'm.meeting_time',
        'm.duration_minutes',
        'm.purpose',
        'm.location',
        'u.id as user_id',
        'u.its_id',
        'u.name',
        'u.email',
        'u.phone'
      );

    // Group conflicts by user
    const conflictMap = new Map();
    conflicts.forEach(c => {
      if (!conflictMap.has(c.user_id)) {
        conflictMap.set(c.user_id, {
          user_id: c.user_id,
          its_id: c.its_id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          conflicting_meetings: []
        });
      }
      conflictMap.get(c.user_id).conflicting_meetings.push({
        meeting_id: c.meeting_id,
        meeting_time: c.meeting_time,
        duration_minutes: c.duration_minutes,
        purpose: c.purpose,
        location: c.location
      });
    });

    const conflictedParticipants = Array.from(conflictMap.values());
    const availableParticipants = users.filter(u => !conflictMap.has(u.id));

    res.json({
      success: true,
      data: {
        conflicts: conflicts.length > 0,
        available_participants: availableParticipants,
        conflicted_participants: conflictedParticipants
      }
    });
  } catch (error) {
    logger.error('Error checking participant availability:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check participant availability'
      }
    });
  }
};

/**
 * Create internal meeting with conflict override support
 * Supports secretary booking for employees and employee self-booking
 */
export const createInternalMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const {
      meeting_room_id,
      meeting_time,
      duration_minutes,
      purpose,
      participant_its_ids,
      override_conflicts = false,
      override_reason,
      primary_employee_its_id // The employee this meeting is for (if booked by secretary)
    } = req.body;

    const bookerId = req.user!.id;
    const bookerRole = req.user!.role;
    let organizerId = bookerId;
    let secretaryId = null;
    let primaryEmployeeId = null;

    // If booked by secretary, validate they can book for the primary employee
    if (bookerRole === 'secretary' && primary_employee_its_id) {
      const primaryEmployee = await db('users')
        .where({ its_id: primary_employee_its_id, is_active: true })
        .first();

      if (!primaryEmployee) {
        res.status(404).json({
          success: false,
          error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Primary employee not found' }
        });
        return;
      }

      // Check if secretary can book for this employee
      const assignment = await db('secretary_employee_assignments')
        .where({
          secretary_id: bookerId,
          employee_id: primaryEmployee.id,
          is_active: true
        })
        .first();

      if (!assignment) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to book meetings for this employee'
          }
        });
        return;
      }

      organizerId = primaryEmployee.id;
      secretaryId = bookerId;
      primaryEmployeeId = primaryEmployee.id;

      // Check employee availability blocks
      const endTime = new Date(new Date(meeting_time).getTime() + duration_minutes * 60000);
      const blocks = await db('employee_availability_blocks')
        .where('employee_id', primaryEmployeeId)
        .andWhere((builder) => {
          builder
            .where('start_time', '<', endTime.toISOString())
            .andWhere('end_time', '>', meeting_time);
        })
        .first();

      if (blocks && !override_conflicts) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMPLOYEE_BLOCKED',
            message: `${primaryEmployee.name} has blocked this time slot: ${blocks.reason}`,
            block: blocks
          }
        });
        return;
      }
    }

    if (!meeting_room_id || !meeting_time || !duration_minutes || !participant_its_ids || !Array.isArray(participant_its_ids)) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields'
        }
      });
      return;
    }

    const requestedDuration = Number(duration_minutes);

    // Get participant users
    const participants = await db('users')
      .whereIn('its_id', participant_its_ids)
      .select('id', 'its_id', 'name', 'email', 'phone');

    if (participants.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_PARTICIPANTS',
          message: 'No valid participants found'
        }
      });
      return;
    }

    const participantIds = participants.map(p => p.id);

    // Check for conflicts
    const conflicts = await db('internal_meeting_participants as imp')
      .join('meetings as m', 'imp.meeting_id', 'm.id')
      .whereIn('imp.user_id', participantIds)
      .where('m.status', '!=', 'cancelled')
      .andWhereRaw(
        `m.meeting_time < (?::timestamp + (?::text || ' minutes')::interval)`,
        [meeting_time, requestedDuration]
      )
      .andWhereRaw(
        `(m.meeting_time + (m.duration_minutes::text || ' minutes')::interval) > ?::timestamp`,
        [meeting_time]
      )
      .select('m.id as meeting_id', 'imp.user_id');

    if (conflicts.length > 0 && !override_conflicts) {
      res.status(409).json({
        success: false,
        error: {
          code: 'PARTICIPANT_CONFLICT',
          message: 'One or more participants have conflicting meetings',
          conflicts: conflicts
        }
      });
      return;
    }

    // Get room details
    const room = await db('meeting_rooms').where({ id: meeting_room_id }).first();
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

    // Check room capacity
    if (participants.length > room.capacity) {
      res.status(422).json({
        success: false,
        error: {
          code: 'EXCEEDS_CAPACITY',
          message: `Room capacity is ${room.capacity}, but ${participants.length} participants requested`
        }
      });
      return;
    }

    // Start transaction
    await db.transaction(async (trx) => {
      // If override, cancel conflicting meetings
      if (override_conflicts && conflicts.length > 0) {
        const conflictingMeetingIds = [...new Set(conflicts.map(c => c.meeting_id))];

        for (const conflictingMeetingId of conflictingMeetingIds) {
          // Update meeting status
          await trx('meetings')
            .where({ id: conflictingMeetingId })
            .update({ status: 'cancelled', updated_at: new Date() });

          // Get all participants of the cancelled meeting
          const cancelledParticipants = await trx('internal_meeting_participants as imp')
            .join('users as u', 'imp.user_id', 'u.id')
            .where('imp.meeting_id', conflictingMeetingId)
            .select('u.name', 'u.email', 'u.phone', 'u.its_id');

          // Get meeting details for notification
          const cancelledMeeting = await trx('meetings')
            .leftJoin('meeting_rooms', 'meetings.meeting_room_id', 'meeting_rooms.id')
            .where('meetings.id', conflictingMeetingId)
            .select(
              'meetings.meeting_time',
              'meetings.duration_minutes',
              'meetings.purpose',
              'meeting_rooms.name as room_name',
              'meeting_rooms.floor_number'
            )
            .first();

          // Send cancellation notifications to all participants
          for (const participant of cancelledParticipants) {
            const message = 
              `⚠️ Meeting Cancelled\n\n` +
              `Your meeting has been cancelled due to a scheduling conflict:\n` +
              `Time: ${new Date(cancelledMeeting.meeting_time).toLocaleString()}\n` +
              `Room: ${cancelledMeeting.room_name} (Floor ${cancelledMeeting.floor_number})\n` +
              `Purpose: ${cancelledMeeting.purpose || 'N/A'}\n\n` +
              `Reason: ${override_reason || 'Priority meeting scheduled'}\n\n` +
              `Please reschedule at your convenience.`;

            // Send WhatsApp
            if (participant.phone) {
              await NotificationService.sendWhatsAppMessage(participant.phone, message);
            }

            // Send Email
            if (participant.email) {
              await NotificationService.sendCancellationEmail(
                participant.email,
                participant.name,
                cancelledMeeting.meeting_time,
                cancelledMeeting.room_name,
                override_reason || 'Priority meeting scheduled'
              );
            }
          }

          // Log conflict override
          await trx('participant_conflicts').insert({
            new_meeting_id: null, // Will update after meeting creation
            conflicting_meeting_id: conflictingMeetingId,
            participant_user_id: conflicts.find(c => c.meeting_id === conflictingMeetingId)?.user_id,
            override_approved: true,
            approved_by: organizerId,
            override_reason: override_reason || 'Priority meeting'
          });
        }
      }

      // Create new meeting
      const [meeting] = await trx('meetings')
        .insert({
          host_id: organizerId,
          meeting_time,
          duration_minutes: requestedDuration,
          location: `${room.name} - Floor ${room.floor_number}`,
          purpose,
          status: 'scheduled',
          meeting_type: 'internal',
          meeting_room_id,
          booked_by_secretary_id: secretaryId
        })
        .returning('*');

      // Generate QR codes and add participants
      const qrCodes = [];
      for (const participant of participants) {
        const qrExpiresAt = new Date(meeting_time);
        qrExpiresAt.setHours(qrExpiresAt.getHours() + 24);

        const qrCode = await QRCodeService.generateQRCode(
          meeting.id,
          participant.id,
          participant.email,
          qrExpiresAt
        );

        // Insert participant
        await trx('internal_meeting_participants').insert({
          meeting_id: meeting.id,
          user_id: participant.id,
          qr_code: qrCode.token,
          qr_code_expires_at: qrExpiresAt,
          is_organizer: participant.id === organizerId,
          is_primary_employee: participant.id === primaryEmployeeId,
          status: 'invited'
        });

        qrCodes.push({
          participant_name: participant.name,
          its_id: participant.its_id,
          qr_code: qrCode.image,
          qr_id: qrCode.qrId
        });

        // Send notification
        const message =
          `📅 Internal Meeting Invitation\n\n` +
          `Hi ${participant.name},\n` +
          `You are invited to a meeting:\n\n` +
          `📍 ${room.name} - Floor ${room.floor_number}\n` +
          `🕐 ${new Date(meeting_time).toLocaleString()}\n` +
          `⏱️ Duration: ${requestedDuration} minutes\n` +
          `📝 Purpose: ${purpose || 'N/A'}\n\n` +
          `QR ID: ${qrCode.qrId}\n` +
          `Please use this QR code for check-in.\n\n` +
          `_SAK Smart Access Control_`;

        if (participant.phone) {
          const qrBuffer = Buffer.from(qrCode.image.replace(/^data:image\/png;base64,/, ''), 'base64');
          await NotificationService.sendWhatsAppMessageWithImage(participant.phone, message, qrBuffer);
        }
      }

      logger.info(`Internal meeting created: ${meeting.id} with ${participants.length} participants`);

      res.status(201).json({
        success: true,
        data: {
          meeting_id: meeting.id,
          meeting_type: 'internal',
          room: {
            id: room.id,
            name: room.name,
            floor: room.floor_number
          },
          participants: qrCodes,
          conflicts_overridden: override_conflicts && conflicts.length > 0
        }
      });
    });
  } catch (error) {
    logger.error('Error creating internal meeting:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create internal meeting'
      }
    });
  }
};

/**
 * Get internal meeting participants
 */
export const getInternalMeetingParticipants = async (req: AuthRequest, res: Response) => {
  try {
    const { meeting_id } = req.params;

    const participants = await db('internal_meeting_participants as imp')
      .join('users as u', 'imp.user_id', 'u.id')
      .where('imp.meeting_id', meeting_id)
      .select(
        'imp.id',
        'imp.user_id',
        'u.its_id',
        'u.name',
        'u.email',
        'u.phone',
        'imp.status',
        'imp.is_organizer',
        'imp.check_in_time',
        'imp.check_out_time',
        'imp.badge_number',
        'imp.qr_code_expires_at'
      )
      .orderBy('imp.is_organizer', 'desc')
      .orderBy('u.name', 'asc');

    res.json({
      success: true,
      data: participants
    });
  } catch (error) {
    logger.error('Error fetching internal meeting participants:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participants'
      }
    });
  }
};
