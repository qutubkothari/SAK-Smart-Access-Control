import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Issue NFC card to visitor (at reception/downstairs)
 */
export const issueVisitorCard = async (req: AuthRequest, res: Response) => {
  try {
    const {
      visitor_id,
      card_number,
      card_type = 'nfc',
      valid_from,
      valid_until,
      allowed_floors,
      allowed_zones
    } = req.body;

    if (!visitor_id || !card_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'visitor_id and card_number are required'
        }
      });
      return;
    }

    // Check if visitor exists
    const visitor = await db('visitors').where({ id: visitor_id }).first();
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

    // Check if card number already in use
    const existingCard = await db('visitor_access_cards')
      .where({ card_number, is_active: true })
      .first();

    if (existingCard) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CARD_IN_USE',
          message: 'This card number is already in use'
        }
      });
      return;
    }

    // Get meeting details for floor access
    const meeting = await db('meetings')
      .where({ id: visitor.meeting_id })
      .first();

    let floorsToAllow = allowed_floors || [];
    if (!floorsToAllow.length && meeting) {
      // Auto-determine floors based on meeting location
      const dept = await db('departments')
        .where({ id: meeting.department_id })
        .first();
      
      if (dept?.floor_number) {
        floorsToAllow = [0, dept.floor_number]; // Ground floor + meeting floor
      }
    }

    // Default validity: from now until meeting end + 1 hour
    const now = new Date();
    let cardValidFrom = valid_from ? new Date(valid_from) : now;
    let cardValidUntil = valid_until ? new Date(valid_until) : null;

    if (!cardValidUntil && meeting) {
      const meetingEnd = new Date(meeting.meeting_time);
      meetingEnd.setMinutes(meetingEnd.getMinutes() + (meeting.duration_minutes || 60) + 60);
      cardValidUntil = meetingEnd;
    }

    if (!cardValidUntil) {
      // Default: 8 hours from now
      cardValidUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    }

    const [card] = await db('visitor_access_cards')
      .insert({
        visitor_id,
        card_number,
        card_type,
        issued_at: now,
        valid_from: cardValidFrom,
        valid_until: cardValidUntil,
        allowed_floors: floorsToAllow,
        allowed_zones,
        is_active: true,
        issued_by: req.user!.id
      })
      .returning('*');

    logger.info(`Visitor card issued: ${card_number} for visitor ${visitor.name}`);

    res.json({
      success: true,
      message: 'Visitor card issued successfully',
      data: card,
      visitor: {
        id: visitor.id,
        name: visitor.name,
        company: visitor.company
      }
    });
  } catch (error) {
    logger.error('Error issuing visitor card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to issue visitor card'
      }
    });
  }
};

/**
 * Validate visitor card access (for elevator/floor scanner)
 */
export const validateVisitorCard = async (req: AuthRequest, res: Response) => {
  try {
    const { card_number, floor_number } = req.body;

    if (!card_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'card_number is required'
        }
      });
      return;
    }

    // Find active card
    const card = await db('visitor_access_cards')
      .leftJoin('visitors', 'visitor_access_cards.visitor_id', 'visitors.id')
      .where('visitor_access_cards.card_number', card_number)
      .where('visitor_access_cards.is_active', true)
      .select(
        'visitor_access_cards.*',
        'visitors.name as visitor_name',
        'visitors.company',
        'visitors.photo_url'
      )
      .first();

    if (!card) {
      res.status(404).json({
        success: false,
        access_granted: false,
        error: {
          code: 'CARD_NOT_FOUND',
          message: 'Card not found or inactive'
        }
      });
      return;
    }

    // Check validity time
    const now = new Date();
    if (now < new Date(card.valid_from) || now > new Date(card.valid_until)) {
      res.status(403).json({
        success: false,
        access_granted: false,
        error: {
          code: 'CARD_EXPIRED',
          message: 'Card has expired or not yet valid'
        }
      });
      return;
    }

    // Check floor access
    if (floor_number !== undefined) {
      const allowedFloors = card.allowed_floors || [];
      if (!allowedFloors.includes(Number(floor_number))) {
        res.status(403).json({
          success: false,
          access_granted: false,
          error: {
            code: 'FLOOR_ACCESS_DENIED',
            message: `Access to floor ${floor_number} not permitted`
          },
          allowed_floors: allowedFloors
        });
        return;
      }
    }

    res.json({
      success: true,
      access_granted: true,
      message: 'Access granted',
      card: {
        card_number: card.card_number,
        allowed_floors: card.allowed_floors,
        allowed_zones: card.allowed_zones,
        valid_until: card.valid_until
      },
      visitor: {
        name: card.visitor_name,
        company: card.company,
        photo_url: card.photo_url
      }
    });
  } catch (error) {
    logger.error('Error validating visitor card:', error);
    res.status(500).json({
      success: false,
      access_granted: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate card'
      }
    });
  }
};

/**
 * Log visitor card usage (elevator/floor access)
 */
