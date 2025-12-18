import axios from 'axios';
import logger from '../utils/logger';

interface SessionConfig {
  sessionId: string;
  name: string;
  webhook?: string;
  apiKey: string;
  isActive: boolean;
}

type GatewayResponse<T> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string };

/**
 * WAPI-backed WhatsApp Gateway Service.
 *
 * NOTE: This project is intentionally not using Baileys.
 * This gateway keeps the existing `/gateway/*` routes working,
 * but it only supports text delivery via the external WAPI HTTP API.
 */
class WhatsAppGatewayService {
  private sessionConfigs: Map<string, SessionConfig> = new Map();

  constructor() {
    this.ensureDefaultSession();
  }

  private ensureDefaultSession() {
    if (this.sessionConfigs.has('default')) return;

    this.sessionConfigs.set('default', {
      sessionId: 'default',
      name: 'SAK Access Control',
      apiKey: process.env.WHATSAPP_GATEWAY_API_KEY || 'default-key-change-this',
      isActive: true,
    });
  }

  private getWapiSendConfig(): { sendUrl: string; apiKey: string } | null {
    const apiKey = process.env.WAPI_API_KEY || process.env.SAK_API_KEY;
    if (!apiKey) return null;

    const sessionId = process.env.WAPI_SESSION_ID || process.env.SAK_SESSION_ID;
    if (!sessionId) return null;

    return {
      sendUrl: process.env.WAPI_SEND_URL || 'http://wapi.saksolution.com/api/v1/messages/send',
      apiKey,
    };
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters (including + prefix)
    let cleaned = String(phone || '').replace(/\D/g, '');
    if (!cleaned) return '';
    // Add India country code only if it's a 10-digit number without country code
    if (!cleaned.startsWith('91') && cleaned.length === 10) cleaned = '91' + cleaned;
    // WAPI expects just the phone number, not Baileys JID format
    return cleaned;
  }

  validateApiKey(sessionId: string, apiKey: string): boolean {
    this.ensureDefaultSession();
    const cfg = this.sessionConfigs.get(sessionId);
    return cfg?.isActive === true && cfg?.apiKey === apiKey;
  }

  async createSession(config: SessionConfig): Promise<{
    success: boolean;
    sessionId: string;
    qrCode?: string;
    message: string;
  }> {
    this.ensureDefaultSession();
    this.sessionConfigs.set(config.sessionId, config);

    return {
      success: true,
      sessionId: config.sessionId,
      qrCode: undefined,
      message: 'Session created (WAPI mode: no QR, text-only)'
    };
  }

  getSessionStatus(sessionId: string): {
    exists: boolean;
    sessionId?: string;
    name?: string;
    isConnected?: boolean;
    isActive?: boolean;
    webhook?: string;
    qrCode?: string | null;
  } {
    this.ensureDefaultSession();
    const cfg = this.sessionConfigs.get(sessionId);
    if (!cfg) return { exists: false };

    const wapiCfg = this.getWapiSendConfig();

    return {
      exists: true,
      sessionId: cfg.sessionId,
      name: cfg.name,
      isActive: cfg.isActive,
      webhook: cfg.webhook,
      isConnected: !!wapiCfg,
      qrCode: null,
    };
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<GatewayResponse<{ messageId?: string }>> {
    const status = this.getSessionStatus(sessionId);
    if (!status.exists) return { success: false, error: 'Session not found' };
    if (!status.isActive) return { success: false, error: 'Session inactive' };

    const wapi = this.getWapiSendConfig();
    if (!wapi) return { success: false, error: 'WAPI API key is not configured (set WAPI_API_KEY or SAK_API_KEY)' };

    const wapiSessionId = process.env.WAPI_SESSION_ID || process.env.SAK_SESSION_ID;
    if (!wapiSessionId) return { success: false, error: 'WAPI session id is not configured (set WAPI_SESSION_ID or SAK_SESSION_ID)' };

    const jid = this.formatPhoneNumber(to);
    if (!jid) return { success: false, error: 'Invalid phone number' };

    const resp = await axios.post(
      wapi.sendUrl,
      { sessionId: wapiSessionId, to: jid, text: String(message || '').trim() },
      {
        headers: { 'Content-Type': 'application/json', 'x-api-key': wapi.apiKey, 'x-session-id': wapiSessionId },
        timeout: 15000,
        validateStatus: () => true,
      }
    );

    const ok = resp?.status >= 200 && resp?.status < 300 && resp?.data?.success === true;
    const gatewayStatus = resp?.data?.data?.status;
    const messageId = resp?.data?.data?.messageId;

    if (!ok || gatewayStatus === 'failed') {
      logger.warn('WhatsApp gateway (WAPI) send failed', {
        httpStatus: resp?.status,
        gatewayStatus,
        responseBody: resp?.data,
        to: jid,
      });
      return { success: false, error: resp?.data?.error?.message || 'Failed to send WhatsApp message via WAPI' };
    }

    return { success: true, data: { messageId }, message: 'Message sent' };
  }

  async sendImage(sessionId: string, to: string, imageBuffer: Buffer, caption: string = ''): Promise<GatewayResponse<{ messageId?: string }>> {
    void imageBuffer;
    const msg = caption ? `${caption}\n\n(Image attachment not supported in WAPI mode)` : '(Image attachment not supported in WAPI mode)';
    return await this.sendMessage(sessionId, to, msg);
  }

  async sendDocument(
    sessionId: string,
    to: string,
    documentBuffer: Buffer,
    filename: string,
    caption: string = ''
  ): Promise<GatewayResponse<{ messageId?: string }>> {
    void documentBuffer;
    const msg = caption
      ? `${caption}\n\n(Document: ${filename})\n(Document attachment not supported in WAPI mode)`
      : `Document: ${filename}\n(Document attachment not supported in WAPI mode)`;
    return await this.sendMessage(sessionId, to, msg);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.ensureDefaultSession();

    if (sessionId === 'default') return false;
    return this.sessionConfigs.delete(sessionId);
  }

  listSessions(): Array<{ sessionId: string; name: string; isActive: boolean; webhook?: string }> {
    this.ensureDefaultSession();
    return Array.from(this.sessionConfigs.values()).map((s) => ({
      sessionId: s.sessionId,
      name: s.name,
      isActive: s.isActive,
      webhook: s.webhook,
    }));
  }
}

export default new WhatsAppGatewayService();
