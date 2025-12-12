# 🚀 Frontend Deployment Guide

## Quick Deploy to EC2

### Option 1: Automated Deployment (PowerShell)

```powershell
cd frontend
.\deploy-frontend.ps1
```

This script will:
1. ✅ Build React app (`npm run build`)
2. ✅ Upload to EC2 at `/var/www/sak-frontend`
3. ✅ Configure Nginx as reverse proxy
4. ✅ Reload Nginx automatically

---

### Option 2: Manual Deployment

#### Step 1: Build Frontend
```powershell
cd frontend
npm run build
```

#### Step 2: Upload to EC2
```powershell
scp -i ..\sak-smart-access.pem -r dist\* ubuntu@13.232.42.132:/var/www/sak-frontend/
```

#### Step 3: SSH to EC2
```powershell
ssh -i ..\sak-smart-access.pem ubuntu@13.232.42.132
```

#### Step 4: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/sak-frontend
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name 13.232.42.132;
    root /var/www/sak-frontend;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
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

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Step 5: Enable Site and Reload Nginx
```bash
sudo ln -sf /etc/nginx/sites-available/sak-frontend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ Verification

### 1. Check if frontend is accessible
Open browser: **http://13.232.42.132**

### 2. Test Login
```
ITS ID: ITS000001
Password: Admin123!
```

### 3. Check Nginx Status
```bash
sudo systemctl status nginx
```

### 4. Check Backend is Running
```bash
pm2 status
```

### 5. View Logs
```bash
# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Backend logs
pm2 logs sak-backend
```

---

## 🔧 Prerequisites

### On Your Local Machine:
- [x] Frontend built (`npm run build` creates `dist/` folder)
- [x] PEM key file (`sak-smart-access.pem`) in parent directory
- [x] SSH access to EC2

### On EC2:
- [x] Nginx installed (`sudo apt install nginx`)
- [x] Directory `/var/www/sak-frontend` created
- [x] Backend running on port 3000 (via PM2)
- [x] Firewall allows HTTP (port 80)

---

## 🐛 Troubleshooting

### Frontend shows blank page
```bash
# Check if files were uploaded
ssh -i ..\sak-smart-access.pem ubuntu@13.232.42.132
ls -la /var/www/sak-frontend/
```

### API calls failing
1. Check if backend is running:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
2. Check Nginx proxy configuration:
   ```bash
   sudo nginx -t
   ```

### 502 Bad Gateway
- Backend is not running or crashed
- Check: `pm2 status` and `pm2 logs`

### Nginx not reloading
```bash
sudo systemctl restart nginx
```

### Permission denied on upload
```bash
ssh -i ..\sak-smart-access.pem ubuntu@13.232.42.132
sudo chown -R ubuntu:ubuntu /var/www/sak-frontend
```

---

## 🔄 Update Deployment

When you make changes to frontend:

```powershell
# Build and deploy in one command
cd frontend
npm run build
scp -i ..\sak-smart-access.pem -r dist\* ubuntu@13.232.42.132:/var/www/sak-frontend/
```

No need to restart Nginx - just refresh browser with Ctrl+F5

---

## 🌐 Production Checklist

- [ ] Backend deployed and running (PM2)
- [ ] PostgreSQL database setup and seeded
- [ ] Redis running
- [ ] Frontend built and uploaded
- [ ] Nginx configured and running
- [ ] Firewall allows HTTP (port 80)
- [ ] DNS configured (if using domain)
- [ ] SSL certificate installed (recommended)
- [ ] Environment variables set correctly
- [ ] Default passwords changed

---

## 📱 Access URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://13.232.42.132 |
| **Backend API** | http://13.232.42.132/api/v1 |
| **Health Check** | http://13.232.42.132/api/v1/health |
| **WebSocket** | ws://13.232.42.132/socket.io |

---

## 🔐 Security Notes

1. **Change default passwords** immediately after first login
2. **Enable HTTPS** with Let's Encrypt (recommended)
3. **Configure firewall** to allow only necessary ports
4. **Keep system updated** (`sudo apt update && sudo apt upgrade`)

---

## 📞 Support

If deployment fails:
1. Check all prerequisites are met
2. Review error logs (`/var/log/nginx/error.log`)
3. Verify backend is running (`pm2 status`)
4. Test API directly (`curl http://localhost:3000/api/v1/health`)

---

**Ready to deploy? Run:** `.\deploy-frontend.ps1` 🚀