export const logVisitorCardAccess = async (req: AuthRequest, res: Response) => {
  try {
    const {
      card_number,
      access_point_code,
      floor_number,
      building = 'Main',
      zone,
      access_method = 'nfc'
    } = req.body;

    if (!card_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'card_number is required'
        }
      });
      return;
    }

    // Get card and visitor
    const card = await db('visitor_access_cards')
      .where({ card_number, is_active: true })
      .first();

    if (!card) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CARD_NOT_FOUND',
          message: 'Card not found'
        }
      });
      return;
    }

    // Validate access
    const validation = await validateVisitorCardInternal(card_number, floor_number);
    
    let accessPoint: any;
    if (access_point_code) {
      accessPoint = await db('access_points')
        .where({ code: access_point_code })
        .first();
    }

    // Log access
    const [log] = await db('visitor_floor_access_logs')
      .insert({
        visitor_id: card.visitor_id,
        access_point_id: accessPoint?.id,
        card_id: card.id,
        entry_time: new Date(),
        access_method,
        card_number,
        floor_number: floor_number || accessPoint?.floor_number,
        building: building || accessPoint?.building,
        zone: zone || accessPoint?.zone,
        access_granted: validation.access_granted,
        denial_reason: validation.denial_reason
      })
      .returning('*');

    if (!validation.access_granted) {
      res.status(403).json({
        success: false,
        access_granted: false,
        error: {
          code: 'ACCESS_DENIED',
          message: validation.denial_reason
        }
      });
      return;
    }

    logger.info(`Visitor card access logged: ${card_number} at floor ${floor_number}`);

    res.json({
      success: true,
      access_granted: true,
      message: 'Access logged successfully',
      log
    });
  } catch (error) {
    logger.error('Error logging visitor card access:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log access'
      }
    });
  }
};

/**
 * Internal validation function
 */
async function validateVisitorCardInternal(
  card_number: string,
  floor_number?: number
): Promise<{ access_granted: boolean; denial_reason?: string }> {
  const card = await db('visitor_access_cards')
    .where({ card_number, is_active: true })
    .first();

  if (!card) {
    return { access_granted: false, denial_reason: 'Card not found' };
  }

  const now = new Date();
  if (now < new Date(card.valid_from) || now > new Date(card.valid_until)) {
    return { access_granted: false, denial_reason: 'Card expired' };
  }

  if (floor_number !== undefined) {
    const allowedFloors = card.allowed_floors || [];
    if (!allowedFloors.includes(Number(floor_number))) {
      return {
        access_granted: false,
        denial_reason: `Floor ${floor_number} not in allowed floors`
      };
    }
  }

  return { access_granted: true };
}

/**
 * Deactivate visitor card (on checkout)
 */
export const deactivateVisitorCard = async (req: AuthRequest, res: Response) => {
  try {
    const { card_number } = req.body;

    if (!card_number) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'card_number is required'
        }
      });
      return;
    }

    await db('visitor_access_cards')
      .where({ card_number })
      .update({
        is_active: false,
        deactivated_at: new Date(),
        updated_at: new Date()
      });

    logger.info(`Visitor card deactivated: ${card_number}`);

    res.json({
      success: true,
      message: 'Card deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating visitor card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to deactivate card'
      }
    });
  }
};

/**
 * Get visitor card details
 */
export const getVisitorCard = async (req: AuthRequest, res: Response) => {
  try {
    const { card_number } = req.params;

    const card = await db('visitor_access_cards')
      .leftJoin('visitors', 'visitor_access_cards.visitor_id', 'visitors.id')
      .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
      .where('visitor_access_cards.card_number', card_number)
      .select(
        'visitor_access_cards.*',
        'visitors.name as visitor_name',
        'visitors.company',
        'visitors.email',
        'visitors.phone',
        'meetings.location as meeting_location',
        'meetings.meeting_time'
      )
      .first();

    if (!card) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CARD_NOT_FOUND',
          message: 'Card not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    logger.error('Error fetching visitor card:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch card'
      }
    });
  }
};

/**
 * Get visitor card access logs
 */
export const getVisitorCardLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { card_number, visitor_id, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('visitor_floor_access_logs')
      .leftJoin('visitors', 'visitor_floor_access_logs.visitor_id', 'visitors.id')
      .leftJoin('visitor_access_cards', 'visitor_floor_access_logs.card_id', 'visitor_access_cards.id')
      .select(
        'visitor_floor_access_logs.*',
        'visitors.name as visitor_name',
        'visitors.company',
        'visitor_access_cards.card_number'
      )
      .orderBy('visitor_floor_access_logs.entry_time', 'desc');

    if (card_number) {
      query = query.where('visitor_floor_access_logs.card_number', card_number as string);
    }

    if (visitor_id) {
      query = query.where('visitor_floor_access_logs.visitor_id', visitor_id as string);
    }

    if (from_date) {
      query = query.where('visitor_floor_access_logs.entry_time', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('visitor_floor_access_logs.entry_time', '<=', to_date as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const logs = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: logs,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching visitor card logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch logs'
      }
    });
  }
};
