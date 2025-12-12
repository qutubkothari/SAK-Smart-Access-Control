# Deployment Guide for EC2

## Server Info
- **IP:** 13.232.42.132
- **Region:** ap-south-1 (Mumbai)
- **PEM Key:** sak-smart-access.pem

## Prerequisites

### 1. SSH into EC2
```bash
ssh -i sak-smart-access.pem ubuntu@13.232.42.132
```

### 2. Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 3. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Should be 18.x
npm -v
```

### 4. Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

In PostgreSQL prompt:
```sql
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\q
```

### 5. Install Redis
```bash
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis
redis-cli ping  # Should return PONG
```

### 6. Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 7. Install PM2
```bash
sudo npm install -g pm2
```

---

## Application Deployment

### 1. Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/qutubkothari/SAK-Smart-Access-Control.git
cd SAK-Smart-Access-Control
```

### 2. Setup Backend
```bash
cd backend
npm install

# Create .env file
cp .env.example .env
nano .env
```

Update `.env` with production values:
```env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sak_access_control
DB_USER=sak_user
DB_PASSWORD=your_secure_password
JWT_SECRET=generate_a_strong_random_secret
# ... other configs
```

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. Build Backend
```bash
npm run build
```

### 5. Start with PM2
```bash
pm2 start dist/server.js --name sak-backend
pm2 save
pm2 startup
```

---

## Nginx Configuration

### 1. Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/sak-access
```

Add configuration:
```nginx
server {
    listen 80;
    server_name 13.232.42.132;

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
    }

    # Frontend (if deploying on same server)
    location / {
        root /home/ubuntu/SAK-Smart-Access-Control/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

### 2. Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/sak-access /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL Configuration (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo systemctl reload nginx
```

---

## Firewall Configuration

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 5432  # PostgreSQL (only from localhost)
sudo ufw allow 6379  # Redis (only from localhost)
sudo ufw enable
sudo ufw status
```

---

## Monitoring & Logs

### PM2 Monitoring
```bash
pm2 monit
pm2 logs sak-backend
pm2 status
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Application Logs
```bash
cd /home/ubuntu/SAK-Smart-Access-Control/backend
tail -f logs/combined.log
tail -f logs/error.log
```

---

## Backup & Recovery

### Database Backup
```bash
# Daily backup cron job
sudo crontab -e
```

Add:
```
0 2 * * * pg_dump -U sak_user sak_access_control > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql
```

### Application Backup
```bash
# Backup application files
tar -czf sak-backup-$(date +%Y%m%d).tar.gz SAK-Smart-Access-Control/
```

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: 13.232.42.132
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/SAK-Smart-Access-Control
            git pull origin main
            cd backend
            npm install
            npm run build
            pm2 restart sak-backend
```

---

## Troubleshooting

### Backend Not Starting
```bash
pm2 logs sak-backend
pm2 restart sak-backend
```

### Database Connection Issues
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Redis Issues
```bash
sudo systemctl status redis
redis-cli ping
```

### Port Already in Use
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

---

## Performance Tuning

### PostgreSQL
Edit `/etc/postgresql/14/main/postgresql.conf`:
```
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

### Node.js
```bash
pm2 start dist/server.js -i max --name sak-backend  # Cluster mode
```

### Nginx
Edit `/etc/nginx/nginx.conf`:
```
worker_processes auto;
worker_connections 1024;
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Setup firewall rules
- [ ] Enable SSL/TLS
- [ ] Regular security updates
- [ ] Enable PostgreSQL SSL
- [ ] Restrict database access
- [ ] Use environment variables for secrets
- [ ] Enable audit logging
- [ ] Regular backups
- [ ] Monitor logs for suspicious activity

---

## Useful Commands

```bash
# Check application status
pm2 status

# Restart application
pm2 restart sak-backend

# View logs
pm2 logs sak-backend --lines 100

# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Database backup
pg_dump -U sak_user sak_access_control > backup.sql

# Restore database
psql -U sak_user sak_access_control < backup.sql
```
