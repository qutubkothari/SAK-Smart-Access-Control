# SAK Smart Access Control - Backend Deployment Script for EC2 (PowerShell)
# Deploys by building locally, uploading `backend/dist` to EC2, then restarting PM2.
# This works even if the server directory is not a git repository.
# Prereqs: Windows OpenSSH (ssh/scp) available in PATH, and the EC2 key file present.

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SAK Backend Deployment to EC2" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration (edit if needed)
$EC2_USER = "ubuntu"
$EC2_HOST = "3.108.52.219"
$PEM_KEY  = ".\sak-smart-access.pem"
$REMOTE_APP_DIR = "/home/ubuntu/SAK-Smart-Access-Control"
$PM2_NAME = "sak-backend"

if (!(Test-Path $PEM_KEY)) {
  Write-Host "❌ PEM key not found at: $PEM_KEY" -ForegroundColor Red
  exit 1
}

Write-Host "Step 0: Syncing code to GitHub..." -ForegroundColor Yellow
try {
  git add -A
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  git commit -m "Auto-commit before deployment - $timestamp" -q 2>$null
  if ($LASTEXITCODE -eq 0) {
    git push origin master -q
    Write-Host "✅ Code synced to GitHub" -ForegroundColor Green
  } else {
    Write-Host "ℹ️ No changes to commit" -ForegroundColor Cyan
  }
} catch {
  Write-Host "⚠️ Git sync skipped (not a fatal error)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Step 1: Building backend locally..." -ForegroundColor Yellow
Push-Location ".\backend"
npm install
npm run build
Pop-Location

Write-Host "Step 2: Backing up remote dist..." -ForegroundColor Yellow
ssh -i $PEM_KEY "$EC2_USER@$EC2_HOST" "bash -lc 'set -e; mkdir -p $REMOTE_APP_DIR/backend/dist_backup; rm -rf $REMOTE_APP_DIR/backend/dist_backup/latest; cp -a $REMOTE_APP_DIR/backend/dist $REMOTE_APP_DIR/backend/dist_backup/latest'"

Write-Host "Step 3: Uploading dist to EC2..." -ForegroundColor Yellow
scp -i $PEM_KEY -r ".\backend\dist\*" "$EC2_USER@$EC2_HOST`:$REMOTE_APP_DIR/backend/dist/"

Write-Host "Step 4: Restarting backend (PM2)..." -ForegroundColor Yellow
ssh -i $PEM_KEY "$EC2_USER@$EC2_HOST" "pm2 restart $PM2_NAME; pm2 save; pm2 status"

Write-Host "" 
Write-Host "✅ Backend deployment completed." -ForegroundColor Green
Write-Host "Verify endpoints:" -ForegroundColor Cyan
Write-Host "  https://sac.saksolution.com/api/v1/health" -ForegroundColor Yellow
Write-Host "  https://sac.saksolution.com/api/v1/analytics/attendance?period=30" -ForegroundColor Yellow
Write-Host "" 
