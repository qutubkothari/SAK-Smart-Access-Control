# SAK Smart Access Control - Local Development Startup
# PowerShell Script for Windows

Write-Host "🚀 Starting SAK Smart Access Control (Local Development)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

$ProjectRoot = "C:\Users\musta\OneDrive\Documents\GitHub\SAK-Smart-Access-Control"

# Check if already in project directory
if (Test-Path "$ProjectRoot\backend\package.json") {
    Write-Host "✅ Found project at: $ProjectRoot" -ForegroundColor Green
} else {
    Write-Host "❌ Project not found at: $ProjectRoot" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Installing Dependencies (if needed)..." -ForegroundColor Yellow

# Backend dependencies
Write-Host "  Checking backend dependencies..." -ForegroundColor Cyan
cd "$ProjectRoot\backend"
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing backend dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  ✅ Backend dependencies already installed" -ForegroundColor Green
}

# Frontend dependencies
Write-Host "  Checking frontend dependencies..." -ForegroundColor Cyan
cd "$ProjectRoot\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  ✅ Frontend dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Starting Services..." -ForegroundColor Yellow
Write-Host ""

# Start Backend
Write-Host "📡 Starting Backend API (Port 3000)..." -ForegroundColor Cyan
cd "$ProjectRoot\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; Write-Host '🔵 Backend Server Starting...' -ForegroundColor Blue; npm run dev"

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "🌐 Starting Frontend (Port 5173)..." -ForegroundColor Cyan
cd "$ProjectRoot\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend'; Write-Host '🟢 Frontend Server Starting...' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ Services Started!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Access URLs:" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend API: http://localhost:3000/api/v1" -ForegroundColor White
Write-Host "   API Health: http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host ""
Write-Host "👤 Login Credentials:" -ForegroundColor Yellow
Write-Host "   Admin:" -ForegroundColor White
Write-Host "     ITS ID: ITS000001" -ForegroundColor Cyan
Write-Host "     Password: Admin123!" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Receptionist:" -ForegroundColor White
Write-Host "     ITS ID: ITS000002" -ForegroundColor Cyan
Write-Host "     Password: Reception123!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Test Users (Password: Test123!):" -ForegroundColor Yellow
Write-Host "   ITS100001 - John Doe (Host)" -ForegroundColor White
Write-Host "   ITS100002 - Jane Smith (Host)" -ForegroundColor White
Write-Host "   ITS100003 - Robert Wilson (Host)" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Useful Commands:" -ForegroundColor Yellow
Write-Host "   Check API: curl http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host "   View logs: Check the PowerShell windows" -ForegroundColor White
Write-Host ""
Write-Host "⏹️  To Stop:" -ForegroundColor Yellow
Write-Host "   Close the PowerShell windows or press Ctrl+C in each" -ForegroundColor White
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "🎉 Development environment is ready!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Opening browser in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
