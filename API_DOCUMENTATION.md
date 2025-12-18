# SAK Smart Access Control - Complete API Documentation

**Version:** 1.0  
**Base URL:** `https://your-domain.com/api/v1`  
**Authentication:** Bearer JWT Token  
**Date:** December 15, 2025

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Users & Hosts](#users--hosts)
3. [Meetings (External Visitors)](#meetings-external-visitors)
4. [Internal Meeting Rooms](#internal-meeting-rooms)
5. [Visitors Management](#visitors-management)
6. [Dashboard & Analytics](#dashboard--analytics)
7. [WhatsApp Integration](#whatsapp-integration)
8. [Notifications](#notifications)
9. [Pre-Registration](#pre-registration)
10. [Adhoc Visits (Walk-ins)](#adhoc-visits-walk-ins)
11. [User Availability](#user-availability)

---

## 🔐 Authentication

### POST `/auth/login`
Login with ITS ID and password.

**Request:**
```json
{
  "its_id": "ITS000001",
  "password": "Admin123!"
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
      "itsId": "ITS000001",
      "name": "Admin User",
      "email": "admin@company.com",
      "role": "admin",
      "phone": "+919876543210",
      "departmentId": "uuid",
      "isActive": true
    }
  }
}
```

**Roles:**
- `admin` - Full system access
- `host` - Create meetings, manage own meetings
- `receptionist` - Check-in visitors, view all meetings
- `security` - Check-in visitors (limited access)

### POST `/auth/register`
Register new user (Admin only).

**Request:**
```json
{
  "itsId": "ITS000010",
  "email": "user@company.com",
  "password": "User123!",
  "name": "John Doe",
  "phone": "+919876543210",
  "departmentId": "uuid",
  "role": "host"
}
```

### GET `/auth/profile`
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "itsId": "ITS000001",
    "name": "John Doe",
    "email": "john@company.com",
    "role": "host",
    "phone": "+919876543210",
    "departmentId": "uuid",
    "department": {
      "id": "uuid",
      "name": "Engineering",
      "floorNumber": 3,
      "building": "Tech Tower"
    }
  }
}
```

### POST `/auth/change-password`
Change user password.

**Request:**
```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

---

## 👥 Users & Hosts

### GET `/users/search-hosts`
Search for hosts by name, ITS ID, or email.

**Query Parameters:**
- `q` - Search query (min 2 characters)

**Example:** `GET /users/search-hosts?q=john`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "its_id": "ITS100001",
      "name": "John Doe",
      "email": "john@company.com",
      "phone": "+919876543210",
      "department_id": "uuid",
      "department_name": "Engineering",
      "floor_number": 3,
      "building": "Tech Tower"
    }
  ]
}
```

### GET `/users/lookup/{its_id}`
Lookup user by ITS ID (for internal meetings).

**Example:** `GET /users/lookup/ITS100001`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "its_id": "ITS100001",
    "name": "John Doe",
    "email": "john@company.com",
    "phone": "+919876543210",
    "role": "host",
    "department_id": "uuid",
    "department_name": "Engineering",
    "floor_number": 3,
    "building": "Tech Tower"
  }
}
```

### GET `/users`
Get all users (Admin only).

**Query Parameters:**
- `role` - Filter by role
- `department_id` - Filter by department
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

### POST `/users`
Create new user (Admin only).

### PUT `/users/{id}`
Update user (Admin only).

### DELETE `/users/{id}`
Deactivate user (Admin only).

---

## 📅 Meetings (External Visitors)

### POST `/meetings`
Create a new meeting with external visitors.

**Request:**
```json
{
  "host_id": "uuid",
  "meeting_time": "2025-12-20T14:00:00",
  "duration_minutes": 60,
  "location": "Conference Room A",
  "room_number": "CR-2A",
  "purpose": "Product Demo",
  "visitors": [
    {
      "name": "Jane Smith",
      "email": "jane@client.com",
      "phone": "+919876543210",
      "company": "Client Corp",
      "city": "Mumbai",
      "state": "Maharashtra",
      "visitor_type": "guest"
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
        "qr_code": "data:image/png;base64,...",
        "qr_id": "abc123xyz",
        "email_sent": true,
        "whatsapp_sent": true
      }
    ]
  }
}
```

**Features:**
- Auto-generates unique QR code for each visitor
- Sends QR via WhatsApp + Email
- QR expires after meeting time + 24 hours
- Prevents double-booking for host
- Real-time Socket.IO notification to host

### GET `/meetings`
Get all meetings.

**Query Parameters:**
- `status` - Filter by status (scheduled, active, completed, cancelled)
- `date_from` - Start date (YYYY-MM-DD)
- `date_to` - End date (YYYY-MM-DD)
- `host_id` - Filter by host
- `page` - Page number
- `limit` - Items per page
- `sort_by` - Sort field (default: meeting_time)
- `sort_order` - asc/desc

**Response:**
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "id": "uuid",
        "hostId": "uuid",
        "hostName": "John Doe",
        "meetingTime": "2025-12-20T14:00:00Z",
        "durationMinutes": 60,
        "location": "Conference Room A",
        "roomNumber": "CR-2A",
        "purpose": "Product Demo",
        "status": "scheduled",
        "meetingType": "external",
        "visitorCount": 2,
        "createdAt": "2025-12-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### GET `/meetings/{id}`
Get meeting details with visitors.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "hostId": "uuid",
    "hostName": "John Doe",
    "meetingTime": "2025-12-20T14:00:00Z",
    "durationMinutes": 60,
    "location": "Conference Room A",
    "purpose": "Product Demo",
    "status": "scheduled",
    "meetingType": "external",
    "visitors": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@client.com",
        "phone": "+919876543210",
        "company": "Client Corp",
        "checkInTime": "2025-12-20T13:55:00Z",
        "checkOutTime": null,
        "badgeNumber": "V001",
        "qrCode": "...",
        "qrCodeExpiresAt": "2025-12-21T14:00:00Z"
      }
    ]
  }
}
```

### GET `/meetings/availability`
Check host availability.

**Query Parameters:**
- `host_id` (required)
- `date` (required) - YYYY-MM-DD
- `duration_minutes` - Default: 60
- `slot_minutes` - Default: 30

**Response:**
```json
{
  "success": true,
  "data": {
    "host_id": "uuid",
    "date": "2025-12-20",
    "duration_minutes": 60,
    "slot_minutes": 30,
    "business_hours": {
      "start": "09:00",
      "end": "18:00"
    },
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": true },
      { "time": "10:00", "available": false },
      { "time": "14:00", "available": true }
    ]
  }
}
```

### PUT `/meetings/{id}`
Update meeting details.

### DELETE `/meetings/{id}`
Cancel meeting (sends cancellation notifications).

### POST `/meetings/{id}/check-in`
Host check-in for meeting.

---

## 🏢 Internal Meeting Rooms

### GET `/meeting-rooms`
Get all meeting rooms.

**Query Parameters:**
- `floor` - Filter by floor number
- `building` - Filter by building
- `is_active` - Filter active rooms (default: true)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Tech Hub 3A",
      "code": "TH-3A",
      "floor_number": 3,
      "building": "Tech Tower",
      "capacity": 15,
      "equipment": {
        "projector": true,
        "whiteboard": true,
        "dual_monitors": true
      },
      "description": "Tech team collaboration space",
      "is_active": true
    }
  ]
}
```

