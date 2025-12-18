#!/bin/bash

# Automated Database Backup Script
# Runs daily to create database backups and cleanup old ones

# Configuration
BACKUP_DIR="/home/ubuntu/SAK-Smart-Access-Control/backups"
LOG_FILE="/home/ubuntu/SAK-Smart-Access-Control/backend/logs/backup.log"
KEEP_DAYS=30
DB_NAME="${DB_NAME:-sak_access_control}"
DB_USER="${DB_USER:-sak_db_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Load environment variables
if [ -f "/home/ubuntu/SAK-Smart-Access-Control/backend/.env" ]; then
    export $(grep -v '^#' /home/ubuntu/SAK-Smart-Access-Control/backend/.env | xargs)
fi

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname $LOG_FILE)"

log "========================================="
log "Starting automated backup process"

# Generate backup filename
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_FILE="backup_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

# Create backup
log "Creating backup: $BACKUP_FILE"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "$BACKUP_PATH" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    # Get backup size
    SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log "SUCCESS: Backup created successfully - Size: $SIZE"
    
    # Create metadata file
    cat > "$BACKUP_PATH.meta.json" << EOF
{
  "filename": "$BACKUP_FILE",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "created_by": "automated_script",
  "size": "$SIZE",
  "description": "Automated daily backup",
  "database": "$DB_NAME"
}
EOF
    
    # Compress backup
    log "Compressing backup..."
    gzip "$BACKUP_PATH"
    if [ $? -eq 0 ]; then
        COMPRESSED_SIZE=$(du -h "$BACKUP_PATH.gz" | cut -f1)
        log "Backup compressed - Compressed size: $COMPRESSED_SIZE"
        
        # Update metadata with compressed size
        sed -i "s/\"size\": \"$SIZE\"/\"size\": \"$COMPRESSED_SIZE\",\"compressed\": true/" "$BACKUP_PATH.meta.json"
    fi
else
    log "ERROR: Backup creation failed"
    exit 1
fi

# Cleanup old backups
log "Cleaning up backups older than $KEEP_DAYS days..."
DELETED=0
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$KEEP_DAYS | while read file; do
    rm "$file"
    rm "${file}.meta.json" 2>/dev/null
    log "Deleted old backup: $(basename $file)"
    DELETED=$((DELETED + 1))
done

log "Cleanup completed - Deleted $DELETED old backup(s)"

# Count remaining backups
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backups: $TOTAL_BACKUPS - Total size: $TOTAL_SIZE"

# Check disk space
DISK_USAGE=$(df -h "$BACKUP_DIR" | awk 'NR==2 {print $5}')
log "Backup directory disk usage: $DISK_USAGE"

log "Automated backup process completed"
log "========================================="

# Rotate log file if it exceeds 10MB
LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LOG_SIZE" -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.$(date '+%Y%m%d_%H%M%S')"
    log "Log file rotated"
fi

exit 0
