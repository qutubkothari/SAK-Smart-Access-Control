import express, { Application } from 'express';
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
import { startVisitorMeetingRemindersJob } from './jobs/visitor-meeting-reminders';

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
import availabilityRoutes from './routes/availability.routes';
import adhocRoutes from './routes/adhoc.routes';
import meetingRoomRoutes from './routes/meetingRoom.routes';
import internalMeetingRoutes from './routes/internalMeeting.routes';
import accessRoutes from './routes/access.routes';
import visitorCardRoutes from './routes/visitorCard.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import holidayRoutes from './routes/holiday.routes';
import shiftRoutes from './routes/shift.routes';
import departmentConfigRoutes from './routes/departmentConfig.routes';
import departmentRoutes from './routes/department.routes';
import reportsRoutes from './routes/reports.routes';
import employeeRoutes from './routes/employee.routes';
import systemRoutes from './routes/system.routes';
import auditRoutes from './routes/audit.routes';
import healthRoutes from './routes/health.routes';
import backupRoutes from './routes/backup.routes';
import securityRoutes from './routes/security.routes';
import analyticsRoutes from './routes/analytics.routes';

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));
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

app.use(`${API_PREFIX}/health`, healthRoutes);

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/meetings`, meetingRoutes);
app.use(`${API_PREFIX}/visitors`, visitorRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/whatsapp`, whatsappRoutes);
app.use(`${API_PREFIX}/gateway`, whatsappGatewayRoutes);
app.use(`${API_PREFIX}/preregister`, preregistrationRoutes);
app.use(`${API_PREFIX}/availability`, availabilityRoutes);
app.use(`${API_PREFIX}/adhoc`, adhocRoutes);
app.use(`${API_PREFIX}/meeting-rooms`, meetingRoomRoutes);
app.use(`${API_PREFIX}/internal-meetings`, internalMeetingRoutes);
app.use(`${API_PREFIX}/access`, accessRoutes);
app.use(`${API_PREFIX}/visitor-cards`, visitorCardRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/leaves`, leaveRoutes);
app.use(`${API_PREFIX}/holidays`, holidayRoutes);
app.use(`${API_PREFIX}/shifts`, shiftRoutes);
app.use(`${API_PREFIX}/departments`, departmentRoutes);
app.use(`${API_PREFIX}/department-config`, departmentConfigRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/me`, employeeRoutes);
app.use(`${API_PREFIX}/system`, systemRoutes);
app.use(`${API_PREFIX}/audit`, auditRoutes);
app.use(`${API_PREFIX}/backup`, backupRoutes);
app.use(`${API_PREFIX}/security`, securityRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);

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
  startVisitorMeetingRemindersJob();

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
