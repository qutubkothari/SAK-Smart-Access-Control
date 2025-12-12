#!/bin/bash

# SAK Smart Access Control - Frontend Deployment Script for EC2
# This script builds and deploys the React frontend to EC2

set -e  # Exit on any error

echo "========================================"
echo "SAK Frontend Deployment to EC2"
echo "========================================"
echo ""

# Configuration
EC2_USER="ubuntu"
EC2_HOST="13.232.42.132"
PEM_KEY="sak-smart-access.pem"
REMOTE_PATH="/var/www/sak-frontend"
NGINX_CONF="/etc/nginx/sites-available/sak-frontend"

echo "Step 1: Building React application..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not found"
    exit 1
fi

echo "✅ Build completed successfully"
echo ""

echo "Step 2: Creating remote directory on EC2..."
ssh -i "../$PEM_KEY" $EC2_USER@$EC2_HOST "sudo mkdir -p $REMOTE_PATH && sudo chown -R $EC2_USER:$EC2_USER $REMOTE_PATH"
echo "✅ Remote directory ready"
echo ""

echo "Step 3: Uploading build files to EC2..."
scp -i "../$PEM_KEY" -r dist/* $EC2_USER@$EC2_HOST:$REMOTE_PATH/
echo "✅ Files uploaded successfully"
echo ""

echo "Step 4: Configuring Nginx..."
ssh -i "../$PEM_KEY" $EC2_USER@$EC2_HOST << 'EOF'
sudo tee /etc/nginx/sites-available/sak-frontend > /dev/null << 'NGINXCONF'
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

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXCONF

# Enable site
sudo ln -sf /etc/nginx/sites-available/sak-frontend /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Nginx configured and reloaded"
EOF

echo ""
echo "========================================"
echo "🎉 Deployment Complete!"
echo "========================================"
echo ""
echo "Frontend URL: http://13.232.42.132"
echo "API URL: http://13.232.42.132/api/v1"
echo ""
echo "Test login:"
echo "ITS ID: ITS000001"
echo "Password: Admin123!"
echo ""
echo "Make sure backend is running on EC2!"
echo "========================================"
