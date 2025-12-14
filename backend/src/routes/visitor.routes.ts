import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import {
  checkInVisitor,
  checkOutVisitor,
  getVisitors,
  getVisitorById,
  lookupVisitor
} from '../controllers/visitor.controller';

const router = Router();

// Multer configuration for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.use(authenticate);

router.post('/check-in', authorize('receptionist', 'security', 'admin'), upload.single('photo'), checkInVisitor);
router.post('/:id/check-out', authorize('receptionist', 'admin'), checkOutVisitor);
router.get('/lookup', lookupVisitor);
router.get('/', authorize('receptionist', 'admin', 'security'), getVisitors);
router.get('/:id', authorize('receptionist', 'admin', 'security'), getVisitorById);

export default router;
