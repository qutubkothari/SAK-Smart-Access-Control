# 🎯 Database Setup - Complete Guide

## Overview
You have **THREE options** to set up your PostgreSQL database. Each has its use case:

| Method | Best For | Time | Complexity |
|--------|----------|------|------------|
| **Option 1: Knex Migrations** | Production + Development | 2 min | ⭐ Easy |
| **Option 2: Raw SQL Schema** | Quick setup, testing | 1 min | ⭐⭐ Very Easy |
| **Option 3: Docker PostgreSQL** | Local development | 3 min | ⭐⭐⭐ Medium |

---

## ✅ RECOMMENDED: Option 1 - Knex Migrations

**Why choose this?**
- Version control for database changes
- Easy rollback if something goes wrong
- Automatic table creation
- Includes seed data (admin user + settings)
- Works exactly the same in dev and production

### Steps:

#### 1. Install PostgreSQL on EC2
```bash
ssh -i sak-smart-access.pem ubuntu@3.108.52.219

sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib-14
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 2. Create Database and User
```bash
sudo -u postgres psql << EOF
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\c sak_access_control
GRANT ALL ON SCHEMA public TO sak_user;
\q
EOF
```

#### 3. Configure Backend .env
```bash
cd ~/SAK-Smart-Access-Control/backend
nano .env
```

Update these values:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=sak_user
DB_PASSWORD=YourSecurePassword123!
DB_NAME=sak_access_control
```

#### 4. Run Migrations and Seed
```bash
npm install
npm run migrate    # Creates all 8 tables with indexes and triggers
npm run seed       # Creates admin user and default settings
```

#### 5. Verify Setup
```bash
psql -U sak_user -d sak_access_control -h localhost -c "\dt"
```

You should see 8 tables:
- users
- departments
- meetings
- visitors
- notifications
- audit_logs
- blacklist
- settings

#### 6. Test Default Login
```json
{
  "itsId": "ITS000001",
  "password": "Admin123!"
}
```

**⚠️ IMPORTANT: Change this password immediately after first login!**

---

## Option 2 - Raw SQL Schema File

**Why choose this?**
- Fastest setup (1 minute)
- No dependencies needed
- Direct SQL execution
- Good for testing or quick demos

### Steps:

#### 1-2. Same as Option 1
(Install PostgreSQL and create database/user)

#### 3. Run Schema File
```bash
cd ~/SAK-Smart-Access-Control
psql -U sak_user -d sak_access_control -h localhost < database/schema.sql
```

This single command:
- Creates all 8 tables
- Adds 20+ indexes
- Sets up 6 triggers
- Creates 2 views
- Seeds default data
- Creates admin user (ITS000001 / Admin123!)

#### 4. Verify
```bash
psql -U sak_user -d sak_access_control -h localhost
\dt
\q
```

---

## Option 3 - Docker PostgreSQL

**Why choose this?**
- Isolated database environment
- Easy to destroy and recreate
- Great for local development
- No PostgreSQL installation on host

### Steps:

#### 1. Install Docker
```bash
# On EC2/Ubuntu
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

#### 2. Create docker-compose.yml
```bash
cd ~/SAK-Smart-Access-Control
nano docker-compose.db.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: sak-postgres
    environment:
      POSTGRES_DB: sak_access_control
      POSTGRES_USER: sak_user
      POSTGRES_PASSWORD: YourSecurePassword123!
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Start Database
```bash
docker-compose -f docker-compose.db.yml up -d
```

#### 4. Verify
```bash
docker ps
docker exec -it sak-postgres psql -U sak_user -d sak_access_control -c "\dt"
```

#### 5. Update .env
```env
DB_HOST=localhost  # or 'postgres' if backend also in Docker
DB_PORT=5432
DB_USER=sak_user
DB_PASSWORD=YourSecurePassword123!
DB_NAME=sak_access_control
```

---

## 🔄 Database Management Commands

### Check Connection
```bash
psql -U sak_user -d sak_access_control -h localhost
```

### View Tables
```sql
\dt                          -- List all tables
\d+ users                    -- Describe users table
\di                          -- List indexes
```

### View Data
```sql
SELECT * FROM users;
SELECT * FROM meetings LIMIT 10;
SELECT * FROM visitors WHERE check_in_time IS NOT NULL;
```

### Backup Database
```bash
# Create backup
pg_dump -U sak_user -h localhost sak_access_control > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U sak_user -h localhost sak_access_control < backup_20241212_103045.sql
```

