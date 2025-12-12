import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { unread, type, page = 1, limit = 20 } = req.query;
    const userId = req.user!.id;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db('notifications')
      .where('recipient_id', userId)
      .orderBy('created_at', 'desc');

    if (unread === 'true') {
      query = query.whereNull('read_at');
    }

    if (type) {
      query = query.where('type', type as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const notifications = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: notifications,
      meta: {
        total: parseInt(count as string),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(parseInt(count as string) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch notifications'
      }
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await db('notifications')
      .where({ id, recipient_id: userId })
      .update({ read_at: new Date() });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark notification as read'
      }
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    await db('notifications')
      .where({ recipient_id: userId })
      .whereNull('read_at')
      .update({ read_at: new Date() });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark all notifications as read'
      }
    });
  }
};
