# SAK Smart Access Control - Complete API Documentation

**Version:** 1.0.0  
**Base URL:** `https://sac.saksolution.com/api/v1`  
**Last Updated:** December 16, 2025

---

## Table of Contents

1. [Authentication](#authentication)
2. [Analytics](#analytics)
3. [Security Monitoring](#security-monitoring)
4. [Meetings](#meetings)
5. [Visitors](#visitors)
6. [Users](#users)
7. [Attendance](#attendance)
8. [Leaves](#leaves)
9. [Reports](#reports)
10. [System](#system)

---

## Authentication

### Login
**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "its_id": "ITS12345",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "its_id": "ITS12345",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "department_id": "uuid"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account locked (too many failed attempts)
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_LOCKED",
      "message": "Account locked due to multiple failed login attempts",
      "retry_after": 1800
    }
  }
  ```

**Rate Limiting:** 10 requests per 15 minutes per IP

---

## Analytics

### Get System Analytics
**GET** `/analytics/system`

Comprehensive system analytics including meetings, visitors, and check-in statistics.

**Query Parameters:**
- `period` (optional): Number of days (default: 30)
- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format

**Authorization:** Admin, Manager

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-16T00:00:00Z",
      "end": "2025-12-16T00:00:00Z",
      "days": 30
    },
    "overview": {
      "total_users": 150,
      "total_meetings": 450,
      "total_visitors": 890,
      "active_meetings": 12
    },
    "check_in_stats": {
      "total": 890,
      "checked_in": 756,
      "checked_out": 620,
      "no_show": 45,
      "check_in_rate": 85
    },
    "daily_trends": [
      {
        "date": "2025-12-01",
        "meetings": 15
      }
    ],
    "daily_visitors": [
      {
        "date": "2025-12-01",
        "visitors": 28
      }
    ],
    "top_departments": [
      {
        "department": "Engineering",
        "visitors": 245,
        "meetings": 120
      }
    ],
    "peak_hours": [
      {
        "hour": 14,
        "count": 67
      }
    ],
    "meeting_status": [
      {
        "status": "scheduled",
        "count": 120
      },
      {
        "status": "completed",
        "count": 300
      }
    ]
  }
}
```

### Get Visitor Analytics
**GET** `/analytics/visitors`

Detailed visitor patterns and statistics.

**Query Parameters:**
- `period` (optional): Number of days (default: 30)

**Authorization:** Admin, Manager, Receptionist

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "top_visitors": [
      {
        "email": "visitor@company.com",
        "name": "Jane Smith",
        "company": "ABC Corp",
        "visit_count": 15,
        "last_visit": "2025-12-15T10:30:00Z"
      }
    ],
    "top_companies": [
      {
        "company": "ABC Corp",
        "unique_visitors": 12,
        "total_visits": 45
      }
    ],
    "visitor_types": [
      {
        "type": "business",
        "count": 560
      },
      {
        "type": "personal",
        "count": 200
      }
    ],
    "avg_visit_duration_minutes": 65,
    "geography": [
      {
        "city": "Mumbai",
        "visitors": 340
      }
    ]
  }
}
```

### Get Attendance Analytics
**GET** `/analytics/attendance`

Employee attendance statistics and trends.

**Query Parameters:**
- `period` (optional): Number of days (default: 30)
- `department_id` (optional): Filter by department UUID

**Authorization:** Admin, Manager, HR

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "overall": {
      "total_records": 3000,
      "present": 2550,
      "absent": 300,
      "late": 150,
      "half_day": 50,
      "leave": 250,
      "attendance_rate": 85,
      "avg_work_hours": 8.5
    },
    "daily_trends": [
      {
        "date": "2025-12-01",
        "present": 85,
        "absent": 10,
        "late": 5
      }
    ],
    "department_stats": [
      {
        "department": "Engineering",
        "total": 600,
        "present": 540,
        "attendance_rate": 90.0
      }
    ],
    "late_patterns": [
      {
        "hour": 10,
        "count": 45
      }
    ]
  }
}
```

### Get Meeting Room Analytics
**GET** `/analytics/meeting-rooms`

Meeting room utilization and host activity statistics.

**Query Parameters:**
- `period` (optional): Number of days (default: 30)

**Authorization:** Admin, Manager

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "duration_stats": {
      "total_meetings": 450,
      "avg_duration_minutes": 45,
      "min_duration": 15,
      "max_duration": 180
    },
    "active_hosts": [
      {
        "name": "John Doe",
        "email": "john@company.com",
        "department": "Engineering",
        "meetings": 45,
        "visitors": 89
      }
    ],
    "location_distribution": [
      {
        "location": "Conference Room A",
        "count": 120
      }
    ],
    "hourly_utilization": [
      {
        "hour": 14,
        "meetings": 67,
        "total_minutes": 3015,
        "avg_minutes": 45
      }
    ],
    "top_purposes": [
      {
        "purpose": "Client Meeting",
        "count": 180
      }
    ]
  }
}
```

---

## Security Monitoring

### Get Security Statistics
**GET** `/security/stats`

24-hour security overview including violations, lockouts, and suspicious activity.

**Authorization:** Admin, Security

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "lockout_stats": {
      "active_lockouts": 3,
      "total_tracking": 45,
      "total_failed_attempts": 127
    },
    "security_events": {
      "total_violations": 18,
      "failed_logins": 67,
      "top_violations": [
        {
          "type": "RATE_LIMIT",
          "count": 12
        },
        {
          "type": "AUTHENTICATION_FAILURE",
          "count": 6
        }
      ],
      "suspicious_ips": [
        {
          "ip_address": "192.168.1.50",
          "violation_count": 8
        }
      ]
    },
    "recent_critical_events": [
      {
        "id": "uuid",
        "action_type": "SECURITY_VIOLATION",
        "user_id": "uuid",
        "timestamp": "2025-12-16T10:30:00Z",
        "ip_address": "192.168.1.50",
        "new_values": {
          "violation_type": "RATE_LIMIT"
        }
      }
    ]
  }
}
```

### Get Locked Accounts
**GET** `/security/locked-accounts`

List of currently locked accounts due to failed login attempts.

**Authorization:** Admin, Security

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "active_lockouts": 3,
    "total_tracking": 45,
    "total_failed_attempts": 127
  }
}
```

### Get Access Violations
**GET** `/security/violations`

Detailed list of access denied events.

**Query Parameters:**
- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format
- `limit` (optional): Number of results (default: 100)

**Authorization:** Admin, Security

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "id": "uuid",
        "action_type": "ACCESS_DENIED",
        "timestamp": "2025-12-16T10:30:00Z",
        "ip_address": "192.168.1.50",
        "user_agent": "Mozilla/5.0...",
        "user": {
          "id": "uuid",
          "its_id": "ITS12345",
          "name": "John Doe",
          "email": "john@example.com",
          "role": "employee"
        },
        "old_values": {
          "required_role": "admin",
          "endpoint": "/api/v1/admin/users"
        },
        "new_values": {
          "reason": "Insufficient permissions"
        }
      }
    ]
  }
}
```

---

## Meetings

### Create Meeting
**POST** `/meetings`

Create a new visitor meeting with optional multi-day support.

**Authorization:** Admin, Host, Secretary, Employee

**Request Body:**
```json
{
  "visitor_name": "Jane Smith",
  "visitor_email": "jane@company.com",
  "visitor_phone": "+919876543210",
  "visitor_company": "ABC Corp",
  "visitor_type": "business",
  "purpose": "Business Discussion",
  "meeting_time": "2025-12-20T14:00:00Z",
  "duration_minutes": 60,
  "location": "Conference Room A",
  "visitor_city": "Mumbai",
  "visitor_state": "Maharashtra",
  "visitor_country": "India",
  "multi_day": false,
  "end_date": null
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Meeting created successfully",
  "data": {
    "meeting": {
      "id": "uuid",
      "host_id": "uuid",
      "purpose": "Business Discussion",
      "meeting_time": "2025-12-20T14:00:00Z",
      "duration_minutes": 60,
      "location": "Conference Room A",
      "status": "scheduled",
      "qr_code": "MTG-ABC123",
      "created_at": "2025-12-16T10:30:00Z"
    },
    "visitor": {
      "id": "uuid",
      "meeting_id": "uuid",
      "name": "Jane Smith",
      "email": "jane@company.com",
      "phone": "+919876543210",
      "company": "ABC Corp",
      "visitor_type": "business",
      "city": "Mumbai"
    }
  }
}
```

### List Meetings
**GET** `/meetings`

Get paginated list of meetings with optional filters.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)
- `status` (optional): scheduled, in_progress, completed, cancelled
- `start_date` (optional): Filter by date range
- `end_date` (optional): Filter by date range

**Authorization:** Authenticated users

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "meetings": [
      {
        "id": "uuid",
        "host_id": "uuid",
        "host_name": "John Doe",
        "purpose": "Business Discussion",
        "meeting_time": "2025-12-20T14:00:00Z",
        "duration_minutes": 60,
        "location": "Conference Room A",
        "status": "scheduled",
        "qr_code": "MTG-ABC123",
        "visitors": [
          {
            "id": "uuid",
            "name": "Jane Smith",
            "email": "jane@company.com",
            "company": "ABC Corp",
            "check_in_time": null,
            "check_out_time": null
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "totalPages": 15
    }
  }
}
```

### Get Meeting Details
**GET** `/meetings/:id`

Get detailed information about a specific meeting.

**Authorization:** Authenticated users

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "host_id": "uuid",
    "host_name": "John Doe",
    "host_email": "john@company.com",
    "host_phone": "+919876543210",
    "department": "Engineering",
    "purpose": "Business Discussion",
    "meeting_time": "2025-12-20T14:00:00Z",
    "duration_minutes": 60,
    "location": "Conference Room A",
    "status": "scheduled",
    "qr_code": "MTG-ABC123",
    "visitors": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@company.com",
        "phone": "+919876543210",
        "company": "ABC Corp",
        "visitor_type": "business",
        "check_in_time": null,
        "check_out_time": null,
        "photo_url": null
      }
    ],
    "created_at": "2025-12-16T10:30:00Z",
    "updated_at": "2025-12-16T10:30:00Z"
  }
}
```

### Update Meeting
**PUT** `/meetings/:id`

Update meeting details (only future meetings).

**Authorization:** Admin, Host (own meetings)

**Request Body:**
```json
{
  "purpose": "Updated Purpose",
  "meeting_time": "2025-12-20T15:00:00Z",
  "duration_minutes": 90,
  "location": "Conference Room B"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Meeting updated successfully",
  "data": {
    "id": "uuid",
    "purpose": "Updated Purpose",
    "meeting_time": "2025-12-20T15:00:00Z",
    "duration_minutes": 90,
    "location": "Conference Room B"
  }
}
```

### Cancel Meeting
**DELETE** `/meetings/:id`

Cancel a scheduled meeting.

**Authorization:** Admin, Host (own meetings)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Meeting cancelled successfully"
}
```

---

## Visitors

### Check-in Visitor
**POST** `/visitors/:id/checkin`

Check-in a visitor for their meeting.

**Authorization:** Receptionist, Security, Admin

**Request Body:**
```json
{
  "photo_url": "https://example.com/photos/visitor.jpg"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Visitor checked in successfully",
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "check_in_time": "2025-12-20T14:05:00Z",
    "photo_url": "https://example.com/photos/visitor.jpg"
  }
}
```

### Check-out Visitor
**POST** `/visitors/:id/checkout`

Check-out a visitor at departure.

**Authorization:** Receptionist, Security, Admin

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Visitor checked out successfully",
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "check_in_time": "2025-12-20T14:05:00Z",
    "check_out_time": "2025-12-20T15:10:00Z",
    "duration_minutes": 65
  }
}
```

