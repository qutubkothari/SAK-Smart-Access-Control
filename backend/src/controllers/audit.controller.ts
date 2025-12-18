import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../utils/logger';

/**
 * Get audit logs with filtering and pagination
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      action_type,
      entity_type,
      from_date,
      to_date,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = db('audit_logs as al')
      .leftJoin('users as u', 'al.user_id', 'u.user_id')
      .select(
        'al.audit_id',
        'al.user_id',
        'u.full_name as user_name',
        'u.email as user_email',
        'al.action_type',
        'al.entity_type',
        'al.entity_id',
        'al.old_values',
        'al.new_values',
        'al.ip_address',
        'al.user_agent',
        'al.created_at'
      )
      .orderBy('al.created_at', 'desc');

    // Apply filters
    if (user_id) {
      query = query.where('al.user_id', user_id as string);
    }

    if (action_type) {
      query = query.where('al.action_type', action_type as string);
    }

    if (entity_type) {
      query = query.where('al.entity_type', entity_type as string);
    }

    if (from_date) {
      query = query.where('al.created_at', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('al.created_at', '<=', from_date as string);
    }

    const [{ count }] = await query.clone().count('* as count');
    const logs = await query.limit(Number(limit)).offset(offset);

    res.json({
      success: true,
      data: logs,
      meta: {
        total: Number(count),
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(Number(count) / Number(limit))
      }
    });
  } catch (error: any) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUDIT_FETCH_FAILED',
        message: 'Failed to fetch audit logs'
      }
    });
  }
};

/**
 * Get audit log statistics
 */
export const getAuditStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from_date, to_date } = req.query;

    let query = db('audit_logs');

    if (from_date) {
      query = query.where('created_at', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date as string);
    }

    // Get statistics
    const [totalLogs] = await query.clone().count('* as count');
    
    const actionStats = await query.clone()
      .select('action_type')
      .count('* as count')
      .groupBy('action_type')
      .orderBy('count', 'desc');

    const entityStats = await query.clone()
      .select('entity_type')
      .count('* as count')
      .groupBy('entity_type')
      .orderBy('count', 'desc');

    const topUsers = await query.clone()
      .join('users as u', 'audit_logs.user_id', 'u.user_id')
      .select('audit_logs.user_id', 'u.full_name', 'u.email')
      .count('* as count')
      .groupBy('audit_logs.user_id', 'u.full_name', 'u.email')
      .orderBy('count', 'desc')
      .limit(10);

    // Recent critical actions
    const criticalActions = await query.clone()
      .join('users as u', 'audit_logs.user_id', 'u.user_id')
      .select(
        'audit_logs.audit_id',
        'audit_logs.action_type',
        'audit_logs.entity_type',
        'audit_logs.entity_id',
        'u.full_name',
        'audit_logs.created_at'
      )
      .whereIn('action_type', ['DELETE', 'SECURITY_VIOLATION', 'ACCESS_DENIED'])
      .orderBy('audit_logs.created_at', 'desc')
      .limit(20);

    res.json({
      success: true,
      data: {
        total_logs: Number(totalLogs.count),
        action_statistics: actionStats.map(s => ({
          action_type: s.action_type,
          count: Number(s.count)
        })),
        entity_statistics: entityStats.map(s => ({
          entity_type: s.entity_type,
          count: Number(s.count)
        })),
        top_users: topUsers.map(u => ({
          user_id: u.user_id,
          full_name: u.full_name,
          email: u.email,
          action_count: Number(u.count)
        })),
        critical_actions: criticalActions
      }
    });
  } catch (error: any) {
    logger.error('Error fetching audit statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATISTICS_FETCH_FAILED',
        message: 'Failed to fetch audit statistics'
      }
    });
  }
};

/**
 * Get user activity timeline
 */
export const getUserActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id } = req.params;
    const { from_date, to_date, limit = 100 } = req.query;

    let query = db('audit_logs')
      .where('user_id', user_id)
      .select(
        'audit_id',
        'action_type',
        'entity_type',
        'entity_id',
        'old_values',
        'new_values',
        'ip_address',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(Number(limit));

    if (from_date) {
      query = query.where('created_at', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date as string);
    }

    const activity = await query;

    // Get user info
    const user = await db('users')
      .where('user_id', user_id)
      .select('user_id', 'full_name', 'email', 'role')
      .first();

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
        activity,
        total_actions: activity.length
      }
    });
  } catch (error: any) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVITY_FETCH_FAILED',
        message: 'Failed to fetch user activity'
      }
    });
  }
};

/**
 * Export audit logs to CSV
 */
export const exportAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from_date, to_date, action_type, entity_type } = req.query;

    let query = db('audit_logs as al')
      .leftJoin('users as u', 'al.user_id', 'u.user_id')
      .select(
        'al.audit_id',
        'al.user_id',
        'u.full_name as user_name',
        'u.email as user_email',
        'al.action_type',
        'al.entity_type',
        'al.entity_id',
        'al.ip_address',
        'al.user_agent',
        'al.created_at'
      )
      .orderBy('al.created_at', 'desc')
      .limit(10000); // Limit to prevent memory issues

    if (from_date) {
      query = query.where('al.created_at', '>=', from_date as string);
    }

    if (to_date) {
      query = query.where('al.created_at', '<=', to_date as string);
    }

    if (action_type) {
      query = query.where('al.action_type', action_type as string);
    }

    if (entity_type) {
      query = query.where('al.entity_type', entity_type as string);
    }

    const logs = await query;

    // Generate CSV
    const headers = [
      'Audit ID',
      'User ID',
      'User Name',
      'User Email',
      'Action Type',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Timestamp'
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.audit_id,
        log.user_id || '',
        log.user_name || '',
        log.user_email || '',
        log.action_type,
        log.entity_type,
        log.entity_id || '',
        log.ip_address || '',
        `"${(log.user_agent || '').replace(/"/g, '""')}"`,
        new Date(log.created_at).toISOString()
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: 'Failed to export audit logs'
      }
    });
  }
};
