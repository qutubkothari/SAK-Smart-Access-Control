import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import {
  preRegisterVisitor,
  getPreRegisteredVisitors,
  uploadVisitorPhoto,
  approvePreRegistration
} from '../controllers/preregistration.controller';

const router = Router();

// Multer configuration for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Public route - no authentication required
router.post('/register', preRegisterVisitor);

// Protected routes - require authentication
router.use(authenticate);

router.get('/visitors', authorize('host', 'admin', 'security'), getPreRegisteredVisitors);
router.post('/visitors/:visitor_id/photo', upload.single('photo'), uploadVisitorPhoto);
router.post('/visitors/:visitor_id/approve', authorize('host', 'admin'), approvePreRegistration);

export default router;