### List Visitors
**GET** `/visitors`

Get list of all visitors with filters.

**Query Parameters:**
- `status` (optional): pending, checked_in, checked_out
- `date` (optional): YYYY-MM-DD format
- `page` (optional): Page number
- `limit` (optional): Results per page

**Authorization:** Admin, Receptionist, Security

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "visitors": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@company.com",
        "company": "ABC Corp",
        "meeting_id": "uuid",
        "meeting_purpose": "Business Discussion",
        "host_name": "John Doe",
        "meeting_time": "2025-12-20T14:00:00Z",
        "check_in_time": "2025-12-20T14:05:00Z",
        "check_out_time": null,
        "status": "checked_in"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 89,
      "totalPages": 5
    }
  }
}
```

---

## Users

### Create User
**POST** `/users`

Create a new system user.

**Authorization:** Admin

**Request Body:**
```json
{
  "its_id": "ITS12345",
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "+919876543210",
  "role": "host",
  "department_id": "uuid",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "uuid",
    "its_id": "ITS12345",
    "name": "John Doe",
    "email": "john@company.com",
    "role": "host",
    "department_id": "uuid",
    "is_active": true,
    "created_at": "2025-12-16T10:30:00Z"
  }
}
```

### List Users
**GET** `/users`

Get paginated list of users.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Results per page
- `role` (optional): Filter by role
- `department_id` (optional): Filter by department

**Authorization:** Admin

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "its_id": "ITS12345",
        "name": "John Doe",
        "email": "john@company.com",
        "phone": "+919876543210",
        "role": "host",
        "department_name": "Engineering",
        "is_active": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Update User
**PUT** `/users/:id`

Update user information.

**Authorization:** Admin

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "email": "john.new@company.com",
  "phone": "+919876543211",
  "role": "admin",
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "uuid",
    "name": "John Doe Updated",
    "email": "john.new@company.com",
    "role": "admin"
  }
}
```

