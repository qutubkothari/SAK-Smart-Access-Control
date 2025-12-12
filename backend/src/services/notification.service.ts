import db from '../config/database';
import logger from '../utils/logger';
import EmailService from './email.service';
import WhatsAppService from './whatsapp.service';

class NotificationService {
  /**
   * Send meeting invite to visitor with QR code
   */
  async sendMeetingInvite(visitor: any, meeting: any, qrCodeImage: string): Promise<void> {
    try {
      // Get host info
      const host = await db('users').where({ id: meeting.host_id }).first();

      const meetingTime = new Date(meeting.meeting_time).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Send email with QR code
      await EmailService.sendMeetingInvitation(
        visitor.email,
        visitor.name,
        host.name,
        meetingTime,
        meeting.location,
        meeting.purpose || '',
        qrCodeImage
      );

      // Send WhatsApp notification
      if (visitor.phone) {
        const whatsappMessage = `Hi ${visitor.name}! You have a meeting with ${host.name} at ${meeting.location} on ${meetingTime}. Your QR code has been sent to your email. Please check your inbox.`;
        await WhatsAppService.sendMessage(visitor.phone, whatsappMessage);
      }

      // Log notification
      await db('notifications').insert({
        recipient_id: host.id,
        type: 'meeting_created',
        channel: 'email',
        subject: 'Meeting Created',
        message: `Meeting created with ${visitor.name}`,
        status: 'sent',
        sent_at: new Date()
      });

      logger.info(`Meeting invite sent to ${visitor.email}`);
    } catch (error) {
      logger.error('Error sending meeting invite:', error);
      throw error;
    }
  }

  /**
   * Send visitor arrival notification to host
   */
  async sendVisitorArrivalNotification(host: any, visitor: any, meeting: any): Promise<void> {
    try {
      const arrivalTime = new Date().toLocaleString();

      // Send email
      await EmailService.sendVisitorArrivalNotification(
        host.email,
        host.name,
        visitor.name,
        visitor.company || '',
        meeting.location,
        arrivalTime
      );

      // Send WhatsApp notification
      if (host.phone) {
        await WhatsAppService.notifyHostVisitorArrived(
          host.phone,
          host.name,
          visitor.name,
          meeting.location
        );
      }

      // Log notification
      await db('notifications').insert({
        recipient_id: host.id,
        type: 'visitor_arrival',
        channel: 'email',
        subject: 'Visitor Arrived',
        message: `${visitor.name} has arrived for your meeting`,
        status: 'sent',
        sent_at: new Date()
      });

      logger.info(`Arrival notification sent to host ${host.its_id}`);
    } catch (error) {
      logger.error('Error sending arrival notification:', error);
    }
  }

  /**
   * Send meeting reminder to host
   */
  async sendMeetingReminder(host: any, meeting: any): Promise<void> {
    try {
      const meetingTime = new Date(meeting.meeting_time).toLocaleString();

      // Send email
      await EmailService.sendMeetingReminder(
        host.email,
        host.name,
        meetingTime,
        meeting.location
      );

      // Send WhatsApp
      if (host.phone) {
        await WhatsAppService.sendMeetingReminder(
          host.phone,
          host.name,
          meetingTime,
          meeting.location
        );
      }

      // Log notification
      await db('notifications').insert({
        recipient_id: host.id,
        type: 'meeting_reminder',
        channel: 'email',
        subject: 'Meeting Reminder',
        message: `Meeting at ${meeting.location}`,
        status: 'sent',
        sent_at: new Date()
      });

      // Update meeting reminder flag
      await db('meetings').where({ id: meeting.id }).update({ reminder_sent: true });

      logger.info(`Meeting reminder sent to host ${host.its_id}`);
    } catch (error) {
      logger.error('Error sending meeting reminder:', error);
    }
  }

  /**
   * Send meeting cancellation notice
   */
  async sendCancellationNotice(visitor: any, meeting: any): Promise<void> {
    try {
      const host = await db('users').where({ id: meeting.host_id }).first();
      const meetingTime = new Date(meeting.meeting_time).toLocaleString();

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">❌ Meeting Cancelled</h2>
            <p>Dear ${visitor.name},</p>
            <p>Your meeting with ${host.name} scheduled for ${meetingTime} at ${meeting.location} has been cancelled.</p>
            <p>For any queries, please contact ${host.email}</p>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail({
        to: visitor.email,
        subject: 'Meeting Cancelled',
        html: emailHtml
      });

      logger.info(`Cancellation notice sent to ${visitor.email}`);
    } catch (error) {
      logger.error('Error sending cancellation notice:', error);
    }
  }
}

export default new NotificationService();
