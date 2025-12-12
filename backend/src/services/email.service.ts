import nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content?: string;
    path?: string;
    cid?: string;
  }>;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // SendGrid SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY || ''
      }
    });
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        logger.warn('SendGrid not configured, email not sent');
        return false;
      }

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'SAK Access Control'}" <${process.env.EMAIL_FROM || 'noreply@sak-access.com'}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId} to ${options.to}`);
      return true;
    } catch (error: any) {
      logger.error('Error sending email:', error.message);
      return false;
    }
  }

  /**
   * Send meeting invitation with QR code
   */
  async sendMeetingInvitation(
    to: string,
    visitorName: string,
    hostName: string,
    meetingTime: string,
    location: string,
    purpose: string,
    qrCodeImage: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 30px 20px; }
          .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
          .details-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .details-box h3 { margin-top: 0; color: #667eea; font-size: 18px; }
          .detail-row { margin: 12px 0; display: flex; }
          .detail-label { font-weight: 600; color: #555; min-width: 120px; }
          .detail-value { color: #333; }
          .qr-section { text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
          .qr-section h3 { color: #667eea; margin-bottom: 15px; }
          .qr-code { background: white; padding: 20px; display: inline-block; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .qr-code img { max-width: 300px; height: auto; display: block; }
          .instructions { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .instructions h4 { margin-top: 0; color: #856404; }
          .instructions ul { margin: 10px 0; padding-left: 20px; }
          .instructions li { margin: 8px 0; color: #856404; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #dee2e6; }
          .footer p { margin: 5px 0; }
          .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Meeting Invitation</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Dear ${visitorName},</p>
            <p>You have been invited to a meeting with <strong>${hostName}</strong>.</p>
            
            <div class="details-box">
              <h3>📋 Meeting Details</h3>
              <div class="detail-row">
                <span class="detail-label">📅 Date & Time:</span>
                <span class="detail-value">${meetingTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📍 Location:</span>
                <span class="detail-value">${location}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 Host:</span>
                <span class="detail-value">${hostName}</span>
              </div>
              ${purpose ? `
              <div class="detail-row">
                <span class="detail-label">🎯 Purpose:</span>
                <span class="detail-value">${purpose}</span>
              </div>
              ` : ''}
            </div>

            <div class="qr-section">
              <h3>🎫 Your Entry QR Code</h3>
              <div class="qr-code">
                <img src="${qrCodeImage}" alt="QR Code" />
              </div>
              <p style="color: #666; margin-top: 15px; font-size: 14px;">
                <strong>Important:</strong> Please save this QR code on your phone or print it
              </p>
            </div>

            <div class="instructions">
              <h4>📱 Check-in Instructions:</h4>
              <ul>
                <li>Arrive at the location at the scheduled time</li>
                <li>Show this QR code to the reception/security</li>
                <li>They will scan it to check you in</li>
                <li>The host will be notified of your arrival</li>
              </ul>
            </div>

            <p style="margin-top: 30px; color: #666;">
              If you have any questions or need to reschedule, please contact the host directly.
            </p>
          </div>

          <div class="footer">
            <p><strong>SAK Smart Access Control System</strong></p>
            <p>This is an automated message, please do not reply to this email.</p>
            <p style="font-size: 11px; color: #999; margin-top: 10px;">
              This QR code is valid for 24 hours and can only be used once.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to,
      subject: `Meeting Invitation - ${hostName}`,
      html
    });
  }

  /**
   * Send visitor arrival notification to host
   */
  async sendVisitorArrivalNotification(
    to: string,
    hostName: string,
    visitorName: string,
    company: string,
    location: string,
    arrivalTime: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert-box { background: #d1fae5; border: 2px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 Visitor Arrived</h2>
          </div>
          <div class="content">
            <p>Dear ${hostName},</p>
            <div class="alert-box">
              <p style="margin: 0;"><strong>${visitorName}</strong>${company ? ` from <strong>${company}</strong>` : ''} has arrived for your meeting.</p>
            </div>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
            <p style="margin-top: 20px;">Please proceed to meet your visitor.</p>
          </div>
          <div class="footer">
            <p>SAK Smart Access Control System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to,
      subject: '🔔 Visitor Arrived',
      html
    });
  }

  /**
   * Send meeting reminder
   */
  async sendMeetingReminder(
    to: string,
    hostName: string,
    meetingTime: string,
    location: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .reminder-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⏰ Meeting Reminder</h2>
          </div>
          <div class="content">
            <p>Dear ${hostName},</p>
            <div class="reminder-box">
              <p>This is a reminder that you have a meeting scheduled in 30 minutes.</p>
            </div>
            <p><strong>Time:</strong> ${meetingTime}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p style="margin-top: 20px;">Please check in at the meeting location.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to,
      subject: '⏰ Meeting Reminder',
      html
    });
  }
}

export default new EmailService();
