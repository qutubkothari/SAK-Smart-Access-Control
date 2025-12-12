import axios from 'axios';
import logger from '../utils/logger';

class MaytapiService {
  private productId: string;
  private phoneId: string;
  private apiToken: string;
  private apiUrl: string;
  private baseUrl: string;

  constructor() {
    this.productId = process.env.MAYTAPI_PRODUCT_ID || '';
    this.phoneId = process.env.MAYTAPI_PHONE_ID || '';
    this.apiToken = process.env.MAYTAPI_API_KEY || '';
    this.baseUrl = `https://api.maytapi.com/api/${this.productId}/${this.phoneId}`;
    this.apiUrl = `${this.baseUrl}/sendMessage`;
  }

  /**
   * Send WhatsApp text message
   */
  async sendMessage(to: string, text: string): Promise<string | null> {
    try {
      if (!this.productId || !this.phoneId || !this.apiToken) {
        logger.warn('Maytapi not configured, skipping WhatsApp message');
        return null;
      }

      // Clean up currency symbols and ensure UTF-8
      let cleanText = text
        .replace(/â‚¹/g, '₹')
        .replace(/Rs\./g, '₹')
        .replace(/Rs\s+/g, '₹')
        .replace(/Ã¢â€šÂ¹/g, '₹')
        .replace(/Ã°Å¸â€œÂ¦/g, '📦')
        .replace(/Ã¢Å"â€¦/g, '✅')
        .replace(/Ã°Å¸â€™Â³/g, '💳')
        .trim();

      logger.info(`[WHATSAPP_SEND] Cleaned text preview: ${cleanText.substring(0, 100)}`);

      const response = await axios.post(
        this.apiUrl,
        {
          to_number: to,
          type: 'text',
          message: cleanText
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-maytapi-key': this.apiToken
          }
        }
      );

      if (!response.data) {
        logger.error('Maytapi API error: No response data');
        return null;
      }

      logger.info(`WhatsApp text message sent to ${to}`);
      return response.data.data?.message_id || null;
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Send WhatsApp message with image
   */
  async sendMessageWithImage(to: string, caption: string, mediaUrl: string): Promise<string | null> {
    try {
      if (!this.productId || !this.phoneId || !this.apiToken) {
        logger.warn('Maytapi not configured, skipping WhatsApp message');
        return null;
      }

      const response = await axios.post(
        this.apiUrl,
        {
          to_number: to,
          type: 'media',
          message: mediaUrl,
          text: caption
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-maytapi-key': this.apiToken
          }
        }
      );

      if (!response.data) {
        logger.error('Maytapi API error (Image): No response data');
        return null;
      }

      logger.info(`WhatsApp image message sent to ${to}`);
      return response.data.data?.message_id || null;
    } catch (error: any) {
      logger.error('Error sending WhatsApp image:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Send document (PDF, etc.) via WhatsApp
   */
  async sendDocument(to: string, documentBuffer: Buffer, filename: string, caption: string = ''): Promise<string | null> {
    try {
      if (!this.productId || !this.phoneId || !this.apiToken) {
        logger.warn('Maytapi not configured, skipping WhatsApp document');
        return null;
      }

      logger.info(`[MAYTAPI_DOCUMENT] Sending document: ${filename} to: ${to}`);
      logger.info(`[MAYTAPI_DOCUMENT] Buffer size: ${documentBuffer.length} bytes`);

      const base64Data = documentBuffer.toString('base64');
      logger.info(`[MAYTAPI_DOCUMENT] Base64 data length: ${base64Data.length}`);

      const response = await axios.post(
        this.apiUrl,
        {
          to_number: to,
          type: 'document',
          text: caption,
          document: base64Data,
          filename: filename
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-maytapi-key': this.apiToken
          }
        }
      );

      logger.info(`[MAYTAPI_DOCUMENT] Response status: ${response.status}`);
      logger.info(`[MAYTAPI_DOCUMENT] Response body: ${JSON.stringify(response.data, null, 2)}`);

      if (!response.data) {
        logger.error('Maytapi Document API Error: No response data');
        return null;
      }

      logger.info(`Document sent to ${to}: ${filename}`);
      return response.data.data?.message_id || response.data.message_id || 'document_sent';
    } catch (error: any) {
      logger.error('Error sending document via Maytapi:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Send QR code via WhatsApp
   */
  async sendQRCode(to: string, visitorName: string, meetingDetails: string, _qrImageBase64: string): Promise<string | null> {
    try {
      const message = `🎫 *Meeting Invitation*\n\nHi ${visitorName},\n\n${meetingDetails}\n\n✅ Your QR code has been sent to your email.\n\n⚠️ Please show the QR code at reception when you arrive.\n\n_SAK Smart Access Control_`;

      return await this.sendMessage(to, message);
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
   * Check connection status
   */
  async checkStatus(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/status`,
        {
          headers: {
            'x-maytapi-key': this.apiToken
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error checking Maytapi status:', error);
      return null;
    }
  }
}

export default new MaytapiService();