---

## Attendance

### Mark Attendance
**POST** `/attendance`

Mark employee attendance for the day.

**Authorization:** Admin, HR

**Request Body:**
```json
{
  "employee_id": "uuid",
  "date": "2025-12-16",
  "status": "present",
  "check_in_time": "09:00:00",
  "check_out_time": "17:30:00",
  "work_hours": 8.5,
  "notes": "On time"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "date": "2025-12-16",
    "status": "present",
    "work_hours": 8.5
  }
}
```

### Get Attendance Records
**GET** `/attendance`

Get attendance records with filters.

**Query Parameters:**
- `employee_id` (optional): Filter by employee
- `department_id` (optional): Filter by department
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD
- `status` (optional): present, absent, late, half_day, leave

**Authorization:** Admin, HR, Manager

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "employee_id": "uuid",
        "employee_name": "John Doe",
        "date": "2025-12-16",
        "status": "present",
        "check_in_time": "09:00:00",
        "check_out_time": "17:30:00",
        "work_hours": 8.5
      }
    ],
    "summary": {
      "total_days": 30,
      "present": 25,
      "absent": 2,
      "late": 3,
      "attendance_rate": 83.33
    }
  }
}
```

---

## Leaves

### Apply Leave
**POST** `/leaves`

Submit leave application.

**Authorization:** Authenticated users

**Request Body:**
```json
{
  "leave_type": "sick",
  "start_date": "2025-12-20",
  "end_date": "2025-12-22",
  "reason": "Medical appointment",
  "half_day": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Leave application submitted successfully",
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type": "sick",
    "start_date": "2025-12-20",
    "end_date": "2025-12-22",
    "total_days": 3,
    "status": "pending",
    "created_at": "2025-12-16T10:30:00Z"
  }
}
```

### Approve/Reject Leave
**PUT** `/leaves/:id/status`

Approve or reject leave application.

**Authorization:** Admin, Manager

**Request Body:**
```json
{
  "status": "approved",
  "remarks": "Approved by manager"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Leave status updated successfully",
  "data": {
    "id": "uuid",
    "status": "approved",
    "approved_by": "uuid",
    "approved_at": "2025-12-16T11:00:00Z"
  }
}
```

---

## Reports

### Generate Visitor Report
**GET** `/reports/visitors`

Generate comprehensive visitor report.

**Query Parameters:**
- `start_date`: YYYY-MM-DD (required)
- `end_date`: YYYY-MM-DD (required)
- `department_id` (optional): Filter by department
- `format` (optional): json, csv, pdf

**Authorization:** Admin, Manager

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "report_period": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "summary": {
      "total_visitors": 450,
      "total_meetings": 380,
      "unique_companies": 120,
      "avg_visit_duration": 65
    },
    "visitors": [
      {
        "date": "2025-11-15",
        "visitor_name": "Jane Smith",
        "company": "ABC Corp",
        "host": "John Doe",
        "purpose": "Business Discussion",
        "check_in": "14:00",
        "check_out": "15:10",
        "duration": "1h 10m"
      }
    ]
  }
}
```

