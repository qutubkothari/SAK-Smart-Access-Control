import QRCode from 'qrcode';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import redis from '../config/redis';

class QRCodeService {
  private secret: string;
  private jwtSecret: string;

  constructor() {
    this.secret = process.env.QR_CODE_SECRET || 'default_secret_change_this';
    this.jwtSecret = process.env.JWT_SECRET || 'change_this_jwt_secret';
  }

  /**
   * Generate secure JWT-based QR code for visitor
   * Industry standard: Signed JWT with one-time use token
   */
  private generateShortQrId(): string {
    // Compact, URL-safe, human-friendly id (Base62) to keep QR payload small.
    // 9 bytes = 72 bits of entropy => ~13 Base62 chars.
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.randomBytes(9);

    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);

    if (value === 0n) return '0';

    let out = '';
    const base = 62n;
    while (value > 0n) {
      const idx = Number(value % base);
      out = alphabet[idx] + out;
      value = value / base;
    }
    return out;
  }

  async generateQRCode(
    meetingId: string,
    visitorId: string,
    visitorEmail: string,
    expiryDate: Date
  ): Promise<{ token: string; image: string; qrId: string }> {
    try {
      // Generate unique QR ID (jti - JWT ID)
      const qrId = this.generateShortQrId();

      // Create JWT payload with security claims
      const payload = {
        iss: 'SAK-Access-Control',           // Issuer
        sub: visitorId,                      // Subject (visitor ID)
        aud: 'check-in-terminal',            // Audience
        jti: qrId,                           // Unique token ID (prevents replay)
        meeting_id: meetingId,
        visitor_email: visitorEmail,
        exp: Math.floor(expiryDate.getTime() / 1000), // Expiry timestamp
        nbf: Math.floor(Date.now() / 1000),  // Not before (current time)
        iat: Math.floor(Date.now() / 1000)   // Issued at
      };

      // Sign JWT with secret
      const token = jwt.sign(payload, this.jwtSecret, {
        algorithm: 'HS256'
      });

      // Store QR ID in Redis with expiry (for one-time use validation)
      const expirySeconds = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
      await redis.setEx(`qr:${qrId}`, expirySeconds, JSON.stringify({
        visitor_id: visitorId,
        meeting_id: meetingId,
        used: false,
        created_at: new Date().toISOString()
      }));

      // Generate QR code image
      // IMPORTANT: encode the short QR id (jti) instead of the full JWT.
      // Dense JWT QRs are hard to scan on phone cameras (especially off screens).
      const qrImage = await QRCode.toDataURL(qrId, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      logger.info(`Secure QR code generated for meeting ${meetingId}, QR ID: ${qrId}`);

      return {
        token,
        image: qrImage,
        qrId
      };
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw error;
    }
  }

  private normalizeQrInput(input: string): string {
    const raw = String(input || '').trim();
    if (!raw) return raw;

    // If the QR contains a URL, try to extract the last path segment.
    // Example: https://sac.saksolution.com/qr/<id>
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        const segments = url.pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        if (last) return last;
      }
    } catch {
      // ignore
    }

    // Allow simple prefixes like "qr:<id>"
    const prefixMatch = raw.match(/^(?:qr:|sak:)(.+)$/i);
    if (prefixMatch?.[1]) return prefixMatch[1].trim();

    return raw;
  }

  private async markQrUsed(qrId: string, qrInfo: any): Promise<void> {
    const ttl = await redis.ttl(`qr:${qrId}`);
    if (ttl && ttl > 0) {
      await redis.setEx(`qr:${qrId}`, ttl, JSON.stringify(qrInfo));
      return;
    }
    await redis.set(`qr:${qrId}`, JSON.stringify(qrInfo));
  }

  /**
   * Verify a short QR id (jti) with one-time use enforcement.
   */
  async verifyQrId(qrIdInput: string): Promise<any> {
    const qrId = this.normalizeQrInput(qrIdInput);
    if (!qrId) return null;

    const qrData = await redis.get(`qr:${qrId}`);
    if (!qrData) {
      logger.warn(`QR code expired or invalid: ${qrId}`);
      return null;
    }

    const qrInfo = JSON.parse(qrData);
    if (qrInfo.used) {
      logger.warn(`QR code already used: ${qrId}`);
      return { error: 'QR_CODE_ALREADY_USED', message: 'This QR code has already been scanned' };
    }

    qrInfo.used = true;
    qrInfo.used_at = new Date().toISOString();
    await this.markQrUsed(qrId, qrInfo);

    logger.info(`QR id verified successfully: ${qrId}`);

    return {
      visitor_id: qrInfo.visitor_id,
      meeting_id: qrInfo.meeting_id,
      qr_id: qrId
    };
  }

  /**
   * Verify either a JWT token (legacy) or a short QR id / URL.
   */
  async verifyQrCodeInput(input: string): Promise<any> {
    const normalized = this.normalizeQrInput(input);
    // JWTs have 3 dot-separated parts.
    if (normalized.split('.').length === 3) {
      return this.verifyQRCode(normalized);
    }
    return this.verifyQrId(normalized);
  }

  /**
   * Verify JWT-based QR code with one-time use enforcement
   */
  async verifyQRCode(token: string): Promise<any> {
    try {
      const normalized = this.normalizeQrInput(token);

      // Verify and decode JWT
      const decoded = jwt.verify(normalized, this.jwtSecret, {
        algorithms: ['HS256'],
        audience: 'check-in-terminal',
        issuer: 'SAK-Access-Control'
      }) as any;

      // Check if QR has already been used (replay attack prevention)
      const qrData = await redis.get(`qr:${decoded.jti}`);
      
      if (!qrData) {
        logger.warn(`QR code expired or invalid: ${decoded.jti}`);
        return null;
      }

      const qrInfo = JSON.parse(qrData);
      
      if (qrInfo.used) {
        logger.warn(`QR code already used: ${decoded.jti}`);
        return { error: 'QR_CODE_ALREADY_USED', message: 'This QR code has already been scanned' };
      }

      // Mark QR as used
      qrInfo.used = true;
      qrInfo.used_at = new Date().toISOString();
      await this.markQrUsed(decoded.jti, qrInfo);

      logger.info(`QR code verified successfully: ${decoded.jti}`);

      return {
        visitor_id: decoded.sub,
        meeting_id: decoded.meeting_id,
        visitor_email: decoded.visitor_email,
        qr_id: decoded.jti
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('QR code token expired');
        return { error: 'QR_CODE_EXPIRED', message: 'QR code has expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid QR code token');
        return { error: 'INVALID_QR_CODE', message: 'Invalid QR code' };
      }
      logger.error('Error verifying QR code:', error);
      return null;
    }
  }

  /**
   * Revoke QR code (for cancellations)
   */
  async revokeQRCode(qrId: string): Promise<boolean> {
    try {
      const result = await redis.del(`qr:${qrId}`);
      logger.info(`QR code revoked: ${qrId}`);
      return result > 0;
    } catch (error) {
      logger.error('Error revoking QR code:', error);
      return false;
    }
  }

  /**
   * Legacy: Encrypt data using AES-256 with random salt (DEPRECATED)
   * Kept for backward compatibility only
   * @deprecated
   */
  // @ts-expect-error - Deprecated method kept for backward compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32); // Random salt per encryption
    const key = crypto.scryptSync(this.secret, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + salt.toString('hex') + ':' + encrypted;
  }

  /**
   * Legacy: Decrypt data (DEPRECATED)
   * @deprecated
   */
  // @ts-expect-error - Deprecated method kept for backward compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _decrypt(text: string): string {
    const [ivHex, saltHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    const key = crypto.scryptSync(this.secret, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export default new QRCodeService();
