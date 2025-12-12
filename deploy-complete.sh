#!/bin/bash

# SAK Smart Access Control - Complete Deployment Script
# This script completes the deployment including frontend

set -e  # Exit on error

echo "🚀 SAK Smart Access Control - Final Deployment"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0;m' # No Color

# Get project root
PROJECT_ROOT="/home/ubuntu/SAK-Smart-Access-Control"

echo -e "${BLUE}📍 Project Directory: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Frontend Build
echo -e "${YELLOW}Step 1: Building Frontend...${NC}"
cd $PROJECT_ROOT/frontend
npm run build
echo -e "${GREEN}✅ Frontend built successfully${NC}"
echo ""

# Step 2: Deploy Frontend
echo -e "${YELLOW}Step 2: Deploying Frontend to Nginx...${NC}"
sudo mkdir -p /var/www/html
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
echo -e "${GREEN}✅ Frontend deployed to /var/www/html${NC}"
echo ""

# Step 3: Configure Nginx for SPA
echo -e "${YELLOW}Step 3: Updating Nginx Configuration...${NC}"
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # Frontend - Serve React App
    root /var/www/html;
    index index.html;
    
    # SPA routing - all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:3000/api/;
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
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
}
EOF

sudo nginx -t
sudo systemctl reload nginx
echo -e "${GREEN}✅ Nginx configured and reloaded${NC}"
echo ""

# Step 4: Verify Backend is Running
echo -e "${YELLOW}Step 4: Verifying Backend Status...${NC}"
cd $PROJECT_ROOT/backend
pm2 status

if pm2 list | grep -q "sak-backend"; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not running, starting it now...${NC}"
    npm run build
    pm2 start dist/server.js --name sak-backend
    pm2 save
    echo -e "${GREEN}✅ Backend started${NC}"
fi
echo ""

# Step 5: Test Deployment
echo -e "${YELLOW}Step 5: Running Smoke Tests...${NC}"

# Test API Health
echo "Testing API health endpoint..."
API_RESPONSE=$(curl -s http://localhost:3000/api/v1/health)
if echo $API_RESPONSE | grep -q "ok"; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  API health check failed${NC}"
fi

# Test Nginx
echo "Testing Nginx..."
NGINX_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$NGINX_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Nginx serving frontend${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx returned status: $NGINX_RESPONSE${NC}"
fi

# Test API through Nginx
echo "Testing API through Nginx..."
API_NGINX_RESPONSE=$(curl -s http://localhost/api/v1/health)
if echo $API_NGINX_RESPONSE | grep -q "ok"; then
    echo -e "${GREEN}✅ API accessible through Nginx${NC}"
else
    echo -e "${YELLOW}⚠️  API not accessible through Nginx${NC}"
fi
echo ""

# Step 6: Display Access Information
echo -e "${YELLOW}Step 6: Deployment Summary${NC}"
echo "================================================"
echo ""
SERVER_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "📍 Access URLs:"
echo "   Frontend: http://$SERVER_IP"
echo "   API: http://$SERVER_IP/api/v1"
echo "   Health: http://$SERVER_IP/api/v1/health"
echo ""
echo "👤 Default Login Credentials:"
echo "   Admin:"
echo "     ITS ID: ITS000001"
echo "     Password: Admin123!"
echo ""
echo "   Receptionist:"
echo "     ITS ID: ITS000002"
echo "     Password: Reception123!"
echo ""
echo "⚠️  IMPORTANT: Change default passwords after first login!"
echo ""
echo "📚 Next Steps:"
echo "   1. Access http://$SERVER_IP in your browser"
echo "   2. Login with admin credentials"
echo "   3. Change default passwords in Settings"
echo "   4. Create test meeting"
echo "   5. Test QR code scanning"
echo ""
echo "🔒 To enable HTTPS:"
echo "   1. Point your domain to $SERVER_IP"
echo "   2. Run: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "📊 Monitoring Commands:"
echo "   Backend logs: pm2 logs sak-backend"
echo "   Backend status: pm2 status"
echo "   Nginx logs: sudo tail -f /var/log/nginx/access.log"
echo "   Nginx errors: sudo tail -f /var/log/nginx/error.log"
echo ""
echo "================================================"
echo -e "${GREEN}✅ SAK Smart Access Control is now live!${NC}"
echo "================================================"
