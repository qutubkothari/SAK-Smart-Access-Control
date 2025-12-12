import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import WhatsAppService from '../services/whatsapp.service';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

/**
 * Get WhatsApp connection status
 */
router.get('/status', authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const isConnected = WhatsAppService.isWhatsAppConnected();
    
    return res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected ? 'WhatsApp is connected' : 'WhatsApp is not connected'
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_STATUS_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * Get WhatsApp QR code for pairing
 */
router.get('/qr-code', authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const qrCode = WhatsAppService.getQRCode();
    
    if (!qrCode) {
      return res.json({
        success: true,
        data: {
          qrCode: null,
          message: 'WhatsApp is already connected or QR code not generated yet'
        }
      });
    }
    
    return res.json({
      success: true,
      data: {
        qrCode,
        message: 'Scan this QR code with WhatsApp on your phone'
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_QR_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * Reinitialize WhatsApp connection
 */
router.post('/reconnect', authorize('admin'), async (_req: Request, res: Response) => {
  try {
    await WhatsAppService.initialize();
    
    return res.json({
      success: true,
      message: 'WhatsApp reconnection initiated'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_RECONNECT_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * Disconnect WhatsApp
 */
router.post('/disconnect', authorize('admin'), async (_req: Request, res: Response) => {
  try {
    await WhatsAppService.disconnect();
    
    return res.json({
      success: true,
      message: 'WhatsApp disconnected successfully'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'WHATSAPP_DISCONNECT_ERROR',
        message: error.message
      }
    });
  }
});

export default router;
