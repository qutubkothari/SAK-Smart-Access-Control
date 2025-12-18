import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { AuthRequest } from './auth';
import auditService from '../services/audit.service';
import logger from '../utils/logger';

// Track failed login attempts for account lockout
interface LockoutRecord {
  attempts: number;
  locked_until?: Date;
  first_attempt: Date;
}

const lockoutStore = new Map<string, LockoutRecord>();

// Cleanup expired lockouts every 10 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, record] of lockoutStore.entries()) {
    if (record.locked_until && record.locked_until < now) {
      lockoutStore.delete(key);
    } else if (now.getTime() - record.first_attempt.getTime() > 15 * 60 * 1000) {
      lockoutStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export const accountLockoutConfig = {
  maxAttempts: 5,           // Max failed attempts before lockout
  windowMs: 15 * 60 * 1000, // 15 minute window for counting attempts
  lockoutMs: 30 * 60 * 1000 // 30 minute lockout duration
};

/**
 * Check if account is locked
 */
export const checkAccountLockout = async (
  identifier: string,
  req: Request
): Promise<{ locked: boolean; remainingTime?: number; attempts?: number }> => {
  const record = lockoutStore.get(identifier);

  if (!record) {
    return { locked: false };
  }

  const now = new Date();

  // Check if locked
  if (record.locked_until && record.locked_until > now) {
    const remainingTime = Math.ceil((record.locked_until.getTime() - now.getTime()) / 1000);
    
    // Log lockout attempt
    await auditService.logSecurityViolation(
      undefined,
      'ACCOUNT_LOCKOUT_ACCESS_ATTEMPT',
      { identifier, attempts: record.attempts, remaining_time: remainingTime },
      req.ip,
      req.get('user-agent')
    );

    return { locked: true, remainingTime };
  }

  // Clear if window expired
  if (now.getTime() - record.first_attempt.getTime() > accountLockoutConfig.windowMs) {
    lockoutStore.delete(identifier);
    return { locked: false };
  }

  return { locked: false, attempts: record.attempts };
};

/**
 * Record failed login attempt
 */
export const recordFailedLogin = async (
  identifier: string,
  req: Request
): Promise<{ locked: boolean; remainingAttempts?: number; lockoutTime?: number }> => {
  let record = lockoutStore.get(identifier);
  const now = new Date();

  if (!record || now.getTime() - record.first_attempt.getTime() > accountLockoutConfig.windowMs) {
    // Start new tracking window
    record = {
      attempts: 1,
      first_attempt: now
    };
  } else {
    // Increment attempts
    record.attempts++;
  }

  // Check if should lock account
  if (record.attempts >= accountLockoutConfig.maxAttempts) {
    record.locked_until = new Date(now.getTime() + accountLockoutConfig.lockoutMs);
    
    // Log account lockout
    await auditService.logSecurityViolation(
      undefined,
      'ACCOUNT_LOCKED',
      { identifier, attempts: record.attempts, locked_until: record.locked_until },
      req.ip,
      req.get('user-agent')
    );

    logger.warn(`Account locked: ${identifier} after ${record.attempts} failed attempts`);

    lockoutStore.set(identifier, record);

    return {
      locked: true,
      lockoutTime: Math.ceil(accountLockoutConfig.lockoutMs / 1000)
    };
  }

  lockoutStore.set(identifier, record);

  return {
    locked: false,
    remainingAttempts: accountLockoutConfig.maxAttempts - record.attempts
  };
};

/**
 * Clear failed login attempts (on successful login)
 */
export const clearFailedLogins = (identifier: string): void => {
  lockoutStore.delete(identifier);
};

/**
 * Get lockout statistics for monitoring
 */
export const getLockoutStats = () => {
  const now = new Date();
  let activelyLocked = 0;
  let totalAttempts = 0;

  for (const record of lockoutStore.values()) {
    totalAttempts += record.attempts;
    if (record.locked_until && record.locked_until > now) {
      activelyLocked++;
    }
  }

  return {
    active_lockouts: activelyLocked,
    total_tracking: lockoutStore.size,
    total_failed_attempts: totalAttempts
  };
};

// Enhanced rate limiter with audit logging
const createAuditedRateLimiter = (options: any) => {
  return rateLimit({
    ...options,
    handler: async (req: Request, res: any) => {
      const authReq = req as AuthRequest;
      
      // Log rate limit violation
      if (authReq.user?.id) {
        await auditService.logSecurityViolation(
          authReq.user.id,
          'RATE_LIMIT_EXCEEDED',
          { path: req.path, ip: req.ip },
          req.ip,
          req.get('user-agent')
        );
      }

      logger.warn(`Rate limit exceeded: ${req.ip} on ${req.path}`);

      res.status(429).json(options.message || {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }
      });
    }
  });
};

export const rateLimiter = createAuditedRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  // Prevent accidental low limits that break normal SPA navigation.
  max: Math.max(parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), 500),
  // Don't let the global limiter block authentication/health; those have their own controls.
  skip: (req: Request) => {
    const apiPrefix = `/api/${process.env.API_VERSION || 'v1'}`;
    return req.path.startsWith(`${apiPrefix}/auth`) || req.path.startsWith(`${apiPrefix}/health`);
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const authLimiter = createAuditedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts, please try again after 15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
