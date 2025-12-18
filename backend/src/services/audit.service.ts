import db from '../config/database';
import logger from '../utils/logger';

interface AuditLogData {
  user_id?: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'SECURITY_VIOLATION' | 'EXPORT' | 'IMPORT';
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  description?: string;
}

class AuditService {
  /**
   * Log an audit entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await db('audit_logs').insert({
        user_id: data.user_id || null,
        action_type: data.action_type,
        entity_type: data.entity_type,
        entity_id: data.entity_id || null,
        old_values: data.old_values ? JSON.stringify(data.old_values) : null,
        new_values: data.new_values ? JSON.stringify(data.new_values) : null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
        description: data.description || null,
        created_at: new Date()
      });

      logger.info(`Audit log: ${data.action_type} on ${data.entity_type}${data.entity_id ? ` (${data.entity_id})` : ''} by user ${data.user_id || 'system'}`);
    } catch (error) {
      logger.error('Failed to create audit log:', error);
      // Don't throw error to prevent disrupting main operation
    }
  }

  /**
   * Log user login
   */
  async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'LOGIN',
      entity_type: 'user',
      entity_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: 'User logged in'
    });
  }

  /**
   * Log user logout
   */
  async logLogout(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'LOGOUT',
      entity_type: 'user',
      entity_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: 'User logged out'
    });
  }

  /**
   * Log access attempt
   */
  async logAccessAttempt(
    userId: string,
    granted: boolean,
    doorId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: granted ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
      entity_type: 'door',
      entity_id: doorId,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Access ${granted ? 'granted' : 'denied'} to door ${doorId}`
    });
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    userId: string | undefined,
    violationType: string,
    details: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'SECURITY_VIOLATION',
      entity_type: 'security',
      new_values: details,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Security violation: ${violationType}`
    });
  }

  /**
   * Log entity creation
   */
  async logCreate(
    userId: string,
    entityType: string,
    entityId: string,
    entityData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'CREATE',
      entity_type: entityType,
      entity_id: entityId,
      new_values: entityData,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Created ${entityType} ${entityId}`
    });
  }

  /**
   * Log entity update
   */
  async logUpdate(
    userId: string,
    entityType: string,
    entityId: string,
    oldData: any,
    newData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'UPDATE',
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldData,
      new_values: newData,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Updated ${entityType} ${entityId}`
    });
  }

  /**
   * Log entity deletion
   */
  async logDelete(
    userId: string,
    entityType: string,
    entityId: string,
    entityData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'DELETE',
      entity_type: entityType,
      entity_id: entityId,
      old_values: entityData,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Deleted ${entityType} ${entityId}`
    });
  }

  /**
   * Log data export
   */
  async logExport(
    userId: string,
    entityType: string,
    filters: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'EXPORT',
      entity_type: entityType,
      new_values: filters,
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Exported ${entityType} data`
    });
  }

  /**
   * Log data import
   */
  async logImport(
    userId: string,
    entityType: string,
    recordCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action_type: 'IMPORT',
      entity_type: entityType,
      new_values: { record_count: recordCount },
      ip_address: ipAddress,
      user_agent: userAgent,
      description: `Imported ${recordCount} ${entityType} records`
    });
  }

  /**
   * Clean up old audit logs (keep last N days)
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleted = await db('audit_logs')
        .where('created_at', '<', cutoffDate)
        .delete();

      logger.info(`Cleaned up ${deleted} old audit logs (older than ${retentionDays} days)`);
      return deleted;
    } catch (error) {
      logger.error('Failed to clean up audit logs:', error);
      throw error;
    }
  }
}

export default new AuditService();
