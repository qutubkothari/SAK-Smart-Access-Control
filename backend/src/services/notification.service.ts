import db from '../config/database';
import logger from '../utils/logger';
import EmailService from './email.service';
import WhatsAppService from './whatsapp.service';

const formatRange = (meeting: any): { dateLabel: string; startLabel: string; endLabel: string; rangeLabel: string } => {
  const start = new Date(meeting.meeting_time);
  const durationMinutes = Number(meeting.duration_minutes || 60);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const dateLabel = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const startLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endLabel = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const rangeLabel = `${dateLabel} ${startLabel} - ${endLabel}`;
  return { dateLabel, startLabel, endLabel, rangeLabel };
};

const dataUrlToBuffer = (dataUrl: string): Buffer | null => {
  try {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    return Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
};

class NotificationService {
  /**
   * Send meeting invite to visitor with QR code
   */
  async sendMeetingInvite(visitor: any, meeting: any, qrCodeImage: string): Promise<void> {
    try {
      // Get host info
      const host = await db('users').where({ id: meeting.host_id }).first();

      const { rangeLabel, dateLabel, startLabel, endLabel } = formatRange(meeting);

      // Send email with QR code
      await EmailService.sendMeetingInvitation(
        visitor.email,
        visitor.name,
        host.name,
        rangeLabel,
        meeting.location,
        meeting.purpose || '',
        qrCodeImage
      );

      // Send WhatsApp notification
      if (visitor.phone) {
        const details = `Hello ${visitor.name}\nYour meeting with ${host.name} is scheduled for ${dateLabel} ${startLabel} - ${endLabel} at ${meeting.location}.\n\nPlease find the attached QR code for meeting confirmation.`;
        const qrBuf = dataUrlToBuffer(qrCodeImage);
        if (qrBuf) {
          await WhatsAppService.sendQRCode(visitor.phone, visitor.name, `Meeting: ${dateLabel} ${startLabel} - ${endLabel}\nLocation: ${meeting.location}`, qrBuf);
          // Also send the plain-language confirmation message (easier for layman)
          await WhatsAppService.sendMessage(visitor.phone, details);
        } else {
          await WhatsAppService.sendMessage(visitor.phone, details);
        }
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
   * Notify host that a meeting has been scheduled (summary)
   */
  async sendHostMeetingScheduled(hostId: string, visitors: any[], meeting: any): Promise<void> {
    try {
      const host = await db('users').where({ id: hostId }).first();
      if (!host) return;

      const { rangeLabel, dateLabel, startLabel, endLabel } = formatRange(meeting);
      const visitorNames = (visitors || []).map((v) => v?.name).filter(Boolean);
      const visitorLabel = visitorNames.length === 1 ? visitorNames[0] : `${visitorNames[0] || 'Visitor'} and ${visitorNames.length - 1} others`;

      const whatsappMessage = `Hello ${host.name},\nYour meeting with ${visitorLabel} has been scheduled for ${dateLabel} from ${startLabel} - ${endLabel} at ${meeting.location}.`;

      if (host.phone) {
        await WhatsAppService.sendMessage(host.phone, whatsappMessage);
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>📅 Meeting Scheduled</h2>
            <p>Dear ${host.name},</p>
            <p>Your meeting has been scheduled.</p>
            <ul>
              <li><strong>When:</strong> ${rangeLabel}</li>
              <li><strong>Where:</strong> ${meeting.location}</li>
              <li><strong>With:</strong> ${visitorNames.join(', ') || 'Visitor'}</li>
            </ul>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail({
        to: host.email,
        subject: `Meeting Scheduled - ${rangeLabel}`,
        html: emailHtml
      });

      logger.info(`Host meeting scheduled notification sent to ${host.its_id}`);
    } catch (error) {
      logger.error('Error sending host meeting scheduled notification:', error);
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
