import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getLockoutStats } from '../middleware/rateLimiter';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get security statistics (Admin only)
 */
export const getSecurityStats = async (req: AuthRequest, res: Response) => {
  try {
    // Get lockout statistics
    const lockoutStats = getLockoutStats();

    // Get audit log statistics (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Security violations count
    const securityViolations = await db('audit_logs')
      .where('action_type', 'SECURITY_VIOLATION')
      .where('created_at', '>=', twentyFourHoursAgo)
      .count('* as count')
      .first();

    // Failed login attempts (access denied)
    const failedLogins = await db('audit_logs')
      .where('action_type', 'ACCESS_DENIED')
      .where('entity_type', 'user')
      .where('created_at', '>=', twentyFourHoursAgo)
      .count('* as count')
      .first();

    // Top security violation types
    let topViolations: any[] = [];
    try {
      topViolations = await db('audit_logs')
        .select('description')
        .count('* as count')
        .where('action_type', 'SECURITY_VIOLATION')
        .where('created_at', '>=', twentyFourHoursAgo)
        .groupBy('description')
        .orderBy('count', 'desc')
        .limit(10);
    } catch (error: any) {
      // Some production DBs are drifted and lack audit_logs.description
      if (error?.code !== '42703') throw error;
      topViolations = await db('audit_logs')
        .select('entity_type')
        .count('* as count')
        .where('action_type', 'SECURITY_VIOLATION')
        .where('created_at', '>=', twentyFourHoursAgo)
        .groupBy('entity_type')
        .orderBy('count', 'desc')
        .limit(10);
    }

    // Most active IPs with security issues
    const suspiciousIPs = await db('audit_logs')
      .select('ip_address')
      .count('* as violation_count')
      .where('action_type', 'SECURITY_VIOLATION')
      .where('created_at', '>=', twentyFourHoursAgo)
      .whereNotNull('ip_address')
      .groupBy('ip_address')
      .orderBy('violation_count', 'desc')
      .limit(10);

    // Recent critical events (last 50)
    let recentCriticalEvents: any[] = [];
    {
      const baseRecentQuery = () =>
        db('audit_logs')
          .whereIn('action_type', ['SECURITY_VIOLATION', 'ACCESS_DENIED', 'DELETE'])
          .where('created_at', '>=', twentyFourHoursAgo)
          .orderBy('created_at', 'desc')
          .limit(50);

      const recentQueryAttempts: Array<() => Promise<any[]>> = [
        () =>
          baseRecentQuery().select(
            'audit_id',
            'user_id',
            'action_type',
            'entity_type',
            'description',
            'ip_address',
            'created_at'
          ),
        () =>
          baseRecentQuery().select(
            'audit_id',
            'user_id',
            'action_type',
            'entity_type',
            'ip_address',
            'created_at'
          ),
        () =>
          baseRecentQuery().select(
            { audit_id: 'id' },
            'user_id',
            'action_type',
            'entity_type',
            'description',
            'ip_address',
            'created_at'
          ),
        () =>
          baseRecentQuery().select(
            { audit_id: 'id' },
            'user_id',
            'action_type',
            'entity_type',
            'ip_address',
            'created_at'
          )
      ];

      let lastError: any;
      for (const attempt of recentQueryAttempts) {
        try {
          recentCriticalEvents = await attempt();
          lastError = undefined;
          break;
        } catch (error: any) {
          if (error?.code !== '42703') throw error;
          lastError = error;
        }
      }
      if (lastError) throw lastError;
    }

    logger.info(`Security stats retrieved by admin ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        period: '24_hours',
        account_lockout: lockoutStats,
        security_events: {
          total_violations: parseInt((securityViolations as any)?.count || '0'),
          failed_logins: parseInt((failedLogins as any)?.count || '0'),
          top_violations: topViolations.map((v: any) => ({
            type: v.description ?? v.entity_type,
            count: parseInt(v.count)
          })),
          suspicious_ips: suspiciousIPs.map((ip: any) => ({
            ip_address: ip.ip_address,
            violation_count: parseInt(ip.violation_count)
          }))
        },
        recent_critical_events: recentCriticalEvents
      }
    });
  } catch (error) {
    logger.error('Error fetching security stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch security statistics'
      }
    });
  }
};

/**
 * Get locked accounts list (Admin only)
 */
export const getLockedAccounts = async (_req: AuthRequest, res: Response) => {
  try {
    const lockoutStats = getLockoutStats();

    res.json({
      success: true,
      data: {
        active_lockouts: lockoutStats.active_lockouts,
        total_tracking: lockoutStats.total_tracking,
        total_failed_attempts: lockoutStats.total_failed_attempts
      }
    });
  } catch (error) {
    logger.error('Error fetching locked accounts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch locked accounts'
      }
    });
  }
};

/**
 * Get access control violations (Security team)
 */
export const getAccessViolations = async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, limit = 100 } = req.query;

    const baseViolationsQuery = () => {
      let query = db('audit_logs')
        .where('action_type', 'ACCESS_DENIED')
        .orderBy('created_at', 'desc')
        .limit(Number(limit));

      if (start_date) {
        query = query.where('created_at', '>=', start_date as string);
      }

      if (end_date) {
        query = query.where('created_at', '<=', end_date as string);
      }

      return query;
    };

    const violationsQueryAttempts: Array<() => Promise<any[]>> = [
      () =>
        baseViolationsQuery().select(
          'audit_id',
          'user_id',
          'action_type',
          'entity_type',
          'entity_id',
          'description',
          'ip_address',
          'user_agent',
          'old_values',
          'new_values',
          'created_at'
        ),
      () =>
        baseViolationsQuery().select(
          'audit_id',
          'user_id',
          'action_type',
          'entity_type',
          'entity_id',
          'ip_address',
          'user_agent',
          'old_values',
          'new_values',
          'created_at'
        ),
      () =>
        baseViolationsQuery().select(
          { audit_id: 'id' },
          'user_id',
          'action_type',
          'entity_type',
          'entity_id',
          'description',
          'ip_address',
          'user_agent',
          'old_values',
          'new_values',
          'created_at'
        ),
      () =>
        baseViolationsQuery().select(
          { audit_id: 'id' },
          'user_id',
          'action_type',
          'entity_type',
          'entity_id',
          'ip_address',
          'user_agent',
          'old_values',
          'new_values',
          'created_at'
        )
    ];

    let violations: any[] = [];
    let lastError: any;
    for (const attempt of violationsQueryAttempts) {
      try {
        violations = await attempt();
        lastError = undefined;
        break;
      } catch (error: any) {
        if (error?.code !== '42703') throw error;
        lastError = error;
      }
    }
    if (lastError) throw lastError;

    // Get user details for violations
    const userIds = violations
      .map((v: any) => v.user_id)
      .filter((id: any) => id);

    const users = await db('users')
      .select('id', 'its_id', 'name', 'email', 'role')
      .whereIn('id', userIds);

    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const enrichedViolations = violations.map((v: any) => ({
      ...v,
      user: v.user_id ? userMap.get(v.user_id) : null,
      old_values: v.old_values ? JSON.parse(v.old_values) : null,
      new_values: v.new_values ? JSON.parse(v.new_values) : null
    }));

    logger.info(`Access violations retrieved by ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        violations: enrichedViolations,
        count: enrichedViolations.length
      }
    });
  } catch (error) {
    logger.error('Error fetching access violations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch access violations'
      }
    });
  }
};
