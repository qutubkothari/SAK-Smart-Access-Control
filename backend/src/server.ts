import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { rateLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';
import redisClient, { connectRedis } from './config/redis';
import { startAutoCheckoutJob } from './jobs/auto-checkout';

// Routes
import authRoutes from './routes/auth.routes';
import meetingRoutes from './routes/meeting.routes';
import visitorRoutes from './routes/visitor.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import whatsappGatewayRoutes from './routes/whatsapp-gateway.routes';
import preregistrationRoutes from './routes/preregistration.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const server = http.createServer(app);

// Behind Nginx reverse proxy on EC2
app.set('trust proxy', 1);

// API responses should not be cached by browsers/proxies (prevents 304 + empty-body issues in clients)
app.disable('etag');

// Socket.IO setup
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST']
  },
  path: process.env.SOCKET_IO_PATH || '/socket.io'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// API Routes
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

app.use((req, res, next) => {
  if (req.path.startsWith(API_PREFIX)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Health check (also exposed under the API prefix for load balancers / clients)
const healthHandler = (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'SAK Access Control API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
};

app.get('/health', healthHandler);
app.get(`${API_PREFIX}/health`, healthHandler);

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/meetings`, meetingRoutes);
app.use(`${API_PREFIX}/visitors`, visitorRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/whatsapp`, whatsappRoutes);
app.use(`${API_PREFIX}/gateway`, whatsappGatewayRoutes);
app.use(`${API_PREFIX}/preregister`, preregistrationRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join_room', (userId: string) => {
    socket.join(`user_${userId}`);
    logger.info(`User ${userId} joined their notification room`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectRedis();
  } catch (error) {
    logger.error('Redis connection failed. QR code features may not work:', error);
  }

  // Start auto-checkout cron job
  startAutoCheckoutJob();

  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info(`📡 Socket.IO server ready`);
    logger.info(`🔗 API available at http://localhost:${PORT}${API_PREFIX}`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    try {
      redisClient.disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  });
});

export default app;
