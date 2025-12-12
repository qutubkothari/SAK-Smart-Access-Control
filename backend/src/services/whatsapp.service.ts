import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

class WhatsAppService {
  private sock: WASocket | null = null;
  private authFolder = path.join(process.cwd(), 'whatsapp_auth');
  private isConnected = false;
  private qrCode: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize WhatsApp connection
   */
  async initialize() {
    try {
      // Ensure auth folder exists
      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
      });

      // Connection events
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          logger.info('📱 WhatsApp QR Code generated - scan with your phone');
          // You can emit this QR to frontend for scanning
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.info('❌ WhatsApp connection closed, reconnecting:', shouldReconnect);
          
          if (shouldReconnect) {
            await this.initialize();
          }
          this.isConnected = false;
        } else if (connection === 'open') {
          logger.info('✅ WhatsApp connection established successfully');
          this.isConnected = true;
          this.qrCode = null;
        }
      });

      // Save credentials when updated
      this.sock.ev.on('creds.update', saveCreds);

    } catch (error) {
      logger.error('Error initializing WhatsApp:', error);
    }
  }

  /**
   * Get current QR code for scanning
   */
  getQRCode(): string | null {
    return this.qrCode;
  }

  /**
   * Check if WhatsApp is connected
   */
  isWhatsAppConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Format phone number for WhatsApp (add country code and @s.whatsapp.net)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned + '@s.whatsapp.net';
  }

  /**
   * Send WhatsApp text message
   */
  async sendMessage(to: string, text: string): Promise<string | null> {
    try {
      if (!this.sock || !this.isConnected) {
        logger.warn('WhatsApp not connected, skipping message');
        return null;
      }

      const jid = this.formatPhoneNumber(to);

      // Clean up currency symbols and ensure UTF-8
      const cleanText = text
        .replace(/â‚¹/g, '₹')
        .replace(/Rs\./g, '₹')
        .replace(/Rs\s+/g, '₹')
        .trim();

      await this.sock.sendMessage(jid, { text: cleanText });
      
      logger.info(`WhatsApp text message sent to ${to}`);
      return 'message_sent';
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
      if (!this.sock || !this.isConnected) {
        logger.warn('WhatsApp not connected, skipping message');
        return null;
      }

      const jid = this.formatPhoneNumber(to);

      await this.sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption
      });

      logger.info(`WhatsApp image message sent to ${to}`);
      return 'message_sent';
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
      if (!this.sock || !this.isConnected) {
        logger.warn('WhatsApp not connected, skipping document');
        return null;
      }

      const jid = this.formatPhoneNumber(to);

      await this.sock.sendMessage(jid, {
        document: documentBuffer,
        fileName: filename,
        caption: caption,
        mimetype: 'application/pdf'
      });

      logger.info(`WhatsApp document sent to ${to}: ${filename}`);
      return 'document_sent';
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
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.isConnected = false;
      logger.info('WhatsApp disconnected');
    }
  }
}

export default new WhatsAppService();
