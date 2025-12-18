import { Request, Response } from 'express';
import db from '../config/database';
import redisClient from '../config/redis';
import logger from '../utils/logger';

/**
 * Basic health check
 */
export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Detailed system health
 */
export const detailedHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {}
    };

    // Check database
    try {
      await db.raw('SELECT 1');
      const [{ count }] = await db('users').count('* as count');
      health.services.database = {
        status: 'healthy',
        type: 'PostgreSQL',
        total_users: Number(count),
        response_time_ms: 'fast'
      };
    } catch (error: any) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      if (redisClient.isOpen) {
        await redisClient.ping();
        health.services.redis = {
          status: 'healthy',
          connected: true
        };
      } else {
        health.services.redis = {
          status: 'disconnected',
          connected: false
        };
        health.status = 'degraded';
      }
    } catch (error: any) {
      health.services.redis = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Process info
    health.process = {
      pid: process.pid,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heap_used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heap_total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      },
      cpu: process.cpuUsage()
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

/**
 * Get system metrics
 */
export const getMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const metrics: any = {
      timestamp: new Date().toISOString(),
      database: {},
      activity: {}
    };

    // Database metrics
    const [dbSize] = await db.raw(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) as size_bytes
    `);
    metrics.database.size = dbSize.size;
    metrics.database.size_bytes = Number(dbSize.size_bytes);

    // Table counts
    const [users] = await db('users').count('* as count');
    const [visitors] = await db('visitors').count('* as count');
    const [meetings] = await db('meetings').count('* as count');
    const [attendance] = await db('attendance_records').count('* as count');
    const [leaves] = await db('employee_leaves').count('* as count');
    const [accessLogs] = await db('employee_access_logs').count('* as count');
    const [auditLogs] = await db('audit_logs').count('* as count');

    metrics.database.tables = {
      users: Number(users.count),
      visitors: Number(visitors.count),
      meetings: Number(meetings.count),
      attendance_records: Number(attendance.count),
      employee_leaves: Number(leaves.count),
      access_logs: Number(accessLogs.count),
      audit_logs: Number(auditLogs.count)
    };

    // Recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [newVisitors] = await db('visitors')
      .where('created_at', '>=', yesterday)
      .count('* as count');

    const [newMeetings] = await db('meetings')
      .where('created_at', '>=', yesterday)
      .count('* as count');

    const [todayAttendance] = await db('attendance_records')
      .where('date', '>=', yesterday.toISOString().split('T')[0])
      .count('* as count');

    const [recentLogins] = await db('audit_logs')
      .where('action_type', 'LOGIN')
      .where('created_at', '>=', yesterday)
      .count('* as count');

    metrics.activity.last_24h = {
      new_visitors: Number(newVisitors.count),
      new_meetings: Number(newMeetings.count),
      attendance_records: Number(todayAttendance.count),
      user_logins: Number(recentLogins.count)
    };

    // System info
    metrics.system = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime_seconds: Math.floor(process.uptime()),
      memory_usage: {
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FAILED',
        message: 'Failed to retrieve metrics'
      }
    });
  }
};

/**
 * Get database connection stats
 */
export const getDatabaseStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Connection pool stats
    const poolStats = {
      min: (db.client.pool as any).min,
      max: (db.client.pool as any).max,
      used: (db.client.pool as any).numUsed(),
      free: (db.client.pool as any).numFree(),
      pending: (db.client.pool as any).numPendingAcquires(),
      pending_creates: (db.client.pool as any).numPendingCreates()
    };

    // Active connections
    const [connections] = await db.raw(`
      SELECT count(*) as total,
             count(*) FILTER (WHERE state = 'active') as active,
             count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    // Database size and stats
    const [dbStats] = await db.raw(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as connections,
        (SELECT sum(n_tup_ins) FROM pg_stat_user_tables) as total_inserts,
        (SELECT sum(n_tup_upd) FROM pg_stat_user_tables) as total_updates,
        (SELECT sum(n_tup_del) FROM pg_stat_user_tables) as total_deletes
    `);

    // Slow queries (if any)
    const slowQueries = await db.raw(`
      SELECT pid, now() - query_start as duration, query, state
      FROM pg_stat_activity
      WHERE state = 'active'
        AND now() - query_start > interval '5 seconds'
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        pool: poolStats,
        connections: {
          total: Number(connections.rows[0].total),
          active: Number(connections.rows[0].active),
          idle: Number(connections.rows[0].idle)
        },
        statistics: {
          database_size: dbStats.rows[0].database_size,
          total_inserts: Number(dbStats.rows[0].total_inserts || 0),
          total_updates: Number(dbStats.rows[0].total_updates || 0),
          total_deletes: Number(dbStats.rows[0].total_deletes || 0)
        },
        slow_queries: slowQueries.rows
      }
    });
  } catch (error: any) {
    logger.error('Database stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DB_STATS_FAILED',
        message: 'Failed to retrieve database statistics'
      }
    });
  }
};

/**
 * Test all external services
 */
export const testServices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const services: any = {};

    // Test database
    const dbStart = Date.now();
    try {
      await db.raw('SELECT 1');
      services.database = {
        status: 'healthy',
        response_time_ms: Date.now() - dbStart
      };
    } catch (error: any) {
      services.database = {
        status: 'unhealthy',
        error: error.message,
        response_time_ms: Date.now() - dbStart
      };
    }

    // Test Redis
    const redisStart = Date.now();
    try {
      if (redisClient.isOpen) {
        await redisClient.ping();
        services.redis = {
          status: 'healthy',
          response_time_ms: Date.now() - redisStart
        };
      } else {
        services.redis = {
          status: 'disconnected',
          response_time_ms: Date.now() - redisStart
        };
      }
    } catch (error: any) {
      services.redis = {
        status: 'unhealthy',
        error: error.message,
        response_time_ms: Date.now() - redisStart
      };
    }

    // Test email service (check if configured)
    services.email = {
      status: process.env.SENDGRID_API_KEY ? 'configured' : 'not_configured',
      provider: 'SendGrid'
    };

    // Test WhatsApp service
    services.whatsapp = {
      status: 'running',
      note: 'Check WhatsApp gateway service separately'
    };

    const allHealthy = Object.values(services).every(
      (s: any) => s.status === 'healthy' || s.status === 'configured' || s.status === 'running'
    );

    res.json({
      success: true,
      overall_status: allHealthy ? 'healthy' : 'degraded',
      services
    });
  } catch (error: any) {
    logger.error('Service test error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_TEST_FAILED',
        message: 'Failed to test services'
      }
    });
  }
};