### GET `/meeting-rooms/{id}`
Get room details.

### POST `/meeting-rooms`
Create meeting room (Admin only).

**Request:**
```json
{
  "name": "Conference Room 6A",
  "code": "CR-6A",
  "floor_number": 6,
  "building": "Main Tower",
  "capacity": 20,
  "equipment": {
    "projector": true,
    "video_conference": true
  },
  "description": "Large conference room"
}
```

### PUT `/meeting-rooms/{id}`
Update room (Admin only).

### GET `/meeting-rooms/availability`
Check room availability.

**Query Parameters:**
- `room_id` (required)
- `date` (required) - YYYY-MM-DD
- `start_time` (required) - HH:MM
- `duration_minutes` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "available": false,
    "conflicting_meetings": [
      {
        "id": "uuid",
        "meeting_time": "2025-12-20T14:00:00Z",
        "duration_minutes": 90,
        "purpose": "Team Sync",
        "host_id": "uuid"
      }
    ]
  }
}
```

### GET `/meeting-rooms/schedule`
Get room schedule for a day.

**Query Parameters:**
- `room_id` (required)
- `date` (required) - YYYY-MM-DD

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "meeting_time": "2025-12-20T09:00:00Z",
      "duration_minutes": 60,
      "purpose": "Team Standup",
      "status": "scheduled",
      "meeting_type": "internal",
      "host_name": "John Doe",
      "host_its_id": "ITS100001"
    }
  ]
}
```

