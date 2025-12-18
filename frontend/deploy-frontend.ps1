# SAK Smart Access Control - Frontend Deployment Script for EC2 (PowerShell)

param(
    [switch]$ConfigureNginx
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SAK Frontend Deployment to EC2" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$EC2_USER = "ubuntu"
$EC2_HOST = "3.108.52.219"
$PEM_KEY = "..\sak-smart-access.pem"
$REMOTE_PATH = "/var/www/sak-frontend"

# Step 1: Build
Write-Host "Step 1: Building React application..." -ForegroundColor Yellow
npm run build

if (!(Test-Path "dist")) {
    Write-Host "❌ Build failed - dist folder not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create remote directory
Write-Host "Step 2: Creating remote directory on EC2..." -ForegroundColor Yellow
ssh -i $PEM_KEY "$EC2_USER@$EC2_HOST" "sudo mkdir -p $REMOTE_PATH && sudo chown -R $EC2_USER`:$EC2_USER $REMOTE_PATH"
Write-Host "✅ Remote directory ready" -ForegroundColor Green
Write-Host ""

# Step 3: Upload files
Write-Host "Step 3: Uploading build files to EC2..." -ForegroundColor Yellow
scp -i $PEM_KEY -r dist/* "$EC2_USER@$EC2_HOST`:$REMOTE_PATH/"
Write-Host "✅ Files uploaded successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Configure Nginx
if (-not $ConfigureNginx) {
    Write-Host "Step 4: Skipping Nginx configuration (pass -ConfigureNginx to enable)..." -ForegroundColor Yellow
    Write-Host "✅ Deployment completed without Nginx changes" -ForegroundColor Green
    exit 0
}

Write-Host "Step 4: Configuring Nginx..." -ForegroundColor Yellow

$nginxConfig = @'
server {
    listen 80;
    server_name 3.108.52.219;
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
'@

# Save config temporarily
$nginxConfig | Out-File -FilePath "nginx-temp.conf" -Encoding UTF8

# Upload and configure
scp -i $PEM_KEY nginx-temp.conf "$EC2_USER@$EC2_HOST`:/tmp/sak-frontend.conf"
Remove-Item nginx-temp.conf

ssh -i $PEM_KEY "$EC2_USER@$EC2_HOST" @"
sudo mv /tmp/sak-frontend.conf /etc/nginx/sites-available/sak-frontend
sudo ln -sf /etc/nginx/sites-available/sak-frontend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
"@

Write-Host "✅ Nginx configured and reloaded" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend URL: " -NoNewline
Write-Host "http://3.108.52.219" -ForegroundColor Yellow
Write-Host "API URL: " -NoNewline
Write-Host "http://3.108.52.219/api/v1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test login:" -ForegroundColor Cyan
Write-Host "ITS ID: ITS000001"
Write-Host "Password: Admin123!"
Write-Host ""
Write-Host "Make sure backend is running on EC2!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
