import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

const buildStats = async (opts: { hostId?: string }) => {
  const { hostId } = opts;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseMeetingsQuery = () => {
    const q = db('meetings').whereBetween('meeting_time', [today, tomorrow]);
    return hostId ? q.andWhere('host_id', hostId) : q;
  };

  const [
    todayMeetings,
    activeVisitors,
    completedMeetings,
    noShows,
    pendingCheckIns,
    totalVisitorsToday,
  ] = await Promise.all([
    baseMeetingsQuery().clone().count('* as count').first(),
    (() => {
      if (!hostId) {
        return db('visitors')
          .whereNotNull('check_in_time')
          .whereNull('check_out_time')
          .count('* as count')
          .first();
      }
      return db('visitors')
        .join('meetings', 'visitors.meeting_id', 'meetings.id')
        .where('meetings.host_id', hostId)
        .whereNotNull('visitors.check_in_time')
        .whereNull('visitors.check_out_time')
        .count('* as count')
        .first();
    })(),
    baseMeetingsQuery().clone().where('status', 'completed').count('* as count').first(),
    // Legacy field; status 'no_show' isn't used yet so this is typically 0.
    baseMeetingsQuery().clone().where('status', 'no_show').count('* as count').first(),
    (() => {
      const q = db('visitors')
        .join('meetings', 'visitors.meeting_id', 'meetings.id')
        .whereBetween('meetings.meeting_time', [today, tomorrow])
        .whereNull('visitors.check_in_time');
      return hostId ? q.andWhere('meetings.host_id', hostId).count('* as count').first() : q.count('* as count').first();
    })(),
    (() => {
      // Visitors checked in today (any host unless hostId specified)
      const q = db('visitors')
        .whereBetween('check_in_time', [today, tomorrow])
        .count('* as count')
        .first();
      if (!hostId) return q;
      return db('visitors')
        .join('meetings', 'visitors.meeting_id', 'meetings.id')
        .where('meetings.host_id', hostId)
        .whereBetween('visitors.check_in_time', [today, tomorrow])
        .count('* as count')
        .first();
    })(),
  ]);

  const upcomingMeetingsQuery = db('meetings')
    .leftJoin('users', 'meetings.host_id', 'users.id')
    .where('meetings.meeting_time', '>=', today)
    .where('meetings.meeting_time', '<', tomorrow)
    .whereNot('meetings.status', 'cancelled')
    .select([
      'meetings.*',
      'users.first_name as host_first_name',
      'users.last_name as host_last_name'
    ])
    .orderBy('meetings.meeting_time', 'asc')
    .limit(5);

  const upcomingMeetings = await (hostId ? upcomingMeetingsQuery.andWhere('meetings.host_id', hostId) : upcomingMeetingsQuery);

  // Enrich upcoming meetings with visitor info
  if (upcomingMeetings.length > 0) {
    const meetingIds = upcomingMeetings.map((m: any) => m.id);
    const visitors = await db('visitors')
      .whereIn('meeting_id', meetingIds)
      .select('meeting_id', 'full_name');

    upcomingMeetings.forEach((meeting: any) => {
      const meetingVisitors = visitors.filter((v: any) => v.meeting_id === meeting.id);
      meeting.host_name = `${meeting.host_first_name} ${meeting.host_last_name}`;
      meeting.visitor_names = meetingVisitors.map((v: any) => v.full_name).join(', ');
      delete meeting.host_first_name;
      delete meeting.host_last_name;
    });
  }

  const recentVisitorsQuery = db('visitors')
    .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
    .leftJoin('users', 'meetings.host_id', 'users.id')
    .select(
      'visitors.*',
      'meetings.meeting_time',
      'meetings.location',
      'meetings.host_id',
      'users.first_name as host_first_name',
      'users.last_name as host_last_name'
    )
    .whereNotNull('visitors.check_in_time')
    .orderBy('visitors.check_in_time', 'desc')
    .limit(5);

  const recentVisitors = await (hostId ? recentVisitorsQuery.andWhere('meetings.host_id', hostId) : recentVisitorsQuery);

  // Enrich recent visitors with host name
  recentVisitors.forEach((visitor: any) => {
    visitor.host_name = `${visitor.host_first_name} ${visitor.host_last_name}`;
    delete visitor.host_first_name;
    delete visitor.host_last_name;
  });

  // This week's stats (legacy)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const weekMeetingsQuery = db('meetings').where('meeting_time', '>=', weekStart);
  const weekMeetings = await (hostId ? weekMeetingsQuery.andWhere('host_id', hostId).count('* as count').first() : weekMeetingsQuery.count('* as count').first());

  const weekVisitorsQuery = db('visitors')
    .leftJoin('meetings', 'visitors.meeting_id', 'meetings.id')
    .where('meetings.meeting_time', '>=', weekStart);
  const weekVisitors = await (hostId
    ? weekVisitorsQuery.andWhere('meetings.host_id', hostId).countDistinct('visitors.email as count').first()
    : weekVisitorsQuery.countDistinct('visitors.email as count').first());

  const popularTimesQuery = db('meetings')
    .whereBetween('meeting_time', [weekStart, tomorrow])
    .select(db.raw('EXTRACT(HOUR FROM meeting_time) as hour'))
    .count('* as count')
    .groupBy('hour')
    .orderBy('count', 'desc')
    .limit(5);

  const popularTimes = await (hostId ? popularTimesQuery.andWhere('host_id', hostId) : popularTimesQuery);

  const parsedTodayMeetings = parseInt((todayMeetings as any)?.count as string || '0');
  const parsedActiveVisitors = parseInt((activeVisitors as any)?.count as string || '0');
  const parsedCompletedMeetings = parseInt((completedMeetings as any)?.count as string || '0');
  const parsedNoShows = parseInt((noShows as any)?.count as string || '0');
  const parsedPendingCheckIns = parseInt((pendingCheckIns as any)?.count as string || '0');
  const parsedTotalVisitorsToday = parseInt((totalVisitorsToday as any)?.count as string || '0');

  return {
    // Frontend shape
    todayMeetings: parsedTodayMeetings,
    activeVisitors: parsedActiveVisitors,
    pendingCheckIns: parsedPendingCheckIns,
    totalVisitorsToday: parsedTotalVisitorsToday,
    upcomingMeetings,
    recentVisitors,
    // Legacy shape for compatibility
    today: {
      total_meetings: parsedTodayMeetings,
      active_visitors: parsedActiveVisitors,
      completed_meetings: parsedCompletedMeetings,
      no_shows: parsedNoShows,
    },
    this_week: {
      total_meetings: parseInt((weekMeetings as any)?.count as string || '0'),
      unique_visitors: parseInt((weekVisitors as any)?.count as string || '0'),
    },
    popular_times: popularTimes,
  };
};

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await buildStats({});
    res.json({
      success: true,
      data: stats
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

export const getHostDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hostId = req.user!.id;
    const stats = await buildStats({ hostId });
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching host dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch host dashboard stats' }
    });
  }
};

export const getReceptionistDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // For now, receptionist dashboard mirrors system-wide stats.
    const stats = await buildStats({});
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching receptionist dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch receptionist dashboard stats' }
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
