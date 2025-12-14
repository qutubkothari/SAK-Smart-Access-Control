# 🚀 Quick Start - Deploy to EC2 in 15 Minutes

## Prerequisites Checklist
- [ ] EC2 instance running (3.108.52.219)
- [ ] PEM key file in root: `sak-smart-access.pem`
- [ ] GitHub repository cloned locally
- [ ] AWS account access (for SES setup later)

---

## Step 1: Connect to EC2 (1 min)
```bash
ssh -i sak-smart-access.pem ubuntu@3.108.52.219
```

---

## Step 2: Install Required Software (5 min)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node --version        # Should show v18.x.x
psql --version       # Should show PostgreSQL 14
redis-cli ping       # Should return PONG
nginx -v             # Should show nginx version
```

---

## Step 3: Setup PostgreSQL Database (3 min)
```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'ChangeThisPassword123!';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\c sak_access_control
GRANT ALL ON SCHEMA public TO sak_user;
EOF

# Test connection
psql -U sak_user -d sak_access_control -h localhost -c "SELECT version();"
```

---

## Step 4: Setup Application Code (3 min)
```bash
# Clone repository (or use git pull if already cloned)
cd ~
git clone https://github.com/YOUR_USERNAME/SAK-Smart-Access-Control.git
cd SAK-Smart-Access-Control/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

**Edit .env file with these values:**
```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=sak_user
DB_PASSWORD=ChangeThisPassword123!
DB_NAME=sak_access_control

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend URL (update after frontend deployment)
FRONTEND_URL=http://3.108.52.219

# AWS SES Configuration (configure later)
AWS_REGION=ap-south-1
# AWS_ACCESS_KEY_ID=your-aws-access-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret-key
# AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# Twilio Configuration (optional - configure later)
# TWILIO_ACCOUNT_SID=your-twilio-sid
# TWILIO_AUTH_TOKEN=your-twilio-token
# TWILIO_PHONE_NUMBER=your-twilio-phone
# TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# QR Code Encryption
QR_ENCRYPTION_KEY=your-32-character-encryption-key
QR_EXPIRY_HOURS=24
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

---

## Step 5: Initialize Database (2 min)
```bash
# Run migrations to create all tables
npm run migrate

# Seed default admin user and settings
npm run seed

# You should see:
# ✅ Database seeded successfully!
# Default users created:
# Admin: ITS000001 / Admin123!
# Receptionist: ITS000002 / Reception123!
```

---

## Step 6: Build and Start Application (2 min)
```bash
# Build TypeScript to JavaScript
npm run build

# Start with PM2
pm2 start dist/server.js --name sak-backend

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs sak-backend --lines 50
```

---

## Step 7: Configure Nginx (2 min)
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/sak-backend
```

Paste this configuration:
```nginx
server {
    listen 80;
   server_name 3.108.52.219;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Save and enable the configuration:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/sak-backend /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 8: Test Deployment (1 min)
```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health

# Test from outside (from your local machine)
curl http://3.108.52.219/api/v1/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-12-12T10:30:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

---

## ✅ Deployment Complete!

### Test Login API
```bash
curl -X POST http://3.108.52.219/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "itsId": "ITS000001",
    "password": "Admin123!"
  }'
```

You should receive a JWT token in response.

---

## 🔐 Security Reminders

**CRITICAL - Do these immediately:**

1. **Change default passwords:**
   ```bash
   # Login as admin and change password via API
   # See docs/API.md for password change endpoint
   ```

2. **Change PostgreSQL password:**
   ```bash
   sudo -u postgres psql
   ALTER USER sak_user WITH PASSWORD 'NewSecurePassword123!';
   \q
   # Update .env file with new password
   nano ~/SAK-Smart-Access-Control/backend/.env
   pm2 restart sak-backend
   ```

3. **Generate new JWT secret:**
   ```bash
   # Generate random 64-character string
   openssl rand -hex 32
   # Update JWT_SECRET in .env
   nano ~/SAK-Smart-Access-Control/backend/.env
   pm2 restart sak-backend
   ```

4. **Generate QR encryption key:**
   ```bash
   # Generate 32-character key
   openssl rand -base64 32
   # Update QR_ENCRYPTION_KEY in .env
   nano ~/SAK-Smart-Access-Control/backend/.env
   pm2 restart sak-backend
   ```

5. **Setup firewall:**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS (for future SSL)
   sudo ufw enable
   ```

---

## 📊 Useful Commands

### Check Application Status
```bash
pm2 status
pm2 logs sak-backend
pm2 monit
```

### Database Access
```bash
psql -U sak_user -d sak_access_control -h localhost
```

### View Logs
```bash
# Application logs
pm2 logs sak-backend --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Restart Services
```bash
pm2 restart sak-backend
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart redis-server
```

---

## 🔄 Future Updates

When you push code changes to GitHub:
```bash
cd ~/SAK-Smart-Access-Control
git pull origin main
cd backend
npm install
npm run build
npm run migrate  # Run any new migrations
pm2 restart sak-backend
```

---

## 📞 Next Steps

1. **Setup AWS SES** (for email notifications)
   - See `docs/DEPLOYMENT.md` Section 6
   - Update `.env` with AWS credentials

2. **Setup Twilio** (optional - for SMS/WhatsApp)
   - See `docs/DEPLOYMENT.md` Section 7
   - Update `.env` with Twilio credentials

3. **Deploy Frontend** (Week 7-8)
   - React web portal for hosts/admins
   - See `docs/ARCHITECTURE.md` for frontend design

4. **SSL Certificate** (Production)
   - Setup Let's Encrypt SSL
   - See `docs/DEPLOYMENT.md` Section 8

---

## 🆘 Troubleshooting

### Application won't start
```bash
pm2 logs sak-backend --err --lines 100
# Check for database connection or missing env variables
```

### Database connection failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U sak_user -d sak_access_control -h localhost -c "SELECT 1;"
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Port already in use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill if needed
sudo kill -9 <PID>

# Restart application
pm2 restart sak-backend
```

---

## 📚 Documentation

- Full API Documentation: `docs/API.md`
- Architecture Overview: `docs/ARCHITECTURE.md`
- Complete Deployment Guide: `docs/DEPLOYMENT.md`
- Database Schema: `docs/DATABASE.md`
- Quick Commands: `QUICK_COMMANDS.md`

---

**Congratulations! 🎉 Your SAK Smart Access Control system is now live!**
