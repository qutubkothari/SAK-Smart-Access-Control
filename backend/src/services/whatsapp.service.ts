import logger from '../utils/logger';
import axios from 'axios';
import FormData from 'form-data';

class WhatsAppService {
  // We are intentionally NOT using Baileys in production.
  // This service sends via the external WAPI HTTP API.
  async initialize(): Promise<void> {
    // no-op (WAPI)
    logger.info('WhatsAppService.initialize() called (WAPI mode)');
  }

  getQRCode(): string | null {
    return null;
  }

  isWhatsAppConnected(): boolean {
    return !!(process.env.WAPI_API_KEY || process.env.SAK_API_KEY);
  }

  /**
   * Format phone number for WhatsApp (add country code if needed)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters (including + prefix for international numbers)
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming India +91 for 10-digit numbers)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    // WAPI expects just the phone number, not Baileys JID format
    return cleaned;
  }

  /**
   * Send WhatsApp text message
   */
  async sendMessage(to: string, text: string): Promise<string | null> {
    try {
      // Clean up currency symbols and ensure UTF-8
      const cleanText = text
        .replace(/â‚¹/g, '₹')
        .replace(/Rs\./g, '₹')
        .replace(/Rs\s+/g, '₹')
        .trim();

      const apiKey = process.env.WAPI_API_KEY || process.env.SAK_API_KEY;
      const sessionId = process.env.WAPI_SESSION_ID || process.env.SAK_SESSION_ID;
      const sendUrl = process.env.WAPI_SEND_URL || 'http://wapi.saksolution.com/api/v1/messages/send';

      if (!apiKey) {
        logger.warn('No WAPI/SAK API key configured; skipping WhatsApp message');
        return null;
      }

      if (!sessionId) {
        logger.warn('No WAPI/SAK session id configured; skipping WhatsApp message');
        return null;
      }

      const jid = this.formatPhoneNumber(to);

        const resp = await axios.post(
          sendUrl,
          { sessionId, to: jid, text: cleanText },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'x-session-id': sessionId,
            },
            timeout: 15000,
            validateStatus: () => true,
          }
        );

      const ok = resp?.status >= 200 && resp?.status < 300 && resp?.data?.success === true;
      const status = resp?.data?.data?.status;
      const messageId = resp?.data?.data?.messageId;

      if (!ok || status === 'failed') {
        logger.warn('WhatsApp WAPI send failed', {
          httpStatus: resp?.status,
          gatewayStatus: status,
          responseBody: resp?.data,
          to: jid,
        });
        return null;
      }

      logger.info(`WhatsApp (WAPI) message sent to ${to}`);
      return messageId || 'message_sent';
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', error);
      return null;
    }
  }

  /**
   * Send WhatsApp message with image
   */
  async sendMessageWithImage(to: string, caption: string, imageBuffer: Buffer): Promise<string | null> {
    try {
      const apiKey = process.env.WAPI_API_KEY || process.env.SAK_API_KEY;
      const sessionId = process.env.WAPI_SESSION_ID || process.env.SAK_SESSION_ID;
      const sendUrl = process.env.WAPI_IMAGE_URL || 'http://wapi.saksolution.com/api/v1/messages/send-image';

      if (!apiKey || !sessionId) {
        logger.warn('Missing WAPI credentials for image send');
        return null;
      }

      const jid = this.formatPhoneNumber(to);
      if (!jid) return null;

      const form = new FormData();
      form.append('to', jid);
      form.append('caption', caption);
      form.append('image', imageBuffer, { filename: 'qr.png', contentType: 'image/png' });

      const resp = await axios.post(sendUrl, form, {
        headers: {
          ...form.getHeaders(),
          'x-api-key': apiKey,
          'x-session-id': sessionId,
        },
        timeout: 20000,
        validateStatus: () => true,
      });

      const ok = resp?.status >= 200 && resp?.status < 300 && resp?.data?.success === true;
      const status = resp?.data?.data?.status;
      const messageId = resp?.data?.data?.messageId;

      if (!ok || status === 'failed') {
        logger.warn('WhatsApp WAPI image send failed', {
          httpStatus: resp?.status,
          gatewayStatus: status,
          responseBody: resp?.data,
          to: jid,
        });
        return null;
      }

      logger.info(`WhatsApp (WAPI image) message sent to ${to}`);
      return messageId || 'image_sent';
    } catch (error: any) {
      logger.error('Error sending WhatsApp image:', error);
      return null;
    }
  }

  /**
   * Send document (PDF, etc.) via WhatsApp
   */
  async sendDocument(to: string, documentBuffer: Buffer, filename: string, caption: string = ''): Promise<string | null> {
    try {
      // WAPI integration is text-only here.
      void documentBuffer;
      const msg = caption ? `${caption}\n\n(Document: ${filename})` : `Document: ${filename}`;
      return await this.sendMessage(to, msg);
    } catch (error: any) {
      logger.error('Error sending WhatsApp document:', error);
      return null;
    }
  }

  /**
   * Send QR code via WhatsApp (with image)
   */
  async sendQRCode(to: string, visitorName: string, meetingDetails: string, qrImageBuffer: Buffer): Promise<string | null> {
    try {
      const message = `🎫 *Meeting Invitation*\n\nHi ${visitorName},\n\n${meetingDetails}\n\n✅ Please show this QR code at reception when you arrive.\n\n_SAK Smart Access Control_`;

      return await this.sendMessageWithImage(to, message, qrImageBuffer);
    } catch (error) {
      logger.error('Error sending QR code via WhatsApp:', error);
      return null;
    }
  }

  /**
   * Send visitor arrival notification to host
   */
  async notifyHostVisitorArrived(to: string, hostName: string, visitorName: string, location: string): Promise<string | null> {
    const message = `🔔 *Visitor Arrived*\n\nHi ${hostName},\n\n${visitorName} has arrived at ${location}.\n\nPlease proceed to meet your visitor.\n\n_SAK Smart Access Control_`;
    return await this.sendMessage(to, message);
  }

  /**
   * Send meeting reminder
   */
  async sendMeetingReminder(to: string, hostName: string, meetingTime: string, location: string): Promise<string | null> {
    const message = `⏰ *Meeting Reminder*\n\nHi ${hostName},\n\nYour meeting is scheduled at ${meetingTime} at ${location}.\n\nPlease check in at the meeting location.\n\n_SAK Smart Access Control_`;
    return await this.sendMessage(to, message);
  }

  /**
   * Disconnect WhatsApp
   */
  async disconnect() {
    // no-op (WAPI)
  }
}

export default new WhatsAppService();
