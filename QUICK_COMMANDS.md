# Quick Commands Reference

## 🚀 Local Development

### First Time Setup
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your configurations
npm run migrate
npm run dev
```

### Daily Development
```bash
# Start backend
cd backend
npm run dev

# Run tests
npm test

# Check logs
tail -f logs/combined.log
```

---

## 🔧 Database Commands

### Initial Setup (First Time)
```bash
# Install PostgreSQL on EC2
sudo apt install -y postgresql-14

# Create database and user
sudo -u postgres psql
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'YourPassword123!';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\c sak_access_control
GRANT ALL ON SCHEMA public TO sak_user;
\q

# Option 1: Using Knex Migrations (Recommended)
cd backend
npm run migrate    # Creates all tables automatically
npm run seed       # Creates admin user (ITS000001/Admin123!) and default settings

# Option 2: Using SQL Schema File
psql -U sak_user -d sak_access_control -h localhost < database/schema.sql
```

### Migrations
```bash
npm run migrate              # Run all pending migrations
npm run migrate:rollback     # Rollback last migration
npm run migrate:create       # Create new migration
npm run migrate:status       # Check migration status
npm run seed                 # Seed database with default data
```

### PostgreSQL
```bash
# Connect to database
psql -U sak_user -d sak_access_control -h localhost

# Backup database
pg_dump -U sak_user -h localhost sak_access_control > backup.sql

# Restore database
psql -U sak_user -h localhost sak_access_control < backup.sql

# Check database size
psql -U sak_user -d sak_access_control -h localhost -c "SELECT pg_size_pretty(pg_database_size('sak_access_control'));"
```

---

## 🌐 API Testing

### Authentication
```bash
# Register user
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"its_id":"ITS123456","email":"test@test.com","password":"Test123","name":"Test User","phone":"+919876543210"}'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"its_id":"ITS123456","password":"Test123"}'

# Save the token from response
export TOKEN="your_jwt_token_here"
```

### Create Meeting
```bash
curl -X POST http://localhost:5000/api/v1/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "meeting_time": "2025-12-15T14:00:00Z",
    "duration_minutes": 60,
    "location": "Conference Room A",
    "purpose": "Product Demo",
    "visitors": [{
      "name": "Jane Smith",
      "email": "jane@client.com",
      "phone": "+919876543211",
      "company": "Client Corp"
    }]
  }'
```

### Get Meetings
```bash
curl -X GET http://localhost:5000/api/v1/meetings \
  -H "Authorization: Bearer $TOKEN"
```

### Health Check
```bash
curl http://localhost:5000/health
```

---

## 🚢 EC2 Deployment

### SSH into EC2
```bash
# Windows PowerShell
ssh -i sak-smart-access.pem ubuntu@13.232.42.132

# If permission error:
icacls sak-smart-access.pem /inheritance:r
icacls sak-smart-access.pem /grant:r "%username%:R"
```

### Deploy Application
```bash
# On EC2
cd /home/ubuntu/SAK-Smart-Access-Control
git pull origin main
cd backend
npm install
npm run build
pm2 restart sak-backend
```

### Or use deployment script
```bash
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

---

## 📊 Monitoring

### PM2 Commands
```bash
pm2 status                   # Check all processes
pm2 logs sak-backend         # View logs
pm2 logs sak-backend --lines 100  # Last 100 lines
pm2 monit                    # Real-time monitoring
pm2 restart sak-backend      # Restart app
pm2 stop sak-backend         # Stop app
pm2 start sak-backend        # Start app
pm2 delete sak-backend       # Remove from PM2
```

### System Status
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Check Redis
sudo systemctl status redis
redis-cli ping

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check disk space
df -h

# Check memory
free -m

# Check CPU
top
```

---

## 🐛 Troubleshooting

### Backend not starting
```bash
# Check logs
pm2 logs sak-backend

# Check if port is in use
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Linux/Mac

# Kill process on port 5000
# Windows
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process

# Linux/Mac
kill -9 $(lsof -t -i:5000)
```

### Database connection failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials in .env
cat backend/.env | grep DB_

# Test connection
psql -h localhost -U sak_user -d sak_access_control
```

### Redis connection failed
```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping  # Should return PONG
```

---

## 🔐 Security

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Change Database Password
```sql
ALTER USER sak_user WITH PASSWORD 'new_secure_password';
```

### Update Environment Variables
```bash
nano backend/.env
# Update values
pm2 restart sak-backend
```

---

## 📦 Backup & Restore

### Backup Everything
```bash
# Database
pg_dump -U sak_user sak_access_control > backup_$(date +%Y%m%d).sql

# Application files
tar -czf backup_$(date +%Y%m%d).tar.gz SAK-Smart-Access-Control/

# Copy to local machine
scp -i sak-smart-access.pem ubuntu@13.232.42.132:/home/ubuntu/backup_*.tar.gz ./
```

### Restore
```bash
# Restore database
psql -U sak_user sak_access_control < backup_20251212.sql

# Restore application
tar -xzf backup_20251212.tar.gz
```

---

## 🧪 Testing

### Run Tests
```bash
cd backend
npm test                     # All tests
npm test -- --watch          # Watch mode
npm test -- --coverage       # With coverage
```

### Test specific file
```bash
npm test -- auth.controller.test.ts
```

---

## 📝 Git Commands

### Commit Changes
```bash
git status
git add .
git commit -m "Add feature X"
git push origin main
```

### Create Branch
```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "Implement new feature"
git push origin feature/new-feature
```

### Pull Latest
```bash
git pull origin main
```

---

## 🔄 Redis Commands

### Check Redis
```bash
redis-cli

# In Redis CLI:
PING                         # Should return PONG
KEYS *                       # List all keys
GET key_name                 # Get value
DEL key_name                 # Delete key
FLUSHALL                     # Clear all data (careful!)
INFO                         # Server info
EXIT
```

---

## 📧 Test Notifications

### Send Test Email
```bash
curl -X POST http://localhost:5000/api/v1/test/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"test@example.com","subject":"Test","message":"Test message"}'
```

---

## 🎯 Quick Links

- API Docs: `http://localhost:5000/api/v1/docs`
- Health: `http://localhost:5000/health`
- Logs: `backend/logs/`
- Environment: `backend/.env`

---

## 💡 Pro Tips

1. **Use environment-specific configs**
   ```bash
   NODE_ENV=development npm run dev
   NODE_ENV=production npm start
   ```

2. **Monitor logs in real-time**
   ```bash
   pm2 logs sak-backend --lines 100 --raw | grep ERROR
   ```

3. **Check API response time**
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5000/health
   ```

4. **Database query performance**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM meetings WHERE host_id = 'uuid';
   ```

5. **Clear Redis cache**
   ```bash
   redis-cli FLUSHDB
   ```

---

**For detailed documentation, see:**
- Getting Started: `docs/GETTING_STARTED.md`
- API Reference: `docs/API.md`
- Deployment Guide: `docs/DEPLOYMENT.md`
