import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

interface SessionConfig {
  sessionId: string;
  name: string;
  phoneNumber?: string;
  webhook?: string;
  apiKey: string;
  isActive: boolean;
}

interface QueuedMessage {
  id: string;
  sessionId: string;
  to: string;
  type: 'text' | 'image' | 'document';
  content: any;
  retries: number;
  timestamp: Date;
}

/**
 * Multi-tenant WhatsApp Gateway Service
 * Similar to Maytapi but self-hosted and free
 */
class WhatsAppGatewayService {
  private sessions: Map<string, WASocket> = new Map();
  private sessionConfigs: Map<string, SessionConfig> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private connectionStatus: Map<string, boolean> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private authBaseFolder = path.join(process.cwd(), 'whatsapp_sessions');

  constructor() {
    this.initialize();
  }

  /**
   * Initialize gateway service
   */
  private async initialize() {
    // Ensure sessions folder exists
    if (!fs.existsSync(this.authBaseFolder)) {
      fs.mkdirSync(this.authBaseFolder, { recursive: true });
    }

    // Load existing sessions from database or config
    // For now, auto-create a default session
    await this.createSession({
      sessionId: 'default',
      name: 'SAK Access Control',
      apiKey: process.env.WHATSAPP_GATEWAY_API_KEY || 'default-key-change-this',
      isActive: true
    });

    logger.info('WhatsApp Gateway Service initialized');
  }

  /**
   * Create a new WhatsApp session (like creating a new Maytapi phone)
   */
  async createSession(config: SessionConfig): Promise<{
    success: boolean;
    sessionId: string;
    qrCode?: string;
    message: string;
  }> {
    try {
      const sessionFolder = path.join(this.authBaseFolder, config.sessionId);
      
      // Ensure session folder exists
      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
      });

      // Store session config
      this.sessionConfigs.set(config.sessionId, config);
      this.sessions.set(config.sessionId, sock);

      // Connection events
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodes.set(config.sessionId, qr);
          logger.info(`📱 QR Code generated for session: ${config.sessionId}`);
          
          // Call webhook if configured
          if (config.webhook) {
            this.callWebhook(config.webhook, {
              event: 'qr_code',
              sessionId: config.sessionId,
              qrCode: qr
            });
          }
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.info(`❌ Session ${config.sessionId} closed, reconnecting: ${shouldReconnect}`);
          
          this.connectionStatus.set(config.sessionId, false);
          
          if (shouldReconnect) {
            setTimeout(() => this.createSession(config), 5000);
          }

