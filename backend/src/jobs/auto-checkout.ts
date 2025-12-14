import db from '../config/database';
import logger from '../utils/logger';
import cron from 'node-cron';

/**
 * Auto-checkout visitors 2 hours after meeting end time
 */
export const runAutoCheckout = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const result = await db('visitors')
      .join('meetings', 'visitors.meeting_id', 'meetings.id')
      .whereNull('visitors.check_out_time')
      .whereNotNull('visitors.check_in_time')
      .whereRaw(`(meetings.meeting_time + (meetings.duration_minutes::text || ' minutes')::interval) < ?::timestamp`, [twoHoursAgo])
      .update({
        'visitors.check_out_time': new Date(),
        'visitors.updated_at': new Date()
      });

    if (result > 0) {
      logger.info(`Auto-checkout: ${result} visitors automatically checked out`);
    }
  } catch (error) {
    logger.error('Error in auto-checkout job:', error);
  }
};

/**
 * Schedule auto-checkout to run every 15 minutes
 */
export const startAutoCheckoutJob = () => {
  cron.schedule('*/15 * * * *', runAutoCheckout);
  logger.info('Auto-checkout job scheduled (runs every 15 minutes)');
};
