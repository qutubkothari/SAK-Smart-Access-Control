import QRCode from 'qrcode';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
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
  async generateQRCode(
    meetingId: string,
    visitorId: string,
    visitorEmail: string,
    expiryDate: Date
  ): Promise<{ token: string; image: string; qrId: string }> {
    try {
      // Generate unique QR ID (jti - JWT ID)
      const qrId = uuidv4();

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
      const qrImage = await QRCode.toDataURL(token, {
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

  /**
   * Verify JWT-based QR code with one-time use enforcement
   */
  async verifyQRCode(token: string): Promise<any> {
    try {
      // Verify and decode JWT
      const decoded = jwt.verify(token, this.jwtSecret, {
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
      await redis.set(`qr:${decoded.jti}`, JSON.stringify(qrInfo));

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
