import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  cleanupBackups
} from '../controllers/backup.controller';

const router = Router();

// All backup endpoints require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Create new backup
router.post('/create', createBackup);

// List all backups
router.get('/', listBackups);

// Download specific backup
router.get('/download/:filename', downloadBackup);

// Delete specific backup
router.delete('/:filename', deleteBackup);

// Restore from backup
router.post('/restore', restoreBackup);

// Cleanup old backups
router.post('/cleanup', cleanupBackups);

export default router;
