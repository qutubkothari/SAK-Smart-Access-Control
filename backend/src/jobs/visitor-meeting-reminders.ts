import cron from 'node-cron';
import db from '../config/database';
import logger from '../utils/logger';
import NotificationService from '../services/notification.service';

const normalize = (v: any) => (v === null || v === undefined ? '' : String(v)).trim().toLowerCase();

const getReminderOffsetMinutes = (visitorCity: any, visitorState: any) => {
  const city = normalize(visitorCity);
  const state = normalize(visitorState);
  const officeState = normalize(process.env.OFFICE_STATE || 'Maharashtra');

  if (city && city.startsWith('mumbai')) return 2 * 60; // 2 hours
  if (state && officeState && state === officeState) return 24 * 60; // 1 day
  return 2 * 24 * 60; // 2 days
};

export const runVisitorMeetingReminders = async () => {
  const now = new Date();

  try {
    const upper = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const rows = await db('visitors')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .select([
        'visitors.id as visitor_id',
        'visitors.name as visitor_name',
        'visitors.phone as visitor_phone',
        'visitors.city as visitor_city',
        'visitors.state as visitor_state',
        'visitors.meeting_id as meeting_id',
        'meetings.host_id as host_id',
        'meetings.meeting_time as meeting_time',
        'meetings.duration_minutes as duration_minutes',
        'meetings.location as location',
        'meetings.status as status'
      ])
      .whereNull('visitors.reminder_sent_at')
      .whereNull('visitors.check_in_time')
      .whereNotNull('visitors.phone')
      .where('meetings.status', 'scheduled')
      .whereBetween('meetings.meeting_time', [now, upper]);

    let sentCount = 0;

    for (const row of rows as any[]) {
      const meetingTime = row.meeting_time ? new Date(row.meeting_time) : null;
      if (!meetingTime || Number.isNaN(meetingTime.getTime())) continue;

      const offsetMinutes = getReminderOffsetMinutes(row.visitor_city, row.visitor_state);
      const reminderAt = new Date(meetingTime.getTime() - offsetMinutes * 60 * 1000);

      if (now < reminderAt) continue;
      if (now >= meetingTime) continue;

      const visitor = {
        id: row.visitor_id,
        name: row.visitor_name,
        phone: row.visitor_phone
      };

      const meeting = {
        id: row.meeting_id,
        host_id: row.host_id,
        meeting_time: row.meeting_time,
        duration_minutes: row.duration_minutes,
        location: row.location
      };

      const sent = await NotificationService.sendVisitorMeetingReminder(visitor, meeting);
      if (sent) {
        await db('visitors')
          .where({ id: row.visitor_id })
          .whereNull('reminder_sent_at')
          .update({ reminder_sent_at: new Date(), updated_at: new Date() });
        sentCount += 1;
      }
    }

    if (sentCount > 0) {
      logger.info(`Visitor meeting reminders sent: ${sentCount}`);
    }
  } catch (error) {
    logger.error('Error in visitor meeting reminders job:', error);
  }
};

export const startVisitorMeetingRemindersJob = () => {
  cron.schedule('*/15 * * * *', runVisitorMeetingReminders);
  logger.info('Visitor meeting reminders job scheduled (runs every 15 minutes)');
};
