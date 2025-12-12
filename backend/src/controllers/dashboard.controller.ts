import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's stats
    const todayMeetings = await db('meetings')
      .whereBetween('meeting_time', [today, tomorrow])
      .count('* as count')
      .first();

    const activeVisitors = await db('visitors')
      .whereNotNull('check_in_time')
      .whereNull('check_out_time')
      .count('* as count')
      .first();

    const completedMeetings = await db('meetings')
      .whereBetween('meeting_time', [today, tomorrow])
      .where('status', 'completed')
      .count('* as count')
      .first();

    const noShows = await db('meetings')
      .whereBetween('meeting_time', [today, tomorrow])
      .where('status', 'no_show')
      .count('* as count')
      .first();

    // This week's stats
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekMeetings = await db('meetings')
      .where('meeting_time', '>=', weekStart)
      .count('* as count')
      .first();

    const weekVisitors = await db('visitors')
      .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
      .where('meetings.meeting_time', '>=', weekStart)
      .countDistinct('visitors.email as count')
      .first();

    // Popular times
    const popularTimes = await db('meetings')
      .whereBetween('meeting_time', [weekStart, tomorrow])
      .select(db.raw('EXTRACT(HOUR FROM meeting_time) as hour'))
      .count('* as count')
      .groupBy('hour')
      .orderBy('count', 'desc')
      .limit(5);

    res.json({
      success: true,
      data: {
        today: {
          total_meetings: parseInt(todayMeetings?.count as string || '0'),
          active_visitors: parseInt(activeVisitors?.count as string || '0'),
          completed_meetings: parseInt(completedMeetings?.count as string || '0'),
          no_shows: parseInt(noShows?.count as string || '0')
        },
        this_week: {
          total_meetings: parseInt(weekMeetings?.count as string || '0'),
          unique_visitors: parseInt(weekVisitors?.count as string || '0')
        },
        popular_times: popularTimes
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard stats'
      }
    });
  }
};

export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const recentActivity = await db('visitors')
      .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
      .leftJoin('users', 'meetings.host_id', 'users.id')
      .select(
        'visitors.name as visitor_name',
        'visitors.company',
        'visitors.check_in_time',
        'visitors.check_out_time',
        'meetings.location',
        'users.name as host_name'
      )
      .whereNotNull('visitors.check_in_time')
      .orderBy('visitors.check_in_time', 'desc')
      .limit(Number(limit));

    res.json({
      success: true,
      data: recentActivity
    });
  } catch (error) {
    logger.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch recent activity'
      }
    });
  }
};
