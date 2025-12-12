import { Router, Request, Response } from 'express';
import WhatsAppGateway from '../services/whatsapp-gateway.service';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Middleware to validate API key
 */
const validateApiKey = (req: Request, res: Response, next: any): void => {
  const sessionId = req.params.sessionId || req.body.sessionId || 'default';
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required in x-api-key header'
    });
    return;
  }

  if (!WhatsAppGateway.validateApiKey(sessionId, apiKey)) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key or inactive session'
    });
    return;
  }

  next();
};

/**
 * Create a new WhatsApp session
 * POST /gateway/sessions
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { sessionId, name, webhook, apiKey } = req.body;

    if (!sessionId || !name || !apiKey) {
      res.status(400).json({
        success: false,
        error: 'sessionId, name, and apiKey are required'
      });
      return;
    }

    const result = await WhatsAppGateway.createSession({
      sessionId,
      name,
      webhook,
      apiKey,
      isActive: true
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get session status
 * GET /gateway/:sessionId/status
 */
router.get('/:sessionId/status', validateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const status = WhatsAppGateway.getSessionStatus(sessionId);

  res.json({
    success: true,
    data: status
  });
});

/**
 * Get QR code for session
 * GET /gateway/:sessionId/qr
 */
router.get('/:sessionId/qr', validateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const status = WhatsAppGateway.getSessionStatus(sessionId);

  if (!status.exists) {
    res.status(404).json({
      success: false,
      error: 'Session not found'
    });
    return;
  }

  res.json({
    success: true,
    data: {
      qrCode: status.qrCode,
      message: status.qrCode 
        ? 'Scan this QR code with WhatsApp' 
        : 'Already connected or QR not generated'
    }
  });
});

/**
 * Send text message
 * POST /gateway/:sessionId/send
 */
router.post('/:sessionId/send', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { to, message } = req.body;

    if (!to || !message) {
      res.status(400).json({
        success: false,
        error: 'to and message are required'
      });
      return;
    }

    const result = await WhatsAppGateway.sendMessage(sessionId, to, message);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send image
 * POST /gateway/:sessionId/send-image
 */
router.post(
  '/:sessionId/send-image', 
  validateApiKey, 
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { to, caption } = req.body;

      if (!to || !req.file) {
        res.status(400).json({
          success: false,
          error: 'to and image file are required'
        });
        return;
      }

      const result = await WhatsAppGateway.sendImage(
        sessionId,
        to,
        req.file.buffer,
        caption
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Send document
 * POST /gateway/:sessionId/send-document
 */
router.post(
  '/:sessionId/send-document',
  validateApiKey,
  upload.single('document'),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { to, caption } = req.body;

      if (!to || !req.file) {
        res.status(400).json({
          success: false,
          error: 'to and document file are required'
        });
        return;
      }

      const filename = req.file.originalname || 'document.pdf';

      const result = await WhatsAppGateway.sendDocument(
        sessionId,
        to,
        req.file.buffer,
        filename,
        caption
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Delete session
 * DELETE /gateway/:sessionId
 */
router.delete('/:sessionId', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const success = await WhatsAppGateway.deleteSession(sessionId);

    res.json({
      success,
      message: success ? 'Session deleted' : 'Failed to delete session'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List all sessions (admin only)
 * GET /gateway/sessions/list
 */
router.get('/sessions/list', async (_req: Request, res: Response) => {
  try {
    const sessions = WhatsAppGateway.listSessions();
    res.json({
      success: true,
      data: sessions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