---

## 🏢 Internal Meetings (Staff)

### POST `/internal-meetings/check-availability`
Check if participants have conflicts.

**Request:**
```json
{
  "participant_its_ids": ["ITS100001", "ITS100002"],
  "meeting_time": "2025-12-20T14:00:00",
  "duration_minutes": 60
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conflicts": true,
    "available_participants": [
      {
        "id": "uuid",
        "its_id": "ITS100002",
        "name": "Jane Smith",
        "email": "jane@company.com"
      }
    ],
    "conflicted_participants": [
      {
        "its_id": "ITS100001",
        "name": "John Doe",
        "email": "john@company.com",
        "phone": "+919876543210",
        "conflicting_meetings": [
          {
            "meeting_id": "uuid",
            "meeting_time": "2025-12-20T14:30:00Z",
            "duration_minutes": 60,
            "purpose": "Client Call",
            "location": "Conference Room 2A"
          }
        ]
      }
    ]
  }
}
```

### POST `/internal-meetings`
Create internal meeting with conflict override.

**Request:**
```json
{
  "meeting_room_id": "uuid",
  "meeting_time": "2025-12-20T14:00:00",
  "duration_minutes": 60,
  "purpose": "Team Sync",
  "participant_its_ids": ["ITS100001", "ITS100002", "ITS100003"],
  "override_conflicts": true,
  "override_reason": "Urgent escalation meeting"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting_id": "uuid",
    "meeting_type": "internal",
    "room": {
      "id": "uuid",
      "name": "Tech Hub 3A",
      "floor": 3
    },
    "participants": [
      {
        "participant_name": "John Doe",
        "its_id": "ITS100001",
        "qr_code": "data:image/png;base64,...",
        "qr_id": "xyz789abc"
      }
    ],
    "conflicts_overridden": true
  }
}
```

**Features:**
- `override_conflicts: true` - Cancels conflicting meetings
- Sends WhatsApp + Email to all affected participants
- Generates QR codes for each participant
- Logs override in `participant_conflicts` table
- Validates room capacity

### GET `/internal-meetings/{meeting_id}/participants`
Get internal meeting participants.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "its_id": "ITS100001",
      "name": "John Doe",
      "email": "john@company.com",
      "phone": "+919876543210",
      "status": "invited",
      "is_organizer": true,
      "check_in_time": null,
      "check_out_time": null,
      "badge_number": null
    }
  ]
}
```

---

## 👤 Visitors Management

### POST `/visitors/check-in`
Check-in visitor by scanning QR code.

**Request:**
```json
{
  "qr_code": "abc123xyz"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "visitor": {
      "id": "uuid",
      "name": "Jane Smith",
      "company": "Client Corp",
      "checkInTime": "2025-12-20T13:55:00Z"
    },
    "meeting": {
      "id": "uuid",
      "hostName": "John Doe",
      "location": "Conference Room A",
      "meetingTime": "2025-12-20T14:00:00Z"
    },
    "badge_number": "V001"
  }
}
```

**Features:**
- Validates QR code (not expired, not used)
- Enforces meeting time window (30 min early, 15 min late)
- Assigns badge number
- Sends real-time notification to host
- Logs entry in `visitor_access_log`

### POST `/visitors/check-out`
Check-out visitor by QR code.

**Request:**
```json
{
  "qr_code": "abc123xyz"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Visitor checked out successfully",
  "data": {
    "visitor_name": "Jane Smith",
    "check_out_time": "2025-12-20T15:30:00Z",
    "duration_minutes": 95
  }
}
```

### GET `/visitors`
Get all visitors.

**Query Parameters:**
- `status` - checked_in, checked_out
- `date` - YYYY-MM-DD
- `meeting_id`
- `page`, `limit`

### GET `/visitors/{id}`
Get visitor details.

### POST `/visitors/badge/assign`
Manually assign badge.

**Request:**
```json
{
  "visitor_id": "uuid",
  "badge_number": "V042"
}
```

### POST `/visitors/badge/return`
Return badge on checkout.

**Request:**
```json
{
  "badge_number": "V042"
}
```

---

## 📊 Dashboard & Analytics

### GET `/dashboard/stats`
Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "total_meetings": 12,
      "active_meetings": 3,
      "checked_in_visitors": 8,
      "pending_visitors": 4
    },
    "week": {
      "total_meetings": 67,
      "total_visitors": 89,
      "avg_visitors_per_day": 12.7
    },
    "trends": {
      "meetings_by_day": [
        { "date": "2025-12-09", "count": 10 },
        { "date": "2025-12-10", "count": 12 }
      ],
      "visitors_by_type": [
        { "type": "guest", "count": 45 },
        { "type": "vendor", "count": 23 }
      ]
    }
  }
}
```

