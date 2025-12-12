import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { login, refresh, logout, register } from '../controllers/auth.controller';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
