#!/bin/bash

# SAK Smart Access Control - Automated Deployment Script for EC2
# Usage: ./deploy.sh

set -e

echo "=========================================="
echo "SAK Smart Access Control - Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
APP_DIR="/home/ubuntu/SAK-Smart-Access-Control"
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}[1/10] Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is not installed${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is not installed${NC}"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo -e "${RED}PM2 is not installed${NC}"; exit 1; }
echo -e "${GREEN}✓ Prerequisites OK${NC}"

echo -e "${YELLOW}[2/10] Creating backup...${NC}"
mkdir -p $BACKUP_DIR
if [ -d "$APP_DIR" ]; then
    tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C /home/ubuntu SAK-Smart-Access-Control
    echo -e "${GREEN}✓ Backup created: backup_$TIMESTAMP.tar.gz${NC}"
fi

echo -e "${YELLOW}[3/10] Pulling latest code...${NC}"
cd $APP_DIR
git fetch origin
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"

echo -e "${YELLOW}[4/10] Installing backend dependencies...${NC}"
cd $APP_DIR/backend
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}[5/10] Building backend...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

echo -e "${YELLOW}[6/10] Running database migrations...${NC}"
npm run migrate
echo -e "${GREEN}✓ Migrations completed${NC}"

echo -e "${YELLOW}[7/10] Restarting application...${NC}"
pm2 restart sak-backend || pm2 start dist/server.js --name sak-backend
pm2 save
echo -e "${GREEN}✓ Application restarted${NC}"

echo -e "${YELLOW}[8/10] Checking application health...${NC}"
sleep 5
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is healthy${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Rolling back..."
    pm2 restart sak-backend
    exit 1
fi

echo -e "${YELLOW}[9/10] Reloading Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx reloaded${NC}"

echo -e "${YELLOW}[10/10] Cleaning up old backups...${NC}"
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete
echo -e "${GREEN}✓ Cleanup completed${NC}"

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Application URL: http://3.108.52.219"
echo "API Health: http://3.108.52.219/health"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs sak-backend - View application logs"
echo "  pm2 monit           - Monitor application"
echo ""