### GET `/dashboard/host/stats`
Get host-specific stats (for logged-in host).

### GET `/dashboard/receptionist/stats`
Get receptionist stats.

### GET `/dashboard/recent-activity`
Get recent activity.

**Query Parameters:**
- `limit` - Default: 10

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "visitor_name": "Jane Smith",
      "company": "Client Corp",
      "host_name": "John Doe",
      "check_in_time": "2025-12-15T13:55:00Z",
      "meeting_time": "2025-12-15T14:00:00Z",
      "location": "Conference Room A"
    }
  ]
}
```

---

## 💬 WhatsApp Integration

### GET `/whatsapp/status`
Check WhatsApp connection status.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "qr_available": false,
    "session_id": "default"
  }
}
```

### GET `/whatsapp/qr-code`
Get QR code for WhatsApp pairing.

**Response:**
```json
{
  "success": true,
  "data": {
    "qr_code": "data:image/png;base64,..."
  }
}
```

### POST `/whatsapp/send`
Send WhatsApp message.

**Request:**
```json
{
  "phone": "+919876543210",
  "message": "Hello! Your meeting is confirmed."
}
```

### POST `/whatsapp/send-image`
Send WhatsApp message with image.

**Request (multipart/form-data):**
- `phone` - Phone number
- `message` - Caption text
- `image` - File upload

---

## 🔔 Notifications

### GET `/notifications`
Get user notifications.

**Query Parameters:**
- `status` - unread, read
- `type` - meeting_created, visitor_checked_in, etc.
- `page`, `limit`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "visitor_checked_in",
      "subject": "Visitor Arrived",
      "message": "Jane Smith has checked in for your 2:00 PM meeting",
      "status": "unread",
      "created_at": "2025-12-15T13:55:00Z",
      "metadata": {
        "visitor_id": "uuid",
        "meeting_id": "uuid"
      }
    }
  ]
}
```

### PUT `/notifications/{id}/read`
Mark notification as read.

### PUT `/notifications/read-all`
Mark all notifications as read.

---

## 📝 Pre-Registration

### POST `/preregister`
Visitor self-registration (public endpoint).

**Request:**
```json
{
  "visitor_name": "Jane Smith",
  "visitor_email": "jane@client.com",
  "visitor_phone": "+919876543210",
  "company": "Client Corp",
  "host_its_id": "ITS100001",
  "visit_date": "2025-12-20T14:00:00",
  "purpose": "Product Demo",
  "id_proof_type": "passport",
  "id_proof_number": "A1234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pre-registration successful. QR code sent to your email.",
  "data": {
    "registration_id": "uuid",
    "qr_code": "data:image/png;base64,..."
  }
}
```

**Features:**
- No authentication required
- Creates pending meeting
- Sends QR code to visitor email
- Notifies host for approval

### GET `/preregister`
Get pre-registrations (Host/Admin).

**Query Parameters:**
- `status` - pending, approved, rejected
- `date`

---

## 🚶 Adhoc Visits (Walk-ins)

### POST `/adhoc`
Register walk-in visitor (Angadiya).

**Request:**
```json
{
  "visitor_name": "Urgent Delivery Person",
  "visitor_phone": "+919876543210",
  "host_its_id": "ITS100001",
  "purpose": "Document Delivery",
  "company": "Courier Service"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "visitor_id": "uuid",
    "meeting_id": "uuid",
    "badge_number": "V042",
    "check_in_time": "2025-12-15T14:30:00Z",
    "valid_until": "2025-12-15T16:30:00Z",
    "qr_code": "data:image/png;base64,..."
  }
}
```

**Features:**
- Auto-creates 2-hour meeting
- Immediate check-in
- Assigns badge
- Notifies host
- No email/QR sent (walk-in only)

### GET `/adhoc`
Get adhoc visits.

**Query Parameters:**
- `date` - YYYY-MM-DD
- `host_id`

---

## 📆 User Availability

### GET `/availability`
Get user availability blocks.

**Query Parameters:**
- `user_id` - Target user (defaults to logged-in user)
- `date_from`, `date_to`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "start_time": "2025-12-20T13:00:00Z",
      "end_time": "2025-12-20T14:00:00Z",
      "reason": "Lunch Break",
      "is_recurring": false
    }
  ]
}
```