          // Webhook notification
          if (config.webhook) {
            this.callWebhook(config.webhook, {
              event: 'disconnected',
              sessionId: config.sessionId,
              shouldReconnect
            });
          }
        } else if (connection === 'open') {
          logger.info(`✅ Session ${config.sessionId} connected`);
          this.connectionStatus.set(config.sessionId, true);
          this.qrCodes.delete(config.sessionId);

          // Store phone number
          const phoneNumber = sock.user?.id?.split(':')[0];
          if (phoneNumber) {
            config.phoneNumber = phoneNumber;
            this.sessionConfigs.set(config.sessionId, config);
          }

          // Webhook notification
          if (config.webhook) {
            this.callWebhook(config.webhook, {
              event: 'connected',
              sessionId: config.sessionId,
              phoneNumber: config.phoneNumber
            });
          }

          // Process queued messages
          this.processMessageQueue(config.sessionId);
        }
      });

      // Message received handler
      sock.ev.on('messages.upsert', async ({ messages }) => {
        await this.handleIncomingMessage(config.sessionId, messages);
      });

      // Save credentials when updated
      sock.ev.on('creds.update', saveCreds);

      return {
        success: true,
        sessionId: config.sessionId,
        qrCode: this.qrCodes.get(config.sessionId),
        message: 'Session created successfully'
      };
    } catch (error: any) {
      logger.error(`Error creating session ${config.sessionId}:`, error);
      return {
        success: false,
        sessionId: config.sessionId,
        message: error.message
      };
    }
  }

  /**
   * Handle incoming messages (for webhook forwarding)
   */
  private async handleIncomingMessage(sessionId: string, messages: WAMessage[]) {
    const config = this.sessionConfigs.get(sessionId);
    if (!config?.webhook) return;

    for (const message of messages) {
      if (message.key.fromMe) continue; // Skip messages sent by us

      const messageData = {
        event: 'message_received',
        sessionId,
        from: message.key.remoteJid,
        messageId: message.key.id,
        timestamp: message.messageTimestamp,
        type: Object.keys(message.message || {})[0],
        text: message.message?.conversation || 
              message.message?.extendedTextMessage?.text || '',
        hasMedia: !!(message.message?.imageMessage || 
                     message.message?.documentMessage ||
                     message.message?.videoMessage)
      };

      await this.callWebhook(config.webhook, messageData);
    }
  }

  /**
   * Call webhook URL with data
   */
  private async callWebhook(webhookUrl: string, data: any) {
    try {
      const axios = require('axios');
      await axios.post(webhookUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Webhook call failed:', error);
    }
  }

  /**
   * Validate API key for session
   */
  validateApiKey(sessionId: string, apiKey: string): boolean {
    const config = this.sessionConfigs.get(sessionId);
    return config?.apiKey === apiKey && config?.isActive === true;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): {
    exists: boolean;
    connected: boolean;
    phoneNumber?: string;
    qrCode?: string;
  } {
    const config = this.sessionConfigs.get(sessionId);
    return {
      exists: !!config,
      connected: this.connectionStatus.get(sessionId) || false,
      phoneNumber: config?.phoneNumber,
      qrCode: this.qrCodes.get(sessionId)
    };
  }

  /**
   * Send text message
   */
  async sendMessage(
    sessionId: string,
    to: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const sock = this.sessions.get(sessionId);
      const isConnected = this.connectionStatus.get(sessionId);

      if (!sock || !isConnected) {
        // Queue message for later
        this.queueMessage({
          id: uuidv4(),
          sessionId,
          to,
          type: 'text',
          content: { text },
          retries: 0,
          timestamp: new Date()
        });

        return {
          success: false,
          error: 'Session not connected, message queued'
        };
      }

      const jid = this.formatPhoneNumber(to);
      const sentMsg = await sock.sendMessage(jid, { text });

      logger.info(`Message sent via session ${sessionId} to ${to}`);

      return {
        success: true,
        messageId: sentMsg?.key?.id || undefined
      };
    } catch (error: any) {
      logger.error(`Error sending message:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send image with caption
   */
  async sendImage(
    sessionId: string,
    to: string,
    imageBuffer: Buffer,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const sock = this.sessions.get(sessionId);
      const isConnected = this.connectionStatus.get(sessionId);

      if (!sock || !isConnected) {
        this.queueMessage({
          id: uuidv4(),
          sessionId,
          to,
          type: 'image',
          content: { imageBuffer, caption },
          retries: 0,
          timestamp: new Date()
        });

        return {
          success: false,
          error: 'Session not connected, message queued'
        };
      }

      const jid = this.formatPhoneNumber(to);
      const sentMsg = await sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption || ''
      });

      return {
        success: true,
        messageId: sentMsg?.key?.id || undefined
      };
    } catch (error: any) {
      logger.error(`Error sending image:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send document
   */
  async sendDocument(
    sessionId: string,
    to: string,
    documentBuffer: Buffer,
    filename: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const sock = this.sessions.get(sessionId);
      const isConnected = this.connectionStatus.get(sessionId);

      if (!sock || !isConnected) {
        this.queueMessage({
          id: uuidv4(),
          sessionId,
          to,
          type: 'document',
          content: { documentBuffer, filename, caption },
          retries: 0,
          timestamp: new Date()
        });

        return {
          success: false,
          error: 'Session not connected, message queued'
        };
      }

      const jid = this.formatPhoneNumber(to);
      const sentMsg = await sock.sendMessage(jid, {
        document: documentBuffer,
        fileName: filename,
        caption: caption || '',
        mimetype: 'application/pdf'
      });

      return {
        success: true,
        messageId: sentMsg?.key?.id || undefined
      };
    } catch (error: any) {
      logger.error(`Error sending document:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Queue message for retry
   */
  private queueMessage(message: QueuedMessage) {
    this.messageQueue.push(message);
    logger.info(`Message queued: ${message.id}`);
  }

  /**
   * Process queued messages for a session
   */
  private async processMessageQueue(sessionId: string) {
    const messages = this.messageQueue.filter(m => m.sessionId === sessionId);
    
    for (const msg of messages) {
      if (msg.retries >= 3) {
        // Remove failed messages after 3 retries
        this.messageQueue = this.messageQueue.filter(m => m.id !== msg.id);
        continue;
      }

      try {
        if (msg.type === 'text') {
          await this.sendMessage(sessionId, msg.to, msg.content.text);
        } else if (msg.type === 'image') {
          await this.sendImage(sessionId, msg.to, msg.content.imageBuffer, msg.content.caption);
        } else if (msg.type === 'document') {
          await this.sendDocument(sessionId, msg.to, msg.content.documentBuffer, msg.content.filename, msg.content.caption);
        }

        // Remove from queue on success
        this.messageQueue = this.messageQueue.filter(m => m.id !== msg.id);
      } catch (error) {
        msg.retries++;
      }
    }
  }

  /**
   * Format phone number
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned + '@s.whatsapp.net';
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sock = this.sessions.get(sessionId);
      if (sock) {
        await sock.logout();
      }

      this.sessions.delete(sessionId);
      this.sessionConfigs.delete(sessionId);
      this.connectionStatus.delete(sessionId);
      this.qrCodes.delete(sessionId);

      // Delete auth folder
      const sessionFolder = path.join(this.authBaseFolder, sessionId);
      if (fs.existsSync(sessionFolder)) {
        fs.rmSync(sessionFolder, { recursive: true });
      }

      logger.info(`Session ${sessionId} deleted`);
      return true;
    } catch (error) {
      logger.error(`Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * List all sessions
   */
  listSessions(): SessionConfig[] {
    return Array.from(this.sessionConfigs.values()).map(config => ({
      ...config,
      apiKey: '***' + config.apiKey.slice(-4) // Mask API key
    }));
  }
}

export default new WhatsAppGatewayService();
