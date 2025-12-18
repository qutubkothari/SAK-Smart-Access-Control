import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || '/home/ubuntu/SAK-Smart-Access-Control/backups';
const DB_NAME = process.env.DB_NAME || 'sak_access_control';
const DB_USER = process.env.DB_USER || 'sak_db_user';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';

/**
 * Create database backup
 */
export const createBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Create backup using pg_dump
    const command = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p -f ${backupPath}`;
    
    logger.info(`Creating backup: ${backupFileName}`);
    await execAsync(command);

    // Get file size
    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Create metadata file
    const metadata = {
      filename: backupFileName,
      created_at: new Date().toISOString(),
      created_by: req.user!.id,
      size_mb: fileSizeMB,
      description: description || 'Manual backup',
      database: DB_NAME
    };

    fs.writeFileSync(
      path.join(BACKUP_DIR, `${backupFileName}.meta.json`),
      JSON.stringify(metadata, null, 2)
    );

    logger.info(`Backup created successfully: ${backupFileName} (${fileSizeMB} MB)`);

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: {
        filename: backupFileName,
        path: backupPath,
        size_mb: fileSizeMB,
        created_at: metadata.created_at
      }
    });
  } catch (error: any) {
    logger.error('Backup creation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BACKUP_FAILED',
        message: 'Failed to create backup',
        details: error.message
      }
    });
  }
};

/**
 * List all backups
 */
export const listBackups = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      res.json({
        success: true,
        data: [],
        message: 'No backups found'
      });
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.endsWith('.sql'));

    const backups = backupFiles.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const metaPath = path.join(BACKUP_DIR, `${file}.meta.json`);

      let metadata: any = {
        description: 'No description',
        created_by: 'Unknown'
      };

      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch (e) {
          // Ignore metadata read errors
        }
      }

      return {
        filename: file,
        size_mb: (stats.size / (1024 * 1024)).toFixed(2),
        created_at: stats.mtime.toISOString(),
        description: metadata.description,
        created_by: metadata.created_by
      };
    });

    // Sort by creation date, newest first
    backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      success: true,
      data: backups,
      meta: {
        total: backups.length,
        total_size_mb: backups.reduce((sum, b) => sum + parseFloat(b.size_mb), 0).toFixed(2)
      }
    });
  } catch (error: any) {
    logger.error('Failed to list backups:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_BACKUPS_FAILED',
        message: 'Failed to list backups'
      }
    });
  }
};

/**
 * Download backup file
 */
export const downloadBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (!filename.match(/^backup_[\d-]+\.sql$/)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILENAME',
          message: 'Invalid backup filename'
        }
      });
      return;
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: 'Backup file not found'
        }
      });
      return;
    }

    res.download(backupPath, filename, (err) => {
      if (err) {
        logger.error('Download error:', err);
      }
    });
  } catch (error: any) {
    logger.error('Failed to download backup:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DOWNLOAD_FAILED',
        message: 'Failed to download backup'
      }
    });
  }
};

/**
 * Delete backup file
 */
export const deleteBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (!filename.match(/^backup_[\d-]+\.sql$/)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILENAME',
          message: 'Invalid backup filename'
        }
      });
      return;
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    const metaPath = path.join(BACKUP_DIR, `${filename}.meta.json`);

    if (!fs.existsSync(backupPath)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: 'Backup file not found'
        }
      });
      return;
    }

    // Delete backup file
    fs.unlinkSync(backupPath);

    // Delete metadata file if exists
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    logger.info(`Backup deleted: ${filename} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete backup:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete backup'
      }
    });
  }
};

/**
 * Restore database from backup
 */
export const restoreBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.body;

    // Validate filename
    if (!filename.match(/^backup_[\d-]+\.sql$/)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILENAME',
          message: 'Invalid backup filename'
        }
      });
      return;
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BACKUP_NOT_FOUND',
          message: 'Backup file not found'
        }
      });
      return;
    }

    logger.warn(`Database restore initiated by user ${req.user!.id} from backup: ${filename}`);

    // Create a backup before restoring
    const preRestoreBackup = `pre_restore_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const preRestorePath = path.join(BACKUP_DIR, preRestoreBackup);
    
    const backupCommand = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p -f ${preRestorePath}`;
    await execAsync(backupCommand);
    logger.info(`Pre-restore backup created: ${preRestoreBackup}`);

    // Restore from backup
    const restoreCommand = `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f ${backupPath}`;
    await execAsync(restoreCommand);

    logger.info(`Database restored from backup: ${filename}`);

    res.json({
      success: true,
      message: 'Database restored successfully',
      data: {
        restored_from: filename,
        pre_restore_backup: preRestoreBackup
      }
    });
  } catch (error: any) {
    logger.error('Restore failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESTORE_FAILED',
        message: 'Failed to restore database',
        details: error.message
      }
    });
  }
};

/**
 * Cleanup old backups
 */
export const cleanupBackups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { keep_days = 30 } = req.query;
    const keepDays = Number(keep_days);

    if (!fs.existsSync(BACKUP_DIR)) {
      res.json({
        success: true,
        message: 'No backups to clean up',
        data: { deleted: 0 }
      });
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.endsWith('.sql'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    let deletedCount = 0;

    for (const file of backupFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        
        const metaPath = path.join(BACKUP_DIR, `${file}.meta.json`);
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }

        deletedCount++;
        logger.info(`Deleted old backup: ${file}`);
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} backup(s) older than ${keepDays} days`,
      data: {
        deleted: deletedCount,
        keep_days: keepDays
      }
    });
  } catch (error: any) {
    logger.error('Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLEANUP_FAILED',
        message: 'Failed to cleanup backups'
      }
    });
  }
};
