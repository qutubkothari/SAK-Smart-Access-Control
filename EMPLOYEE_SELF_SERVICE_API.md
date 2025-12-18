# Employee Self-Service API Documentation

Employee-facing endpoints for accessing personal attendance, leave, access logs, and profile information.

---

## Overview

The `/api/v1/me/*` endpoints provide employees with self-service access to their own data. All endpoints require authentication but no specific role authorization - any authenticated employee can access their own information.

### Base URL
```
https://sac.saksolution.com/api/v1/me
```

### Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Table of Contents

1. [Get My Profile](#1-get-my-profile)
2. [Get My Attendance](#2-get-my-attendance)
3. [Get My Access Logs](#3-get-my-access-logs)
4. [Get My Leaves](#4-get-my-leaves)
5. [Get My Shift](#5-get-my-shift)
6. [Get My Holidays](#6-get-my-holidays)

---

## 1. Get My Profile

Get complete employee profile with department and access permissions.

### Endpoint
```
GET /api/v1/me/profile
```

### Authorization
- **Required**: Authenticated employee (any role)

### Response

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user_id": 25,
    "full_name": "Alice Johnson",
    "email": "alice.johnson@company.com",
    "phone": "+1234567890",
    "role": "employee",
    "nfc_card_id": "ABC123456",
    "is_active": true,
    "created_at": "2025-01-15T10:00:00Z",
    "department": {
      "department_id": 3,
      "department_name": "Sales",
      "description": "Sales and Business Development"
    },
    "floor_permissions": [1, 2, 3],
    "time_restrictions": [
      {
        "restriction_id": 5,
        "day_of_week": 1,
        "start_time": "09:00:00",
        "end_time": "18:00:00"
      }
    ]
  }
}
```

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 2. Get My Attendance

View personal attendance records with summary statistics.

### Endpoint
```
GET /api/v1/me/attendance
```

### Authorization
- **Required**: Authenticated employee (any role)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (YYYY-MM-DD) | No | Filter start date |
| `end_date` | string (YYYY-MM-DD) | No | Filter end date |
| `status` | string | No | Filter by status (present/late/absent/leave/etc.) |

### Response

```json
{
  "success": true,
  "message": "Attendance records retrieved successfully",
  "data": {
    "records": [
      {
        "record_id": 1234,
        "date": "2025-12-15",
        "check_in_time": "09:15:00",
        "check_out_time": "18:05:00",
        "status": "late",
        "work_hours": 7.83,
        "notes": "Late arrival: 15 minutes past grace period",
        "shift": {
          "name": "General (9-6)",
          "start_time": "09:00:00",
          "end_time": "18:00:00"
        }
      },
      {
        "record_id": 1233,
        "date": "2025-12-14",
        "check_in_time": "08:55:00",
        "check_out_time": "18:10:00",
        "status": "present",
        "work_hours": 8.25,
        "notes": null,
        "shift": {
          "name": "General (9-6)",
          "start_time": "09:00:00",
          "end_time": "18:00:00"
        }
      }
    ],
    "summary": {
      "total_days": 20,
      "present_days": 17,
      "late_days": 2,
      "absent_days": 1,
      "half_days": 0,
      "leave_days": 0,
      "avg_work_hours": 8.15,
      "attendance_percentage": 95.00
    }
  }
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `present` | On time attendance |
| `late` | Late arrival (after grace period) |
| `absent` | No check-in recorded |
| `half_day` | Less than half of shift hours |
| `early_exit` | Left before shift end time |
| `overtime` | Worked beyond shift hours |
| `leave` | Approved leave |
| `weekend` | Weekend/rest day |
| `holiday` | Public/company holiday |

### Example Requests

**Get all attendance:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/attendance" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get attendance for date range:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/attendance?start_date=2025-12-01&end_date=2025-12-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get only late arrivals:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/attendance?status=late" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 3. Get My Access Logs

View personal building/floor access history.

### Endpoint
```
GET /api/v1/me/access-logs
```

### Authorization
- **Required**: Authenticated employee (any role)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (YYYY-MM-DD) | No | Filter start date |
| `end_date` | string (YYYY-MM-DD) | No | Filter end date |
| `floor_number` | integer | No | Filter by specific floor |
| `access_granted` | boolean | No | Filter by access result (true/false) |

### Response

```json
{
  "success": true,
  "message": "Access logs retrieved successfully",
  "data": {
    "logs": [
      {
        "log_id": 5678,
        "access_time": "2025-12-16T09:15:30Z",
        "access_granted": true,
        "denial_reason": null,
        "access_point": {
          "name": "Floor 3 - Main Entrance",
          "floor_number": 3,
          "location": "North Wing"
        }
      },
      {
        "log_id": 5677,
        "access_time": "2025-12-16T08:55:12Z",
        "access_granted": false,
        "denial_reason": "Outside allowed time window",
        "access_point": {
          "name": "Floor 5 - Server Room",
          "floor_number": 5,
          "location": "Data Center"
        }
      }
    ],
    "summary": {
      "total_attempts": 150,
      "granted_count": 145,
      "denied_count": 5
    }
  }
}
```

### Common Denial Reasons

| Reason | Description |
|--------|-------------|
| `No floor permission` | Employee doesn't have access to that floor |
| `Outside allowed time window` | Access attempted outside time restrictions |
| `Inactive NFC card` | Employee's NFC card is deactivated |
| `Weekend access denied` | Access attempted on weekend without permission |

### Example Requests

**Get recent access logs:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/access-logs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get access logs for specific floor:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/access-logs?floor_number=3" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get only denied access attempts:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/access-logs?access_granted=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 4. Get My Leaves

View personal leave applications and balance.

### Endpoint
```
GET /api/v1/me/leaves
```

### Authorization
- **Required**: Authenticated employee (any role)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (pending/approved/rejected/cancelled) |
| `leave_type` | string | No | Filter by type (annual/sick/casual/emergency) |

### Response

```json
{
  "success": true,
  "message": "Leave records retrieved successfully",
  "data": {
    "leaves": [
      {
        "leave_id": 45,
        "leave_type": "annual",
        "start_date": "2025-12-20",
        "end_date": "2025-12-22",
        "half_day": false,
        "reason": "Family vacation",
        "status": "approved",
        "applied_at": "2025-12-10T10:30:00Z",
        "reviewed_at": "2025-12-11T14:20:00Z",
        "reviewed_by": "John Manager",
        "review_notes": "Approved"
      },
      {
        "leave_id": 44,
        "leave_type": "sick",
        "start_date": "2025-12-05",
        "end_date": "2025-12-05",
        "half_day": true,
        "reason": "Doctor appointment",
        "status": "approved",
        "applied_at": "2025-12-04T16:00:00Z",
        "reviewed_at": "2025-12-05T08:15:00Z",
        "reviewed_by": "John Manager",
        "review_notes": "Get well soon"
      }
    ],
    "balance": [
      {
        "leave_type": "annual",
        "allocated": 20,
        "used": 5.0,
        "remaining": 15.0
      },
      {
        "leave_type": "sick",
        "allocated": 15,
        "used": 2.5,
        "remaining": 12.5
      },
      {
        "leave_type": "casual",
        "allocated": 10,
        "used": 3.0,
        "remaining": 7.0
      },
      {
        "leave_type": "emergency",
        "allocated": 5,
        "used": 0.0,
        "remaining": 5.0
      }
    ]
  }
}
```

### Leave Types

| Type | Allocated Days | Description |
|------|----------------|-------------|
| `annual` | 20 | Planned vacation/annual leave |
| `sick` | 15 | Medical leave |
| `casual` | 10 | Short-term casual leave |
| `emergency` | 5 | Emergency situations |

### Leave Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting manager approval |
| `approved` | Approved by manager |
| `rejected` | Rejected by manager |
| `cancelled` | Cancelled by employee |

### Example Requests

**Get all leaves:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/leaves" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get pending leave applications:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/leaves?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get annual leaves only:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/leaves?leave_type=annual" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 5. Get My Shift

View current shift assignment and history.

### Endpoint
```
GET /api/v1/me/shift
```

### Authorization
- **Required**: Authenticated employee (any role)

### Response

```json
{
  "success": true,
  "message": "Shift information retrieved successfully",
  "data": {
    "current_shift": {
      "assignment_id": 123,
      "effective_from": "2025-12-01",
      "effective_until": null,
      "shift": {
        "shift_id": "550e8400-e29b-41d4-a716-446655440000",
        "shift_name": "General (9-6)",
        "start_time": "09:00:00",
        "end_time": "18:00:00",
        "grace_period_minutes": 15,
        "break_duration_minutes": 60
      },
      "assigned_by": "HR Manager",
      "assigned_at": "2025-11-28T10:00:00Z"
    },
    "history": [
      {
        "assignment_id": 123,
        "effective_from": "2025-12-01",
        "effective_until": null,
        "shift_name": "General (9-6)",
        "start_time": "09:00:00",
        "end_time": "18:00:00",
        "assigned_by": "HR Manager",
        "assigned_at": "2025-11-28T10:00:00Z"
      },
      {
        "assignment_id": 122,
        "effective_from": "2025-01-01",
        "effective_until": "2025-11-30",
        "shift_name": "Early Shift (8-5)",
        "start_time": "08:00:00",
        "end_time": "17:00:00",
        "assigned_by": "HR Manager",
        "assigned_at": "2024-12-15T14:30:00Z"
      }
    ]
  }
}
```

### Error Response (No Shift Assigned)

```json
{
  "success": false,
  "error": {
    "code": "NO_SHIFT_ASSIGNED",
    "message": "No active shift assigned"
  }
}
```

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/shift" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 6. Get My Holidays

View upcoming company and department holidays.

### Endpoint
```
GET /api/v1/me/holidays
```

### Authorization
- **Required**: Authenticated employee (any role)

### Response

```json
{
  "success": true,
  "message": "Holidays retrieved successfully",
  "data": [
    {
      "holiday_id": 15,
      "holiday_name": "Christmas Day",
      "holiday_date": "2025-12-25",
      "is_optional": false,
      "department_specific": false,
      "department_name": null
    },
    {
      "holiday_id": 16,
      "holiday_name": "New Year's Day",
      "holiday_date": "2026-01-01",
      "is_optional": false,
      "department_specific": false,
      "department_name": null
    },
    {
      "holiday_id": 17,
      "holiday_name": "Department Annual Day",
      "holiday_date": "2026-01-15",
      "is_optional": true,
      "department_specific": true,
      "department_name": "Sales"
    }
  ]
}
```

### Holiday Types

- **Company-wide**: Applies to all employees (department_specific: false)
- **Department-specific**: Only applies to specific department (department_specific: true)
- **Optional**: Employee can choose to work (is_optional: true)
- **Mandatory**: All employees must observe (is_optional: false)

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/me/holidays" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Common Response Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success - Data retrieved |
| `401` | Unauthorized - Invalid or missing JWT token |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error - Server error |

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | No token provided |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `PROFILE_NOT_FOUND` | Employee profile not found |
| `NO_SHIFT_ASSIGNED` | No active shift assigned to employee |
| `EMPLOYEE_NOT_FOUND` | Employee record not found |
| `ATTENDANCE_RETRIEVAL_FAILED` | Server error retrieving attendance |
| `ACCESS_LOGS_RETRIEVAL_FAILED` | Server error retrieving access logs |
| `LEAVES_RETRIEVAL_FAILED` | Server error retrieving leave records |
| `SHIFT_RETRIEVAL_FAILED` | Server error retrieving shift info |
| `HOLIDAYS_RETRIEVAL_FAILED` | Server error retrieving holidays |

---

## Frontend Integration Examples

### React Component - My Attendance Widget

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function MyAttendanceWidget() {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000)
          .toISOString().split('T')[0];

        const response = await axios.get(
          `https://sac.saksolution.com/api/v1/me/attendance?start_date=${thirtyDaysAgo}&end_date=${today}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        setAttendance(response.data.data);
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="attendance-widget">
      <h3>My Attendance (Last 30 Days)</h3>
      <div className="stats">
        <div>
          <strong>Attendance %:</strong> 
          {attendance.summary.attendance_percentage}%
        </div>
        <div>
          <strong>Present Days:</strong> 
          {attendance.summary.present_days}
        </div>
        <div>
          <strong>Late Days:</strong> 
          {attendance.summary.late_days}
        </div>
        <div>
          <strong>Avg Work Hours:</strong> 
          {attendance.summary.avg_work_hours}
        </div>
      </div>
    </div>
  );
}
```

### Leave Balance Display

```jsx
function LeaveBalanceCard() {
  const [balance, setBalance] = useState([]);

  useEffect(() => {
    const fetchLeaves = async () => {
      const token = localStorage.getItem('jwt_token');
      const response = await axios.get(
        'https://sac.saksolution.com/api/v1/me/leaves',
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setBalance(response.data.data.balance);
    };

    fetchLeaves();
  }, []);

  return (
    <div className="leave-balance">
      <h3>Leave Balance</h3>
      {balance.map(leave => (
        <div key={leave.leave_type} className="leave-type">
          <span>{leave.leave_type.toUpperCase()}</span>
          <span>{leave.remaining} / {leave.allocated} days</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Mobile App Integration

### Swift (iOS)

```swift
struct AttendanceService {
    let baseURL = "https://sac.saksolution.com/api/v1"
    
    func fetchMyAttendance(completion: @escaping (Result<AttendanceData, Error>) -> Void) {
        guard let token = UserDefaults.standard.string(forKey: "jwt_token") else {
            return
        }
        
        var request = URLRequest(url: URL(string: "\(baseURL)/me/attendance")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Handle response
        }.resume()
    }
}
```

### Kotlin (Android)

```kotlin
class EmployeeApiService(private val token: String) {
    private val baseUrl = "https://sac.saksolution.com/api/v1"
    
    suspend fun getMyProfile(): ProfileResponse {
        return withContext(Dispatchers.IO) {
            val response = httpClient.get("$baseUrl/me/profile") {
                headers {
                    append("Authorization", "Bearer $token")
                }
            }
            response.body()
        }
    }
}
```

---

## Best Practices

1. **Token Storage**: Store JWT tokens securely (HttpOnly cookies for web, Keychain/KeyStore for mobile)
2. **Token Refresh**: Implement token refresh logic before expiration (tokens expire in 24 hours)
3. **Caching**: Cache employee profile and shift data (update when changes occur)
4. **Error Handling**: Display user-friendly messages for common errors
5. **Loading States**: Show loading indicators during API calls
6. **Offline Support**: Cache recent data for offline viewing
7. **Real-time Updates**: Use Socket.IO for leave status changes notifications

---

## Related Documentation

- [Leave Management API](./LEAVE_HOLIDAY_API.md) - For applying new leaves
- [Reports API](./REPORTS_API.md) - For admin/management reports
- [Access Control API](./ACCESS_CONTROL_ATTENDANCE_API.md) - For access validation

---

## Support

- **Backend URL**: https://sac.saksolution.com
- **API Version**: v1
- **Server**: AWS EC2 (3.108.52.219)
- **Status**: Production
