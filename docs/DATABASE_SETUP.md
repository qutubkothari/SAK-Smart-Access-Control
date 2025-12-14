# 🗄️ Database Setup Guide - Self-Hosted PostgreSQL

## Overview
This system uses **PostgreSQL 14** running directly on your EC2 instance. No external services required!

---

## 📦 **Option 1: Install PostgreSQL on EC2** (Recommended)

### Step 1: SSH into EC2
```bash
ssh -i sak-smart-access.pem ubuntu@3.108.52.219
```

### Step 2: Install PostgreSQL
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

### Step 3: Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run these commands:
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;

# Grant schema permissions
\c sak_access_control
GRANT ALL ON SCHEMA public TO sak_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sak_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sak_user;

# Exit PostgreSQL
\q
```

### Step 4: Configure PostgreSQL for Local Connections
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add this line (above other lines):
```
# Allow local connections with password
local   sak_access_control    sak_user                          md5
host    sak_access_control    sak_user    127.0.0.1/32          md5
host    sak_access_control    sak_user    ::1/128               md5
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Step 5: Test Connection
```bash
# Test connection
psql -U sak_user -d sak_access_control -h localhost

# If successful, you'll see:
# sak_access_control=>

# Type \q to exit
```

---

## 📦 **Option 2: Use Docker PostgreSQL** (Alternative)

If you prefer Docker (easier for development):

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Run PostgreSQL container
docker run -d \
  --name sak-postgres \
  -e POSTGRES_DB=sak_access_control \
  -e POSTGRES_USER=sak_user \
  -e POSTGRES_PASSWORD=YourSecurePassword123! \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:14-alpine

# Check if running
docker ps

# Test connection
docker exec -it sak-postgres psql -U sak_user -d sak_access_control
```

---

## 🔧 **Backend Configuration**

### Update your `.env` file:
```bash
cd /home/ubuntu/SAK-Smart-Access-Control/backend
nano .env
```

Set these values:
```env
# Database Configuration (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sak_access_control
DB_USER=sak_user
DB_PASSWORD=YourSecurePassword123!
DB_SSL=false

# For production, use strong password like:
# DB_PASSWORD=7#mK9$pL2@nQ5^wR8&xT4
```

---

## 🚀 **Run Database Migrations**

Now create the tables:

```bash
cd /home/ubuntu/SAK-Smart-Access-Control/backend

# Install dependencies (if not done)
npm install

# Run migrations to create all tables
npm run migrate

# You should see:
# ✓ Migration "create_users_table" completed
# ✓ Migration "create_meetings_table" completed
# ✓ Migration "create_visitors_table" completed
# ... etc
```

---

## ✅ **Verify Database Setup**

```bash
# Connect to database
psql -U sak_user -d sak_access_control -h localhost

# List all tables
\dt

# You should see:
#  users
#  meetings
#  visitors
#  notifications
#  audit_logs
#  blacklist
#  departments
#  settings

# Check a table structure
\d users

# Exit
\q
```

---

## 📊 **Database is Now Ready!**

Your database structure:
```
sak_access_control (database)
├── users              (employees, hosts, admins)
├── departments        (organizational structure)
├── meetings           (scheduled meetings)
├── visitors           (visitor records)
├── notifications      (all notifications)
├── audit_logs         (security audit trail)
├── blacklist          (blocked visitors)
└── settings           (system configuration)
```

---

## 🔐 **Security Best Practices**

### 1. Strong Password
```bash
# Generate secure password
openssl rand -base64 32

# Use this in .env file
```

### 2. Firewall Rules
```bash
# PostgreSQL should only accept local connections
sudo ufw status

# Port 5432 should NOT be open to public
# Only allow from localhost
```

### 3. Regular Backups
```bash
# Create backup script
sudo nano /usr/local/bin/backup-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U sak_user -h localhost sak_access_control > \
  $BACKUP_DIR/sak_backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "sak_backup_*.sql" -mtime +30 -delete

echo "Backup completed: sak_backup_$DATE.sql"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-db.sh

# Test backup
/usr/local/bin/backup-db.sh

# Schedule daily backup at 2 AM
crontab -e

# Add this line:
0 2 * * * /usr/local/bin/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

---

## 🔄 **Database Maintenance**

### View Database Size
```sql
SELECT pg_size_pretty(pg_database_size('sak_access_control'));
```

### View Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Vacuum Database (Optimize)
```bash
# Run weekly
psql -U sak_user -d sak_access_control -h localhost -c "VACUUM ANALYZE;"
```

---

## 📈 **Performance Tuning**

Edit PostgreSQL config for better performance:
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Recommended settings for t3.medium EC2:
```ini
# Memory settings
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
work_mem = 8MB

# Connection settings
max_connections = 100

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging (for troubleshooting)
log_min_duration_statement = 1000  # Log slow queries (>1s)
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 🆘 **Troubleshooting**

### Can't Connect to Database
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if port is listening
sudo netstat -plnt | grep 5432

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### "Authentication failed"
```bash
# Reset password
sudo -u postgres psql
ALTER USER sak_user WITH PASSWORD 'NewPassword123!';
\q

# Update .env file with new password
```

### "Database does not exist"
```bash
# Recreate database
sudo -u postgres psql
CREATE DATABASE sak_access_control OWNER sak_user;
\q

# Run migrations
cd /home/ubuntu/SAK-Smart-Access-Control/backend
npm run migrate
```

---

## 🎯 **Quick Setup Summary**

```bash
# 1. Install PostgreSQL
sudo apt install -y postgresql-14

# 2. Create database and user
sudo -u postgres psql
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'SecurePass123!';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\c sak_access_control
GRANT ALL ON SCHEMA public TO sak_user;
\q

# 3. Update backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sak_access_control
DB_USER=sak_user
DB_PASSWORD=SecurePass123!

# 4. Run migrations
cd backend
npm install
npm run migrate

# 5. Start application
npm run build
pm2 start dist/server.js --name sak-backend

# 6. Test
curl http://localhost:5000/health
```

---

## ✅ **You're All Set!**

Your database is now:
- ✅ Running locally on EC2
- ✅ No external dependencies
- ✅ Fully configured
- ✅ Secured
- ✅ Backed up daily
- ✅ Ready for production

**Total cost: $0** (included in EC2 instance)

---

## 🔄 **Want to Use Supabase Instead?**

If you later want to switch to Supabase:

1. Create Supabase project
2. Get connection string
3. Update `.env`:
```env
DB_HOST=db.xxxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password
DB_SSL=true
```
4. Run migrations: `npm run migrate`

But honestly, **local PostgreSQL is simpler and free!** 🎉
