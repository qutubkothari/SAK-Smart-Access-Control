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

class NotificationService {
  private dataUrlToBuffer(dataUrl: string): Buffer | null {
    try {
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) return null;
      return Buffer.from(m[2], 'base64');
    } catch {
      return null;
    }
  }
  private summarizeMeetingChanges(before: any, after: any): string[] {
    const changes: string[] = [];

    const beforeTime = before?.meeting_time ? new Date(before.meeting_time).getTime() : null;
    const afterTime = after?.meeting_time ? new Date(after.meeting_time).getTime() : null;
    if (beforeTime !== null && afterTime !== null && beforeTime !== afterTime) {
      const b = new Date(before.meeting_time).toLocaleString();
      const a = new Date(after.meeting_time).toLocaleString();
      changes.push(`Time: ${b} → ${a}`);
    }

    const norm = (v: any) => (v === null || v === undefined ? '' : String(v)).trim();
    if (norm(before?.location) !== norm(after?.location)) {
      changes.push(`Location: ${norm(before?.location) || 'N/A'} → ${norm(after?.location) || 'N/A'}`);
    }
    if (norm(before?.room_number) !== norm(after?.room_number)) {
      changes.push(`Room: ${norm(before?.room_number) || 'N/A'} → ${norm(after?.room_number) || 'N/A'}`);
    }
    if (norm(before?.purpose) !== norm(after?.purpose)) {
      changes.push(`Purpose: ${norm(before?.purpose) || 'N/A'} → ${norm(after?.purpose) || 'N/A'}`);
    }

    const bDur = before?.duration_minutes === null || before?.duration_minutes === undefined ? null : Number(before.duration_minutes);
    const aDur = after?.duration_minutes === null || after?.duration_minutes === undefined ? null : Number(after.duration_minutes);
    if (bDur !== null && aDur !== null && bDur !== aDur) {
      changes.push(`Duration: ${bDur} min → ${aDur} min`);
    }

    if (norm(before?.status) !== norm(after?.status)) {
      changes.push(`Status: ${norm(before?.status) || 'N/A'} → ${norm(after?.status) || 'N/A'}`);
    }

    return changes;
  }

  /**
   * Send meeting update notice to visitor (WhatsApp)
   */
  async sendMeetingUpdateNoticeToVisitor(visitor: any, before: any, after: any): Promise<void> {
    try {
      if (!visitor?.phone) return;

      const host = await db('users').where({ id: after.host_id }).first();
      if (!host) return;

      const changes = this.summarizeMeetingChanges(before, after);
      if (changes.length === 0) return;

      const { rangeLabel } = formatRange(after);
      const lines = changes.map((c) => `- ${c}`).join('\n');

      const msg = `🔔 *Meeting Updated*\n\nHello ${visitor.name},\nYour meeting with ${host.name} has been updated.\n\nChanges:\n${lines}\n\nUpdated details:\nWhen: ${rangeLabel}\nWhere: ${after.location}\n\n_SAK Smart Access Control_`;

      await WhatsAppService.sendMessage(visitor.phone, msg);
      logger.info(`Meeting update notice sent to visitor ${visitor.id}`);
    } catch (error) {
      logger.error('Error sending meeting update notice to visitor:', error);
    }
  }

  /**
   * Send visitor meeting reminder (WhatsApp)
   */
  async sendVisitorMeetingReminder(visitor: any, meeting: any): Promise<boolean> {
    try {
      if (!visitor?.phone) return false;

      const host = await db('users').where({ id: meeting.host_id }).first();
      if (!host) return false;

      const { rangeLabel } = formatRange(meeting);
      const msg = `⏰ *Meeting Reminder*\n\nHello ${visitor.name},\nThis is a reminder for your meeting with ${host.name}.\n\nWhen: ${rangeLabel}\nWhere: ${meeting.location}\n\nPlease show your QR code at reception when you arrive.\n\n_SAK Smart Access Control_`;
      const sent = await WhatsAppService.sendMessage(visitor.phone, msg);
      return !!sent;
    } catch (error) {
      logger.error('Error sending visitor meeting reminder:', error);
      return false;
    }
  }

  /**
   * Send meeting invite to visitor with QR code
   */
  async sendMeetingInvite(visitor: any, meeting: any, qrCodeImage: string, qrId?: string): Promise<void> {
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

      // Send WhatsApp notification with QR image if available
      if (visitor.phone) {
        const qrBuf = this.dataUrlToBuffer(qrCodeImage);
        const caption =
          `🎫 Meeting Invitation\n\n` +
          `Hi ${visitor.name},\n` +
          `Your meeting with ${host.name} is scheduled for ${dateLabel} ${startLabel} - ${endLabel} at ${meeting.location}.\n\n` +
          `${qrId ? `QR ID: ${qrId}\n` : ''}` +
          `✅ Please show this QR at reception.\n\n` +
          `_SAK Smart Access Control_`;

        if (qrBuf) {
          const sent = await WhatsAppService.sendMessageWithImage(visitor.phone, caption, qrBuf);
          if (!sent) {
            // fallback to text
            await WhatsAppService.sendMessage(visitor.phone, caption);
          }
        } else {
          await WhatsAppService.sendMessage(visitor.phone, caption);
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
   * Send meeting invitation WITHOUT QR code (for delegations/groups)
   */
  async sendMeetingInviteWithoutQR(visitor: any, meeting: any, customMessage?: string): Promise<void> {
    try {
      // Get host info
      const host = await db('users').where({ id: meeting.host_id }).first();

      const { rangeLabel } = formatRange(meeting);
      
      // Determine message based on whether it's multi-day or single meeting
      let timeInfo = '';
      if (meeting.is_multi_day && meeting.visit_start_date && meeting.visit_end_date) {
        const startDate = new Date(meeting.visit_start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const endDate = new Date(meeting.visit_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        timeInfo = `Valid from ${startDate} to ${endDate}`;
      } else {
        timeInfo = `Scheduled for ${rangeLabel}`;
      }

      // Use custom message template if provided, otherwise use default
      const messageTemplate = customMessage || 
        `🤝 Meeting Invitation\n\n` +
        `Hi ${visitor.name},\n` +
        `You are invited to meet with ${host.name}.\n\n` +
        `${timeInfo}\n` +
        `📍 Location: ${meeting.location}\n` +
        `${meeting.purpose ? `📋 Purpose: ${meeting.purpose}\n` : ''}` +
        `\n✅ Please check in at the reception desk.\n` +
        `${meeting.is_multi_day ? '🎫 This is a multi-day access pass.\n' : ''}` +
        `\n_SAK Smart Access Control_`;

      // Send email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>🤝 Meeting Invitation</h2>
            <p>Dear ${visitor.name},</p>
            <p>You are invited to meet with <strong>${host.name}</strong>.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>📅 ${timeInfo}</strong></p>
              <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${meeting.location}</p>
              ${meeting.purpose ? `<p style="margin: 5px 0;"><strong>📋 Purpose:</strong> ${meeting.purpose}</p>` : ''}
              ${meeting.is_multi_day ? '<p style="margin: 5px 0; color: #d97706;"><strong>🎫 Multi-Day Access</strong></p>' : ''}
            </div>
            <p>Please check in at the reception desk upon arrival.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is an automated message from SAK Smart Access Control System.
            </p>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail({
        to: visitor.email,
        subject: `Meeting Invitation - ${host.name}`,
        html: emailHtml
      });

      // Send WhatsApp notification
      if (visitor.phone) {
        await WhatsAppService.sendMessage(visitor.phone, messageTemplate);
      }

      // Log notification
      await db('notifications').insert({
        recipient_id: host.id,
        type: 'meeting_created',
        channel: 'email',
        subject: 'Meeting Created',
        message: `Meeting created with ${visitor.name} (no QR)`,
        status: 'sent',
        sent_at: new Date()
      });

      logger.info(`Meeting invite (no QR) sent to ${visitor.email}`);
    } catch (error) {
      logger.error('Error sending meeting invite without QR:', error);
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
   * Send meeting cancellation notice to visitor and host
   */
  async sendCancellationNotice(visitor: any, meeting: any): Promise<void> {
    try {
      const host = await db('users').where({ id: meeting.host_id }).first();
      const { rangeLabel } = formatRange(meeting);

      // Send email to visitor
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">❌ Meeting Cancelled</h2>
            <p>Dear ${visitor.name},</p>
            <p>Your meeting with ${host.name} scheduled for ${rangeLabel} at ${meeting.location} has been cancelled.</p>
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

      // Send WhatsApp to visitor
      if (visitor.phone) {
        const visitorMsg = `❌ *Meeting Cancelled*\n\nHello ${visitor.name},\n\nYour meeting with ${host.name} scheduled for ${rangeLabel} at ${meeting.location} has been cancelled.\n\nFor any queries, please contact ${host.email}\n\n_SAK Smart Access Control_`;
        await WhatsAppService.sendMessage(visitor.phone, visitorMsg);
      }

      logger.info(`Cancellation notice sent to visitor ${visitor.email}`);
    } catch (error) {
      logger.error('Error sending cancellation notice:', error);
    }
  }

  /**
   * Notify host about meeting cancellation
   */
  async sendHostCancellationNotice(meeting: any, visitorNames: string[]): Promise<void> {
    try {
      const host = await db('users').where({ id: meeting.host_id }).first();
      if (!host) return;

      const { rangeLabel } = formatRange(meeting);
      const visitorLabel = visitorNames.length === 1 ? visitorNames[0] : `${visitorNames[0]} and ${visitorNames.length - 1} others`;

      // Send email to host
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">❌ Meeting Cancelled</h2>
            <p>Dear ${host.name},</p>
            <p>Your meeting with ${visitorLabel} scheduled for ${rangeLabel} at ${meeting.location} has been cancelled.</p>
            <p>All visitors have been notified.</p>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail({
        to: host.email,
        subject: 'Meeting Cancelled',
        html: emailHtml
      });

      // Send WhatsApp to host
      if (host.phone) {
        const hostMsg = `❌ *Meeting Cancelled*\n\nHello ${host.name},\n\nYour meeting with ${visitorLabel} scheduled for ${rangeLabel} at ${meeting.location} has been cancelled.\n\nAll visitors have been notified.\n\n_SAK Smart Access Control_`;
        await WhatsAppService.sendMessage(host.phone, hostMsg);
      }

      logger.info(`Cancellation notice sent to host ${host.email}`);
    } catch (error) {
      logger.error('Error sending host cancellation notice:', error);
    }
  }

  /**
   * Send WhatsApp message (utility method)
   */
  async sendWhatsAppMessage(phone: string, message: string): Promise<void> {
    try {
      await WhatsAppService.sendMessage(phone, message);
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
    }
  }

  /**
   * Send WhatsApp message with image (utility method)
   */
  async sendWhatsAppMessageWithImage(phone: string, message: string, imageBuffer: Buffer): Promise<void> {
    try {
      await WhatsAppService.sendMessageWithImage(phone, message, imageBuffer);
    } catch (error) {
      logger.error('Error sending WhatsApp message with image:', error);
    }
  }

  /**
   * Send cancellation email (utility method)
   */
  async sendCancellationEmail(email: string, name: string, meetingTime: string, location: string, reason: string): Promise<void> {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">❌ Meeting Cancelled</h2>
            <p>Dear ${name},</p>
            <p>Your meeting scheduled for ${new Date(meetingTime).toLocaleString()} at ${location} has been cancelled.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please reschedule at your convenience.</p>
            <br/>
            <p>Regards,<br/>SAK Smart Access Control</p>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail({
        to: email,
        subject: 'Meeting Cancelled - Reschedule Required',
        html: emailHtml
      });
    } catch (error) {
      logger.error('Error sending cancellation email:', error);
    }
  }
}

export default new NotificationService();
