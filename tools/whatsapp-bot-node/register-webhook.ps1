# SAK WhatsApp Webhook Registration Script

$SAK_BASE_URL = "https://wapi.saksolution.com"
$SESSION_ID = "primary-number"
$WEBHOOK_URL = "https://sac.saksolution.com/sak/inbound/DEH5253"
$EVENTS = @("message.received")

Write-Host "🔧 Registering webhook with SAK WhatsApp API..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Session ID: $SESSION_ID"
Write-Host "Webhook URL: $WEBHOOK_URL"
Write-Host "Events: $($EVENTS -join ', ')"
Write-Host ""

# Note: You need to provide your SAK login JWT token
Write-Host "⚠️  You need to provide your SAK login JWT token" -ForegroundColor Yellow
Write-Host "Get it by logging into wapi.saksolution.com and copying the token from browser dev tools"
Write-Host ""
Write-Host "Once you have the token, register the webhook using:"
Write-Host ""
Write-Host "curl -X POST $SAK_BASE_URL/api/v1/webhooks \`" -ForegroundColor Green
Write-Host "  -H 'Content-Type: application/json' \`" -ForegroundColor Green  
Write-Host "  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \`" -ForegroundColor Green
Write-Host "  -d '{" -ForegroundColor Green
Write-Host '    "sessionId": "' -NoNewline -ForegroundColor Green
Write-Host $SESSION_ID -NoNewline -ForegroundColor White
Write-Host '",' -ForegroundColor Green
Write-Host '    "url": "' -NoNewline -ForegroundColor Green
Write-Host $WEBHOOK_URL -NoNewline -ForegroundColor White
Write-Host '",' -ForegroundColor Green
Write-Host '    "events": ["message.received"]' -ForegroundColor Green
Write-Host "  }'" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Important: there are TWO different secrets:" -ForegroundColor Yellow
Write-Host "  1) INBOUND_SECRET is the token in the webhook URL path (already set here as DEH5253)." -ForegroundColor Gray
Write-Host "  2) The webhook registration API returns a secret used in the inbound request header (X-Webhook-Secret)." -ForegroundColor Gray
Write-Host "     Save that returned secret and set it on the webhook bot server as:" -ForegroundColor Yellow
Write-Host "WEBHOOK_SECRET=<secret_from_response>" -ForegroundColor Gray
Write-Host "(Optional) Multiple secrets can be provided comma-separated if SAK sends inconsistent secrets." -ForegroundColor Gray