### Migration Commands (Option 1 only)
```bash
cd backend

# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:create add_column_to_users

# Run seed data again
npm run seed
```

---

## 🔍 Database Schema Overview

### Tables Created

1. **users** (8 columns)
   - Authentication and profile data
   - Role-based access (admin, security, receptionist, host)

2. **departments** (8 columns)
   - Organizational structure
   - Manager assignments

3. **meetings** (19 columns)
   - Meeting scheduling and status
   - QR code generation
   - Host check-in tracking

4. **visitors** (20 columns)
   - Visitor information
   - Check-in/out times
   - ID verification details

5. **notifications** (12 columns)
   - Multi-channel notification queue
   - Delivery status tracking

6. **audit_logs** (12 columns)
   - Complete audit trail
   - Security compliance

7. **blacklist** (9 columns)
   - Security management
   - Temporary/permanent bans

8. **settings** (7 columns)
   - System configuration
   - Feature flags

### Default Indexes (20+)
- Primary keys on all tables
- Foreign key indexes for joins
- Search indexes on email, phone, ITS ID
- Time-based indexes for meetings and logs

### Triggers (6)
- Automatic `updated_at` timestamp updates
- Referential integrity enforcement

### Views (2)
- `active_visitors`: Currently checked-in visitors
- `todays_meetings`: Today's scheduled meetings

---

## 🛠️ Troubleshooting

### Issue: "peer authentication failed"
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Change this line:
local   all   all   peer

# To:
local   all   all   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Issue: "connection refused"
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if stopped
sudo systemctl start postgresql

# Check if listening on correct port
sudo netstat -plnt | grep 5432
```

### Issue: "database does not exist"
```bash
# List all databases
sudo -u postgres psql -c "\l"

# Recreate database
sudo -u postgres psql -c "CREATE DATABASE sak_access_control;"
```

### Issue: "password authentication failed"
```bash
# Reset password
sudo -u postgres psql -c "ALTER USER sak_user WITH PASSWORD 'NewPassword123!';"

# Update .env file
nano backend/.env
```

### Issue: "permission denied for schema public"
```bash
sudo -u postgres psql -d sak_access_control -c "GRANT ALL ON SCHEMA public TO sak_user;"
```

---

## 📊 Performance Optimization

### For Production (EC2 t3.medium - 4GB RAM)

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Recommended settings:**
```conf
max_connections = 100
shared_buffers = 1GB                    # 25% of RAM
effective_cache_size = 3GB              # 75% of RAM
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

## 🔐 Security Best Practices

### 1. Strong Passwords
```bash
# Generate secure password
openssl rand -base64 24
```

### 2. Limit Network Access
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add these lines:
```conf
# Allow localhost connections only
host    sak_access_control    sak_user    127.0.0.1/32    md5
host    sak_access_control    sak_user    ::1/128         md5

# Deny all other connections
host    all                   all         0.0.0.0/0       reject
```

### 3. Regular Backups
```bash
# Create backup script
nano ~/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U sak_user -h localhost sak_access_control | gzip > $BACKUP_DIR/sak_db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "sak_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: sak_db_$DATE.sql.gz"
```

```bash
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/ubuntu/backup-db.sh
```

### 4. Monitor Connections
```sql
-- View active connections
SELECT * FROM pg_stat_activity WHERE datname = 'sak_access_control';

-- Kill specific connection
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;
```

---

## 🎓 Next Steps

After database setup:

1. **Configure Backend .env** - All database credentials
2. **Run Application** - `npm run dev` or `pm2 start`
3. **Test APIs** - See `docs/API.md` for endpoints
4. **Change Default Passwords** - Security first!
5. **Setup Backup Schedule** - Daily automated backups

---

## 📚 Related Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Complete EC2 deployment
- [docs/DATABASE.md](./docs/DATABASE.md) - Detailed schema documentation
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [QUICK_COMMANDS.md](./QUICK_COMMANDS.md) - Command reference

---

## ✅ Database Setup Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `sak_access_control` created
- [ ] User `sak_user` created with strong password
- [ ] Permissions granted correctly
- [ ] Schema created (8 tables)
- [ ] Default data seeded
- [ ] Backend .env configured
- [ ] Connection tested successfully
- [ ] Default admin password changed
- [ ] Backup script configured

**Once all checked, you're ready to deploy the backend!** 🚀
