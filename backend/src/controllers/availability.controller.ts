import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

export const createAvailabilityBlock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id, start_time, end_time, reason, type, all_day } = req.body;
    const requesterId = req.user!.id;
    const isAdmin = req.user?.role === 'admin';

    if (!start_time || !end_time) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'start_time and end_time are required'
        }
      });
      return;
    }

    // Admin can specify user_id, otherwise use requester's ID
    const targetUserId = (isAdmin && user_id) ? user_id : requesterId;

    const [block] = await db('user_availability')
      .insert({
        user_id: targetUserId,
        start_time,
        end_time,
        reason,
        type: type || 'busy',
        all_day: all_day || false
      })
      .returning('*');

    res.status(201).json({
      success: true,
      data: block
    });
  } catch (error) {
    logger.error('Error creating availability block:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create availability block'
      }
    });
  }
};

export const getAvailabilityBlocks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const requesterId = req.user!.id;
    const isAdmin = req.user?.role === 'admin';

    // Users can see their own blocks, admins can see anyone's
    const targetUserId = isAdmin && user_id ? user_id : requesterId;

    let query = db('user_availability')
      .where('user_id', targetUserId)
      .orderBy('start_time', 'asc');

    if (start_date) {
      query = query.where('start_time', '>=', start_date as string);
    }

    if (end_date) {
      query = query.where('end_time', '<=', end_date as string);
    }

    const blocks = await query;

    res.json({
      success: true,
      data: blocks
    });
  } catch (error) {
    logger.error('Error fetching availability blocks:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch availability blocks'
      }
    });
  }
};

export const updateAvailabilityBlock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user!.id;

    const block = await db('user_availability')
      .where({ id, user_id: userId })
      .first();

    if (!block) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Availability block not found or unauthorized'
        }
      });
      return;
    }

    await db('user_availability')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: 'Availability block updated successfully'
    });
  } catch (error) {
    logger.error('Error updating availability block:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update availability block'
      }
    });
  }
};

export const deleteAvailabilityBlock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await db('user_availability')
      .where({ id, user_id: userId })
      .delete();

    if (result === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Availability block not found or unauthorized'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Availability block deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting availability block:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete availability block'
      }
    });
  }
};
