# API Documentation

Base URL: `https://api.sak-access.com/v1`  
EC2 IP: `http://3.108.52.219/api/v1`

## Authentication

All endpoints except `/auth/*` require JWT token in header:
```
Authorization: Bearer <token>
```

---

## 1. Authentication

### POST /auth/login
Login with ITS ID and password.

**Request:**
```json
{
  "its_id": "ITS123456",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "its_id": "ITS123456",
      "name": "John Doe",
      "email": "john@company.com",
      "role": "host",
      "department": "Engineering"
    }
  }
}
```

### POST /auth/refresh
Refresh JWT token.

### POST /auth/logout
Logout and invalidate token.

---

## 2. Meetings

### POST /meetings
Create a new meeting (Single-Click).

**Request:**
```json
{
  "meeting_time": "2025-12-15T14:00:00Z",
  "duration_minutes": 60,
  "location": "Conference Room A",
  "purpose": "Product Demo",
  "visitors": [
    {
      "name": "Jane Smith",
      "email": "jane@client.com",
      "phone": "+919876543210",
      "company": "Client Corp"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting_id": "uuid",
    "qr_codes": [
      {
        "visitor_name": "Jane Smith",
        "qr_code": "base64_image_or_url",
        "email_sent": true,
        "whatsapp_sent": true
      }
    ]
  }
}
```

### GET /meetings
Get all meetings for logged-in user.

**Query Params:**
- `status`: `scheduled|in_progress|completed|cancelled`
- `date_from`: ISO date
- `date_to`: ISO date
- `page`: Page number
- `limit`: Items per page

### GET /meetings/:id
Get meeting details.

### PUT /meetings/:id
Update meeting.

### DELETE /meetings/:id
Cancel meeting.

### POST /meetings/:id/check-in
Mark host as checked in to meeting location.

---

## 3. Visitors

### POST /visitors/check-in
Check in visitor by scanning QR code.

**Request:**
```json
{
  "qr_code": "encrypted_qr_string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "visitor": {
      "name": "Jane Smith",
      "company": "Client Corp",
      "photo_url": null
    },
    "meeting": {
      "host_name": "John Doe",
      "location": "Conference Room A",
      "time": "2025-12-15T14:00:00Z"
    },
    "notification_sent": true
  }
}
```

### POST /visitors/:id/check-out
Check out visitor.

### POST /visitors/:id/photo
Upload visitor photo.

### GET /visitors
Get all visitors (Admin/Security only).

### GET /visitors/:id
Get visitor details.

---

## 4. Notifications

### GET /notifications
Get notifications for logged-in user.

**Query Params:**
- `unread`: `true|false`
- `type`: Notification type
- `page`, `limit`

### PUT /notifications/:id/read
Mark notification as read.

### PUT /notifications/read-all
Mark all notifications as read.

---

## 5. Users (Admin Only)

### GET /users
Get all users.

### POST /users
Create new user.

### GET /users/:id
Get user details.

### PUT /users/:id
Update user.

### DELETE /users/:id
Deactivate user.

---

## 6. Dashboard

### GET /dashboard/stats
Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "total_meetings": 45,
      "active_visitors": 12,
      "completed_meetings": 30,
      "no_shows": 3
    },
    "this_week": {
      "total_meetings": 230,
      "unique_visitors": 180
    },
    "popular_times": [
      { "hour": 10, "count": 25 },
      { "hour": 14, "count": 30 }
    ]
  }
}
```

### GET /dashboard/recent-activity
Get recent visitor activity.

---

## 7. Reports (Admin Only)

### GET /reports/visitors
Generate visitor report.

**Query Params:**
- `date_from`, `date_to`
- `department_id`
- `format`: `json|csv|pdf`

### GET /reports/meetings
Generate meeting report.

### GET /reports/audit
Generate audit log report.

---

## 8. Settings

### GET /settings
Get system settings.

### PUT /settings
Update settings (Admin only).

---

## 9. Blacklist (Security Only)

### GET /blacklist
Get blacklisted persons.

### POST /blacklist
Add person to blacklist.

### DELETE /blacklist/:id
Remove from blacklist.

---

## WebSocket Events

Connect to: `ws://3.108.52.219/socket.io`

### Events (Client → Server)
- `join_room`: Join user's notification room
- `leave_room`: Leave room

### Events (Server → Client)
- `visitor_arrived`: When visitor checks in
  ```json
  {
    "visitor_name": "Jane Smith",
    "meeting_time": "2025-12-15T14:00:00Z",
    "location": "Conference Room A"
  }
  ```
- `meeting_reminder`: 30-min reminder
- `new_notification`: Any new notification

---

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QR_CODE",
    "message": "QR code is invalid or expired",
    "details": {}
  }
}
```

### Error Codes
- `UNAUTHORIZED`: 401
- `FORBIDDEN`: 403
- `NOT_FOUND`: 404
- `VALIDATION_ERROR`: 422
- `INTERNAL_ERROR`: 500

---

## Rate Limiting

- **General APIs**: 100 requests/minute
- **Auth APIs**: 5 requests/minute
- **WebSocket**: 1 connection per user

---

## Pagination

All list endpoints support pagination:
```
GET /meetings?page=2&limit=20
```

Response includes:
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 2,
    "limit": 20,
    "total_pages": 5
  }
}
```

---

## Webhook Integration

For external systems to receive notifications:

### POST /webhooks
Register webhook URL.

### Events Sent
- `meeting.created`
- `visitor.checked_in`
- `meeting.completed`
- `meeting.cancelled`
