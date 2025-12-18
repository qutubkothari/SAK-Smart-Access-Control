# Email Notification API Documentation

## Overview
This document describes the email notification system integrated into the SAK Smart Access Control backend. The system automatically sends email notifications for leave applications, status updates, attendance summaries, and late arrival alerts.

**Base URL:** `https://sac.saksolution.com/api/v1`

---

## Automatic Notifications (Triggered by Events)

### 1. Leave Application Notification
**Trigger:** Automatically sent when an employee applies for leave

**Recipients:** All active administrators

**Email Content:**
- Employee name
- Leave type (Casual/Sick/Maternity/Paternity/Annual)
- Start date and end date
- Reason for leave
- "Review Application" button linking to admin portal

**Implementation:**
```typescript
// Triggered in leave.controller.ts applyLeave()
await notifyLeaveApplication(employee_id, leave_type, from_date, to_date, reason);
```

---

### 2. Leave Status Update Notification
**Trigger:** Automatically sent when leave is approved or rejected

**Recipients:** The employee who applied for leave

**Email Content:**
- Leave status (Approved/Rejected) with color-coded header
  - Green (#10b981) for approved
  - Red (#ef4444) for rejected
- Leave type and dates
- Manager's review notes (if provided)
- "View Leave History" button

**Implementation:**
```typescript
// Triggered in leave.controller.ts updateLeaveStatus()
await notifyLeaveStatusUpdate(
  employee_id, 
  status, 
  leave_type, 
  from_date, 
  to_date, 
  rejection_reason
);
```

---

## Manual Notification Endpoints

### 3. Send Daily Attendance Summaries

**Endpoint:** `POST /api/v1/notifications/send-attendance-summaries`

**Authentication:** Required (JWT Token)

**Authorization:** Admin only

**Description:** Sends daily attendance summary emails to all active administrators, grouped by department

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | string | No | Date in YYYY-MM-DD format (defaults to today) |

**Request Example:**
```bash
curl -X POST "https://sac.saksolution.com/api/v1/notifications/send-attendance-summaries?date=2024-01-15" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response Example:**
```json
{
  "success": true,
  "message": "Attendance summaries sent to 3 managers",
  "data": [
    {
      "manager": "John Doe",
      "department": "Engineering",
      "email_sent": true
    },
    {
      "manager": "Jane Smith",
      "department": "HR",
      "email_sent": true
    }
  ]
}
```

**Email Content:**
- Department name and date
- 2x2 grid showing statistics:
  - Present count
  - Late count
  - Absent count
  - On leave count
- Attendance rate badge (color-coded):
  - ≥90%: Green (#10b981)
  - ≥75%: Orange (#f59e0b)
  - <75%: Red (#ef4444)
- "View Detailed Report" button

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | No valid token provided |
| 403 | FORBIDDEN | User is not an admin |
| 500 | NOTIFICATION_FAILED | Email sending failed |

---

### 4. Send Late Arrival Alerts

**Endpoint:** `POST /api/v1/notifications/send-late-alerts`

**Authentication:** Required (JWT Token)

**Authorization:** Admin only

**Description:** Sends late arrival alert emails to all employees who arrived late on the specified date

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | string | No | Date in YYYY-MM-DD format (defaults to today) |

**Request Example:**
```bash
curl -X POST "https://sac.saksolution.com/api/v1/notifications/send-late-alerts?date=2024-01-15" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response Example:**
```json
{
  "success": true,
  "message": "Alerts sent to 5 employees",
  "data": [
    {
      "employee": "Ahmed Khan",
      "late_by": 15,
      "email_sent": true
    },
    {
      "employee": "Sara Ali",
      "late_by": 8,
      "email_sent": true
    }
  ]
}
```

**Email Content:**
- Yellow/warning themed header
- Date and check-in time
- Minutes late (calculated from shift start + grace period)
- Punctuality reminder message

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | No valid token provided |
| 403 | FORBIDDEN | User is not an admin |
| 500 | NOTIFICATION_FAILED | Email sending failed |

---

## Email Templates

All email templates use:
- **Inline CSS** for maximum email client compatibility
- **Responsive design** with max-width 600px containers
- **Professional styling** with consistent branding
- **Action buttons** linking to frontend portal

### Template Colors
- **Purple (#667eea):** Leave application header
- **Green (#10b981):** Approved status, good attendance rate
- **Red (#ef4444):** Rejected status, poor attendance rate
- **Orange (#f59e0b):** Warning/late arrival, moderate attendance
- **Gray backgrounds:** #f9f9f9 for content areas

---

## Configuration

### Environment Variables

Required environment variables in `.env`:

```bash
# SendGrid SMTP Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Email From Information
EMAIL_FROM_NAME=SAK Access Control
EMAIL_FROM=noreply@sac.saksolution.com

# Frontend URL for email buttons
FRONTEND_URL=https://sac.saksolution.com
```

### SendGrid Setup

1. **Create SendGrid Account:** https://signup.sendgrid.com/
2. **Generate API Key:**
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key (shown only once)
3. **Verify Sender Identity:**
   - Go to Settings → Sender Authentication
   - Add and verify your domain or single sender email
4. **Set Environment Variable:**
   ```bash
   export SENDGRID_API_KEY="SG.xxxxxxxxxxxxx"
   ```

---

## Scheduled Email Jobs

### Recommended Cron Schedule

Create `/home/ubuntu/SAK-Smart-Access-Control/backend/scripts/send-daily-emails.sh`:

```bash
#!/bin/bash
YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d')
API_URL="https://sac.saksolution.com/api/v1"

# Get admin JWT token (store in environment or secure location)
ADMIN_TOKEN="your_admin_jwt_token"

# Send attendance summaries for yesterday
curl -X POST "$API_URL/notifications/send-attendance-summaries?date=$YESTERDAY" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Send late arrival alerts for yesterday
curl -X POST "$API_URL/notifications/send-late-alerts?date=$YESTERDAY" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Make executable:
```bash
chmod +x /home/ubuntu/SAK-Smart-Access-Control/backend/scripts/send-daily-emails.sh
```

Add to crontab:
```bash
crontab -e

# Send daily email notifications at 2 AM UTC (after attendance calculation at 1 AM)
0 2 * * * /home/ubuntu/SAK-Smart-Access-Control/backend/scripts/send-daily-emails.sh >> /home/ubuntu/SAK-Smart-Access-Control/backend/logs/email-notifications.log 2>&1
```

---

## Socket.IO Real-time Notifications

In addition to emails, the system also sends real-time Socket.IO notifications:

### Leave Application Event
```javascript
// Managers receive
socket.on('leave_application', (data) => {
  // data: { employee_name, leave_type, start_date, end_date, department }
});
```

### Leave Status Update Event
```javascript
// Employees receive
socket.on('leave_status_update', (data) => {
  // data: { status, leave_type, start_date, end_date, review_notes }
});
```

**Connection:**
```javascript
const socket = io('https://sac.saksolution.com', {
  auth: { token: 'your_jwt_token' }
});

// Join user-specific room
socket.emit('join', `user_${userId}`);
```

---

## Testing

### Test Email Sending

1. **Test Leave Application:**
```bash
# Apply for leave as employee
curl -X POST "https://sac.saksolution.com/api/v1/leaves/apply" \
  -H "Authorization: Bearer <employee_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type": "casual",
    "from_date": "2024-01-20",
    "to_date": "2024-01-22",
    "reason": "Personal work",
    "half_day": false
  }'

# Check admin email for notification
```

2. **Test Leave Approval:**
```bash
# Approve leave as admin
curl -X PUT "https://sac.saksolution.com/api/v1/leaves/<leave_id>/status" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'

# Check employee email for notification
```

3. **Test Manual Notifications:**
```bash
# Send attendance summaries
curl -X POST "https://sac.saksolution.com/api/v1/notifications/send-attendance-summaries" \
  -H "Authorization: Bearer <admin_token>"

# Send late alerts
curl -X POST "https://sac.saksolution.com/api/v1/notifications/send-late-alerts" \
  -H "Authorization: Bearer <admin_token>"
```

---

## Troubleshooting

### Common Issues

**1. Emails not sending**
- Verify `SENDGRID_API_KEY` is set correctly in environment
- Check SendGrid dashboard for API usage and errors
- Verify sender email is authenticated in SendGrid
- Check backend logs: `pm2 logs sak-backend | grep email`

**2. Email delivery issues**
- Check recipient's spam folder
- Verify email addresses are valid in database
- Check SendGrid bounce/spam reports
- Ensure HTML templates render correctly

**3. Template rendering issues**
- Test email templates with Email on Acid or Litmus
- Verify inline CSS is used (no external stylesheets)
- Check `FRONTEND_URL` is set correctly for button links

### Debug Logging

Enable detailed email logging:
```typescript
// In email.service.ts sendEmail() method
logger.info(`Sending email to ${options.to}: ${options.subject}`);
logger.info(`Email sent: ${info.messageId}`);
```

Check logs:
```bash
pm2 logs sak-backend --lines 100 | grep -i email
```

---

## API Integration Examples

### JavaScript/React
```javascript
// Send attendance summaries
const sendAttendanceSummaries = async (date) => {
  const response = await fetch(
    `${API_URL}/notifications/send-attendance-summaries?date=${date}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  return response.json();
};

// Send late alerts
const sendLateAlerts = async (date) => {
  const response = await fetch(
    `${API_URL}/notifications/send-late-alerts?date=${date}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  return response.json();
};
```

### Python
```python
import requests

def send_attendance_summaries(token, date=None):
    url = f"{API_URL}/notifications/send-attendance-summaries"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"date": date} if date else {}
    
    response = requests.post(url, headers=headers, params=params)
    return response.json()

def send_late_alerts(token, date=None):
    url = f"{API_URL}/notifications/send-late-alerts"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"date": date} if date else {}
    
    response = requests.post(url, headers=headers, params=params)
    return response.json()
```

---

## Summary

**Total Endpoints:** 2 manual + 2 automatic notification triggers

**Email Types:**
1. Leave Application Notification (automatic)
2. Leave Status Update (automatic)
3. Daily Attendance Summary (manual/scheduled)
4. Late Arrival Alert (manual/scheduled)

**Features:**
- ✅ HTML email templates with inline CSS
- ✅ Color-coded status indicators
- ✅ Action buttons linking to frontend
- ✅ SendGrid SMTP integration
- ✅ Socket.IO real-time notifications
- ✅ Department-based filtering
- ✅ Automatic triggering on leave events
- ✅ Manual/scheduled bulk sending

**Deployment Status:** ✅ Deployed (PM2 restart #69, PID 115252)
