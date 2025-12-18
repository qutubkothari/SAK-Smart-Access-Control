# SAK Smart Access Control - Complete Deployment Guide

**Version:** 1.0.0  
**Environment:** Production  
**Last Updated:** December 16, 2025

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [PM2 Process Management](#pm2-process-management)
9. [Automated Jobs & Cron](#automated-jobs--cron)
10. [Monitoring & Logging](#monitoring--logging)
11. [Backup & Recovery](#backup--recovery)
12. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Server Specifications
- **Provider:** AWS EC2
- **Instance Type:** t2.medium or higher
- **vCPUs:** 2+
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 30GB SSD minimum
- **OS:** Ubuntu 22.04 LTS

### Software Dependencies
- **Node.js:** v18.x or higher
- **PostgreSQL:** v14.x or higher
- **Nginx:** v1.24.x or higher
- **PM2:** v5.x or higher
- **Redis:** v7.x or higher
- **Git:** v2.x or higher

### Network Requirements
- **Ports:**
  - 80 (HTTP - redirects to HTTPS)
  - 443 (HTTPS)
  - 3000 (Backend API - internal)
  - 5432 (PostgreSQL - internal)
  - 6379 (Redis - internal)
  - 22 (SSH - restricted)

---

## Infrastructure Setup

### 1. Launch EC2 Instance

```bash
# AWS EC2 Configuration
Instance Type: t2.medium
AMI: Ubuntu 22.04 LTS (ami-xxxx)
Storage: 30GB gp3 SSD
Security Group: Allow ports 22, 80, 443
Key Pair: sak-smart-access.pem
Elastic IP: 3.108.52.219
```

### 2. Initial Server Setup

```bash
# Connect to server
ssh -i sak-smart-access.pem ubuntu@3.108.52.219

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y build-essential curl wget git unzip software-properties-common

# Set timezone
sudo timedatectl set-timezone UTC
```

### 3. Install Node.js

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 4. Install PostgreSQL

```bash
# Install PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
```

### 5. Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis for systemd
sudo nano /etc/redis/redis.conf
# Change: supervised no → supervised systemd

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping  # Should return PONG
```

### 6. Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
nginx -v  # nginx version: nginx/1.24.0
```

### 7. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup systemd
# Copy and run the generated command

# Save PM2 configuration
pm2 save
```

---

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE sak_access_control;
CREATE USER sak_admin WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_admin;
\q
```

### 2. Run Database Migrations

```sql
-- Connect to database
psql -U sak_admin -d sak_access_control -h localhost

-- Execute schema creation (from database/schema.sql)
\i /path/to/schema.sql

-- Verify tables created
\dt

-- Expected tables (13 total):
-- users, departments, meetings, visitors, visitor_cards
-- attendance_records, leaves, holidays, shifts, department_configs
-- notifications, backups, audit_logs
```

### 3. Create Initial Admin User

```sql
-- Insert admin user with hashed password
INSERT INTO users (
  id, its_id, name, email, phone, password_hash, role, 
  department_id, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'ITS0001',
  'System Admin',
  'admin@saksolution.com',
  '+919876543210',
  -- bcrypt hash for 'Admin@123'
  '$2b$10$YourHashedPasswordHere',
  'admin',
  (SELECT id FROM departments WHERE name = 'Administration' LIMIT 1),
  true,
  NOW(),
  NOW()
);
```

### 4. Configure Database Connection

```bash
# Backend .env configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=sak_access_control
DATABASE_USER=sak_admin
DATABASE_PASSWORD=your_secure_password_here
DATABASE_SSL=false
```

---

## Backend Deployment

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /home/ubuntu/SAK-Smart-Access-Control
sudo chown ubuntu:ubuntu /home/ubuntu/SAK-Smart-Access-Control

# Clone repository
cd /home/ubuntu
git clone https://github.com/your-repo/SAK-Smart-Access-Control.git
cd SAK-Smart-Access-Control/backend
```

### 2. Install Dependencies

```bash
# Install Node packages
npm install

# Install TypeScript globally (if needed)
sudo npm install -g typescript
```

### 3. Configure Environment

```bash
# Create .env file
nano .env
```

**Complete .env Configuration:**
```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=sak_access_control
DATABASE_USER=sak_admin
DATABASE_PASSWORD=your_secure_password_here
DATABASE_SSL=false

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_min_32_chars_long_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Configuration
CORS_ORIGIN=https://sac.saksolution.com,http://localhost:5173

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@saksolution.com

# WhatsApp Configuration (optional)
WHATSAPP_ENABLED=true
WHATSAPP_PHONE=+919876543210

# File Upload Configuration
UPLOAD_PATH=/home/ubuntu/SAK-Smart-Access-Control/uploads
MAX_FILE_SIZE=5242880

# QR Code Configuration
QR_CODE_EXPIRY_HOURS=24
QR_CODE_PREFIX=MTG-

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=10

# Security
ACCOUNT_LOCKOUT_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=30
SESSION_SECRET=your_session_secret_here

# Backup Configuration
BACKUP_PATH=/home/ubuntu/backups
BACKUP_RETENTION_DAYS=30

# Logging
LOG_LEVEL=info
LOG_FILE=/home/ubuntu/SAK-Smart-Access-Control/logs/app.log
```

### 4. Build Application

```bash
# Compile TypeScript
npm run build

# Verify build output
ls -la dist/
```

### 5. Start with PM2

```bash
# Start application
pm2 start dist/server.js --name sak-backend --node-args="--max-old-space-size=2048"

# Configure auto-restart
pm2 startup systemd
pm2 save

# Check status
pm2 status

# View logs
pm2 logs sak-backend --lines 100
```

**PM2 Ecosystem File (ecosystem.config.js):**
```javascript
module.exports = {
  apps: [{
    name: 'sak-backend',
    script: './dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/ubuntu/.pm2/logs/sak-backend-error.log',
    out_file: '/home/ubuntu/.pm2/logs/sak-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};

// Start with: pm2 start ecosystem.config.js
```

---

## Frontend Deployment

### 1. Build Frontend

```bash
# On local development machine
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Create deployment tarball
tar -czf frontend-dist.tar.gz -C dist .
```

### 2. Upload to Server

```bash
# Upload from local machine
scp -i sak-smart-access.pem frontend-dist.tar.gz ubuntu@3.108.52.219:/tmp/
```

### 3. Deploy on Server

```bash
# On server, create web directory
sudo mkdir -p /var/www/sak-frontend
sudo chown -R www-data:www-data /var/www/sak-frontend

# Extract build files
sudo tar -xzf /tmp/frontend-dist.tar.gz -C /var/www/sak-frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/sak-frontend
sudo chmod -R 755 /var/www/sak-frontend

# Clean up
rm /tmp/frontend-dist.tar.gz
```

### 4. Configure Environment

Create `/var/www/sak-frontend/.env.production`:
```env
VITE_API_BASE_URL=https://sac.saksolution.com/api/v1
VITE_SOCKET_URL=https://sac.saksolution.com
VITE_WHATSAPP_ENABLED=true
```

---

## Nginx Configuration

### 1. Create Nginx Configuration

```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/sak-frontend
```

**Complete Nginx Configuration:**
```nginx
# Upstream backend API
upstream sak_backend {
    server localhost:3000;
    keepalive 64;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name sac.saksolution.com www.sac.saksolution.com;

    # Redirect all HTTP to HTTPS
    return 301 https://sac.saksolution.com$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sac.saksolution.com www.sac.saksolution.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/sac.saksolution.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sac.saksolution.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Frontend root
    root /var/www/sak-frontend;
    index index.html;

    # Logging
    access_log /var/log/nginx/sak-access.log;
    error_log /var/log/nginx/sak-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # API proxy
    location /api/ {
        proxy_pass http://sak_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://sak_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files with caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 2. Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/sak-frontend /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Setup

### 1. Install Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate

```bash
# Generate certificate (interactive)
sudo certbot --nginx -d sac.saksolution.com -d www.sac.saksolution.com

# Or non-interactive
sudo certbot --nginx -d sac.saksolution.com -d www.sac.saksolution.com \
  --non-interactive --agree-tos --email admin@saksolution.com
```

### 3. Configure Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup automatic renewal (already configured via systemd timer)
sudo systemctl status certbot.timer

# Manual renewal
sudo certbot renew
sudo systemctl reload nginx
```

---

## PM2 Process Management

### Common PM2 Commands

```bash
# View all processes
pm2 list

# View specific process
pm2 show sak-backend

# View logs
pm2 logs sak-backend
pm2 logs sak-backend --lines 200
pm2 logs sak-backend --err  # Error logs only

# Restart application
pm2 restart sak-backend

# Stop application
pm2 stop sak-backend

# Delete process
pm2 delete sak-backend

# Monitor resources
pm2 monit

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

### PM2 Monitoring

```bash
# Install PM2 Plus (optional - cloud monitoring)
pm2 plus

# Generate status report
pm2 report

# Check memory usage
pm2 list | grep 'mem'
```

---

## Automated Jobs & Cron

### 1. Backend Cron Jobs (Configured in Code)

**Attendance Calculation** - Daily at 1:00 AM UTC
```typescript
// Calculates daily attendance for all employees
cron.schedule('0 1 * * *', calculateDailyAttendance);
```

**Email Notifications** - Daily at 2:00 AM UTC
```typescript
// Sends pending email notifications
cron.schedule('0 2 * * *', sendPendingEmails);
```

**Database Backup** - Daily at 3:00 AM UTC
```typescript
// Backs up PostgreSQL database
cron.schedule('0 3 * * *', performDatabaseBackup);
```

**Auto Checkout** - Every 15 minutes
```typescript
// Auto-checks out visitors past meeting end time
cron.schedule('*/15 * * * *', autoCheckoutVisitors);
```

**Meeting Reminders** - Every 15 minutes
```typescript
// Sends WhatsApp reminders for upcoming meetings
cron.schedule('*/15 * * * *', sendMeetingReminders);
```

### 2. System Cron Jobs

```bash
# Edit crontab
crontab -e
```

**Log Rotation:**
```bash
# Rotate PM2 logs daily at midnight
0 0 * * * pm2 flush
```

**System Cleanup:**
```bash
# Clean old backups (keep last 30 days)
0 4 * * * find /home/ubuntu/backups -type f -mtime +30 -delete
```

**SSL Certificate Check:**
```bash
# Check certificate expiry weekly
0 0 * * 0 certbot renew --quiet && systemctl reload nginx
```

---

## Monitoring & Logging

### 1. Application Logs

**Backend Logs:**
```bash
# PM2 logs
pm2 logs sak-backend
tail -f /home/ubuntu/.pm2/logs/sak-backend-out.log
tail -f /home/ubuntu/.pm2/logs/sak-backend-error.log

# Application logs (if configured)
tail -f /home/ubuntu/SAK-Smart-Access-Control/logs/app.log
```

**Nginx Logs:**
```bash
# Access logs
sudo tail -f /var/log/nginx/sak-access.log

# Error logs
sudo tail -f /var/log/nginx/sak-error.log

# Search for errors
sudo grep "error" /var/log/nginx/sak-error.log
```

**PostgreSQL Logs:**
```bash
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 2. System Monitoring

**Resource Usage:**
```bash
# CPU and memory
htop

# Disk usage
df -h

# Disk I/O
iostat -x 1

# Network connections
netstat -tuln
```

**Process Monitoring:**
```bash
# Node processes
ps aux | grep node

# Nginx processes
ps aux | grep nginx

# PostgreSQL processes
ps aux | grep postgres
```

### 3. Database Monitoring

```bash
# Connect to database
psql -U sak_admin -d sak_access_control

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('sak_access_control'));

# Check table sizes
SELECT 
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

# Check slow queries
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

---

## Backup & Recovery

### 1. Database Backup

**Manual Backup:**
```bash
# Create backup directory
mkdir -p /home/ubuntu/backups

# Backup database
pg_dump -U sak_admin -d sak_access_control -F c -f /home/ubuntu/backups/sak_backup_$(date +%Y%m%d_%H%M%S).dump

# Backup with compression
pg_dump -U sak_admin -d sak_access_control | gzip > /home/ubuntu/backups/sak_backup_$(date +%Y%m%d).sql.gz
```

**Automated Backup (Cron):**
```bash
# Daily backup at 3 AM
0 3 * * * pg_dump -U sak_admin -d sak_access_control -F c -f /home/ubuntu/backups/sak_backup_$(date +\%Y\%m\%d).dump
```

### 2. Database Restore

```bash
# Restore from custom format
pg_restore -U sak_admin -d sak_access_control -c /home/ubuntu/backups/sak_backup_20251216.dump

# Restore from SQL file
psql -U sak_admin -d sak_access_control < /home/ubuntu/backups/sak_backup_20251216.sql

# Restore from gzipped SQL
gunzip -c /home/ubuntu/backups/sak_backup_20251216.sql.gz | psql -U sak_admin -d sak_access_control
```

### 3. Application Backup

```bash
# Backup entire application
cd /home/ubuntu
tar -czf sak-backup-$(date +%Y%m%d).tar.gz SAK-Smart-Access-Control/

# Backup configuration only
tar -czf sak-config-$(date +%Y%m%d).tar.gz \
  SAK-Smart-Access-Control/backend/.env \
  SAK-Smart-Access-Control/frontend/.env \
  /etc/nginx/sites-available/sak-frontend
```

### 4. Download Backups

```bash
# From local machine
scp -i sak-smart-access.pem ubuntu@3.108.52.219:/home/ubuntu/backups/sak_backup_*.dump ./
```

---

## Troubleshooting

### Common Issues

**1. Backend Not Starting**
```bash
# Check PM2 logs
pm2 logs sak-backend --err

# Check port availability
sudo lsof -i :3000

# Restart application
pm2 restart sak-backend

# Full restart
pm2 delete sak-backend
pm2 start ecosystem.config.js
```

**2. Database Connection Issues**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**3. Nginx Errors**
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/sak-error.log

# Restart Nginx
sudo systemctl restart nginx

# Check if running
sudo systemctl status nginx
```

**4. High Memory Usage**
```bash
# Check PM2 processes
pm2 list

# Restart with memory limit
pm2 restart sak-backend --max-memory-restart 1G

# Clear logs
pm2 flush
```

**5. SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Reload Nginx
sudo systemctl reload nginx
```

**6. Rate Limiting Issues**
```bash
# Check Redis
redis-cli ping

# Flush rate limit data
redis-cli FLUSHDB

# Restart Redis
sudo systemctl restart redis-server
```

### Performance Optimization

**1. Database Optimization**
```sql
-- Vacuum database
VACUUM ANALYZE;

-- Reindex tables
REINDEX DATABASE sak_access_control;

-- Check for missing indexes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**2. Nginx Optimization**
```nginx
# Increase worker processes
worker_processes auto;

# Increase worker connections
events {
    worker_connections 2048;
}

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;
```

**3. Node.js Optimization**
```bash
# Increase memory limit
pm2 restart sak-backend --node-args="--max-old-space-size=4096"

# Enable cluster mode (multiple instances)
pm2 start ecosystem.config.js -i max
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Server provisioned and accessible
- [ ] Domain DNS configured (A record pointing to server IP)
- [ ] SSH key-based authentication configured
- [ ] Firewall rules configured (ports 22, 80, 443)

### Database
- [ ] PostgreSQL installed and running
- [ ] Database created with correct permissions
- [ ] Schema migrations applied
- [ ] Initial admin user created
- [ ] Backups configured

### Backend
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] TypeScript compiled successfully
- [ ] PM2 process running
- [ ] Health check endpoint responding

### Frontend
- [ ] Build completed successfully
- [ ] Files deployed to /var/www/sak-frontend
- [ ] Correct permissions set
- [ ] Environment variables configured

### Nginx
- [ ] Configuration file created
- [ ] Site enabled
- [ ] SSL certificate obtained
- [ ] Configuration tested (nginx -t)
- [ ] HTTPS working correctly

### Monitoring
- [ ] PM2 startup configured
- [ ] Cron jobs scheduled
- [ ] Log rotation configured
- [ ] Backup jobs running
- [ ] SSL auto-renewal working

### Security
- [ ] JWT secrets generated
- [ ] Strong database passwords set
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Audit logging active

### Final Tests
- [ ] Login functionality working
- [ ] API endpoints responding
- [ ] WebSocket connections stable
- [ ] Email notifications sending
- [ ] WhatsApp integration working (if enabled)
- [ ] Analytics dashboard loading
- [ ] Security monitoring active

---

## Quick Reference

### Server Access
```bash
ssh -i sak-smart-access.pem ubuntu@3.108.52.219
```

### Application URLs
- **Frontend:** https://sac.saksolution.com
- **Backend API:** https://sac.saksolution.com/api/v1
- **Health Check:** https://sac.saksolution.com/api/v1/health

### Key Directories
- **Backend:** `/home/ubuntu/SAK-Smart-Access-Control/backend`
- **Frontend:** `/var/www/sak-frontend`
- **Logs:** `/home/ubuntu/.pm2/logs`
- **Backups:** `/home/ubuntu/backups`
- **Nginx Config:** `/etc/nginx/sites-available/sak-frontend`

### Support Contacts
- **Development Team:** dev@saksolution.com
- **System Admin:** admin@saksolution.com
- **Emergency:** +91-XXXX-XXXX

---

**Document Version:** 1.0.0  
**Last Updated:** December 16, 2025  
**Maintained by:** SAK Development Team