### Generate Attendance Report
**GET** `/reports/attendance`

Generate attendance report for employees.

**Query Parameters:**
- `start_date`: YYYY-MM-DD (required)
- `end_date`: YYYY-MM-DD (required)
- `department_id` (optional): Filter by department
- `employee_id` (optional): Specific employee

**Authorization:** Admin, HR, Manager

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "report_period": {
      "start": "2025-11-01",
      "end": "2025-11-30",
      "working_days": 22
    },
    "summary": {
      "total_employees": 100,
      "avg_attendance_rate": 88.5,
      "total_present": 1947,
      "total_absent": 253
    },
    "employees": [
      {
        "employee_id": "ITS12345",
        "name": "John Doe",
        "department": "Engineering",
        "present": 20,
        "absent": 2,
        "late": 1,
        "attendance_rate": 90.91
      }
    ]
  }
}
```

---

## System

### Health Check
**GET** `/health`

Check system health status.

**Authorization:** None (public endpoint)

**Response (200 OK):**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-12-16T10:30:00Z",
  "uptime": 86400.5
}
```

### System Configuration
**GET** `/system/config`

Get system configuration settings.

**Authorization:** Admin

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "environment": "production",
    "features": {
      "whatsapp_enabled": true,
      "email_enabled": true,
      "auto_checkout": true,
      "qr_security": true
    },
    "rate_limits": {
      "api": "100 requests/minute",
      "auth": "10 requests/15 minutes"
    }
  }
}
```

---

## Error Responses

All API endpoints follow a consistent error response format:

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retry_after": 60
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## Rate Limiting

- **General API**: 100 requests per minute per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **Account Lockout**: 5 failed login attempts = 30 minute lockout

---

## Security Features

1. **JWT Authentication**: Bearer token required for protected endpoints
2. **Role-Based Access Control**: Admin, Manager, HR, Host, Receptionist, Security, Secretary, Employee
3. **Rate Limiting**: IP-based throttling with audit logging
4. **Account Lockout**: Automatic lockout after failed attempts
5. **Security Monitoring**: Real-time violation tracking
6. **Audit Logging**: All actions logged with user context
7. **HTTPS Only**: TLS 1.2+ required
8. **CSP Headers**: Content Security Policy enforced
9. **HSTS**: HTTP Strict Transport Security enabled

---

## Pagination

All list endpoints support pagination with these parameters:
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 10, max: 100)

Pagination response format:
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Total API Endpoints

**81 Total Endpoints** across 15 modules:
- Authentication: 1 endpoint
- Analytics: 4 endpoints
- Security: 3 endpoints
- Meetings: 12 endpoints
- Visitors: 8 endpoints
- Users: 10 endpoints
- Attendance: 8 endpoints
- Leaves: 7 endpoints
- Holidays: 6 endpoints
- Shifts: 5 endpoints
- Reports: 6 endpoints
- Notifications: 4 endpoints
- Dashboard: 3 endpoints
- System: 3 endpoints
- Health: 1 endpoint

---

**Last Updated:** December 16, 2025  
**Maintained by:** SAK Development Team