### POST `/availability`
Create availability block (time-off, busy period).

**Request:**
```json
{
  "start_time": "2025-12-20T13:00:00",
  "end_time": "2025-12-20T14:00:00",
  "reason": "Lunch Break",
  "is_recurring": false,
  "recurrence_pattern": null
}
```

### PUT `/availability/{id}`
Update availability block.

### DELETE `/availability/{id}`
Delete availability block.

---

## 🔧 System Endpoints

### GET `/health`
Health check.

**Response:**
```json
{
  "success": true,
  "message": "SAK Access Control API is running",
  "timestamp": "2025-12-15T14:30:00Z",
  "environment": "production"
}
```

---

## 📡 WebSocket Events (Socket.IO)

**Connection:** `wss://your-domain.com`

**Authentication:** Send JWT token after connection

### Client Events

```javascript
socket.emit('join_room', userId);
```

### Server Events

**meeting:created**
```json
{
  "meeting_id": "uuid",
  "host_id": "uuid"
}
```

**visitor:checked_in**
```json
{
  "visitor_id": "uuid",
  "visitor_name": "Jane Smith",
  "meeting_id": "uuid",
  "host_id": "uuid",
  "check_in_time": "2025-12-15T13:55:00Z"
}
```

**meeting:cancelled**
```json
{
  "meeting_id": "uuid",
  "host_id": "uuid"
}
```

---

## 🔒 Security Features

### JWT Token
- Algorithm: HS256
- Expiry: 24 hours
- Header: `Authorization: Bearer <token>`

### QR Code Security
- JWT-based with JTI (unique token ID)
- One-time use (stored in Redis)
- Expiry validation
- Not before (nbf) claim
- Compact QR ID (Base62 encoded)

### Rate Limiting
- 100 requests per 15 minutes per IP
- 5 login attempts per 15 minutes

### Password Policy
- Minimum 8 characters
- Requires uppercase, lowercase, number, special char
- Bcrypt hashing (10 rounds)

---

## 📋 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `TIME_SLOT_UNAVAILABLE` | 409 | Host double-booking |
| `PARTICIPANT_CONFLICT` | 409 | Internal meeting conflict |
| `QR_CODE_INVALID` | 400 | Invalid/expired QR code |
| `QR_CODE_ALREADY_USED` | 409 | QR already scanned |
| `MEETING_NOT_STARTED` | 400 | Check-in too early |
| `MEETING_EXPIRED` | 400 | Check-in too late |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 🚀 Postman Collection

Import this base collection and replace `{{baseUrl}}` with your API URL:

```json
{
  "info": {
    "name": "SAK Access Control API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "https://your-domain.com/api/v1"
    },
    {
      "key": "token",
      "value": "your-jwt-token"
    }
  ]
}
```

---

## 📞 Support & Contact

**Technical Support:** tech@company.com  
**API Documentation:** https://your-domain.com/docs  
**Status Page:** https://status.your-domain.com

---

## 📝 Changelog

### Version 1.0 (December 15, 2025)
- ✅ Complete authentication system
- ✅ External visitor meetings with QR codes
- ✅ Internal meeting room booking
- ✅ Participant conflict detection & override
- ✅ WhatsApp + Email notifications
- ✅ Real-time Socket.IO updates
- ✅ Multi-day visit support
- ✅ Multiple entry/exit tracking
- ✅ Adhoc walk-in visits
- ✅ Pre-registration portal
- ✅ Dashboard analytics

---

**Built with ❤️ by ITS52 Team**  
**Powered by:** Node.js, TypeScript, Express, PostgreSQL, Redis, Socket.IO, WhatsApp Baileys
