#!/bin/bash

# Daily Email Notification Script
# Sends attendance summaries and late arrival alerts
# Run at 2 AM UTC daily (after attendance calculation at 1 AM)

# Configuration
API_URL="https://sac.saksolution.com/api/v1"
LOG_DIR="/home/ubuntu/SAK-Smart-Access-Control/backend/logs"
LOG_FILE="$LOG_DIR/email-notifications.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "========================================="
log "Starting daily email notification job"

# Get yesterday's date (since job runs at 2 AM for previous day)
YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d')
log "Processing date: $YESTERDAY"

# Get admin JWT token from environment variable
# Note: Set ADMIN_JWT_TOKEN in environment or use secret manager
if [ -z "$ADMIN_JWT_TOKEN" ]; then
    log "ERROR: ADMIN_JWT_TOKEN not set in environment"
    exit 1
fi

# Send daily attendance summaries
log "Sending attendance summaries..."
ATTENDANCE_RESPONSE=$(curl -s -X POST "$API_URL/notifications/send-attendance-summaries?date=$YESTERDAY" \
    -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
    -H "Content-Type: application/json")

if echo "$ATTENDANCE_RESPONSE" | grep -q '"success":true'; then
    log "SUCCESS: Attendance summaries sent"
    log "Response: $ATTENDANCE_RESPONSE"
else
    log "ERROR: Failed to send attendance summaries"
    log "Response: $ATTENDANCE_RESPONSE"
fi

# Send late arrival alerts
log "Sending late arrival alerts..."
LATE_ALERTS_RESPONSE=$(curl -s -X POST "$API_URL/notifications/send-late-alerts?date=$YESTERDAY" \
    -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
    -H "Content-Type: application/json")

if echo "$LATE_ALERTS_RESPONSE" | grep -q '"success":true'; then
    log "SUCCESS: Late arrival alerts sent"
    log "Response: $LATE_ALERTS_RESPONSE"
else
    log "ERROR: Failed to send late arrival alerts"
    log "Response: $LATE_ALERTS_RESPONSE"
fi

log "Daily email notification job completed"
log "========================================="

# Cleanup old logs (keep last 30 days)
find "$LOG_DIR" -name "email-notifications.log.*" -mtime +30 -delete 2>/dev/null

# Rotate log if it's larger than 10MB
LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LOG_SIZE" -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.$(date '+%Y%m%d_%H%M%S')"
    log "Log rotated due to size"
fi
