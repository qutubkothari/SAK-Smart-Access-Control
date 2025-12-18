#!/bin/bash
# Daily attendance calculation cron job
# Add to crontab with: crontab -e
# 0 1 * * * /home/ubuntu/SAK-Smart-Access-Control/scripts/calculate-attendance.sh

BACKEND_URL="http://localhost:3000/api/v1"
LOG_FILE="/home/ubuntu/SAK-Smart-Access-Control/logs/attendance-cron.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Calculate attendance for yesterday (since it's run at 1 AM)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

echo "[$(date)] Calculating attendance for $YESTERDAY" >> "$LOG_FILE"

# Get admin JWT token from environment or .env file
if [ -z "$ADMIN_JWT_TOKEN" ]; then
  # Try to source from backend .env file
  if [ -f "/home/ubuntu/SAK-Smart-Access-Control/backend/.env" ]; then
    source /home/ubuntu/SAK-Smart-Access-Control/backend/.env
  fi
fi

# Make API call
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$BACKEND_URL/attendance/calculate?date=$YESTERDAY" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$(date)] SUCCESS: $BODY" >> "$LOG_FILE"
else
  echo "[$(date)] ERROR: HTTP $HTTP_CODE - $BODY" >> "$LOG_FILE"
fi
