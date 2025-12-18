# Audit Logging API Documentation

## Overview
Comprehensive audit logging system that tracks all important actions in the SAK Smart Access Control system. Automatically logs user activities, security events, data modifications, and system access.

**Base URL:** `https://sac.saksolution.com/api/v1`

---

## Endpoints

### 1. Get Audit Logs

**Endpoint:** `GET /api/v1/audit`

**Authentication:** Required (JWT Token)

**Authorization:** Admin, Security

**Description:** Retrieve audit logs with filtering and pagination

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string (UUID) | No | Filter by specific user |
| action_type | string | No | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ACCESS_GRANTED, ACCESS_DENIED, SECURITY_VIOLATION, EXPORT, IMPORT |
| entity_type | string | No | user, door, leave, attendance, visitor, meeting, etc. |
| from_date | string | No | Start date (YYYY-MM-DD or ISO 8601) |
| to_date | string | No | End date (YYYY-MM-DD or ISO 8601) |
| page | number | No | Page number (default: 1) |
| limit | number | No | Records per page (default: 50, max: 100) |

**Request Example:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/audit?action_type=DELETE&page=1&limit=20" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "audit_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "user-uuid",
      "user_name": "Ahmed Khan",
      "user_email": "ahmed@example.com",
      "action_type": "DELETE",
      "entity_type": "visitor",
      "entity_id": "visitor-uuid",
      "old_values": {
        "name": "John Doe",
        "phone": "+971501234567"
      },
      "new_values": null,
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-12-16T10:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

### 2. Get Audit Statistics

**Endpoint:** `GET /api/v1/audit/statistics`

**Authentication:** Required (JWT Token)

**Authorization:** Admin only

**Description:** Get comprehensive statistics about audit logs including action distribution, entity distribution, top users, and critical actions

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from_date | string | No | Start date for statistics |
| to_date | string | No | End date for statistics |

**Request Example:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/audit/statistics?from_date=2024-12-01&to_date=2024-12-16" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "total_logs": 5000,
    "action_statistics": [
      { "action_type": "LOGIN", "count": 1200 },
      { "action_type": "UPDATE", "count": 850 },
      { "action_type": "CREATE", "count": 720 },
      { "action_type": "ACCESS_GRANTED", "count": 650 },
      { "action_type": "DELETE", "count": 45 }
    ],
    "entity_statistics": [
      { "entity_type": "user", "count": 900 },
      { "entity_type": "visitor", "count": 750 },
      { "entity_type": "attendance", "count": 600 },
      { "entity_type": "leave", "count": 450 }
    ],
    "top_users": [
      {
        "user_id": "user-uuid",
        "full_name": "Ahmed Khan",
        "email": "ahmed@example.com",
        "action_count": 350
      }
    ],
    "critical_actions": [
      {
        "audit_id": "audit-uuid",
        "action_type": "DELETE",
        "entity_type": "user",
        "entity_id": "deleted-user-uuid",
        "full_name": "Admin User",
        "created_at": "2024-12-15T14:30:00Z"
      }
    ]
  }
}
```

---

### 3. Get User Activity Timeline

**Endpoint:** `GET /api/v1/audit/user/:user_id`

**Authentication:** Required (JWT Token)

**Authorization:** Admin, Security

**Description:** Get complete activity timeline for a specific user

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string (UUID) | Yes | ID of the user |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from_date | string | No | Start date |
| to_date | string | No | End date |
| limit | number | No | Max records (default: 100) |

**Request Example:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/audit/user/user-uuid-here?limit=50" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "user-uuid",
      "full_name": "Ahmed Khan",
      "email": "ahmed@example.com",
      "role": "employee"
    },
    "activity": [
      {
        "audit_id": "audit-uuid",
        "action_type": "LOGIN",
        "entity_type": "user",
        "entity_id": "user-uuid",
        "old_values": null,
        "new_values": null,
        "ip_address": "192.168.1.50",
        "created_at": "2024-12-16T09:00:00Z"
      },
      {
        "audit_id": "audit-uuid-2",
        "action_type": "UPDATE",
        "entity_type": "leave",
        "entity_id": "leave-uuid",
        "old_values": { "status": "pending" },
        "new_values": { "status": "approved" },
        "ip_address": "192.168.1.50",
        "created_at": "2024-12-16T10:30:00Z"
      }
    ],
    "total_actions": 45
  }
}
```

---

### 4. Export Audit Logs (CSV)

**Endpoint:** `GET /api/v1/audit/export`

**Authentication:** Required (JWT Token)

**Authorization:** Admin only

**Description:** Export audit logs to CSV format (max 10,000 records)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from_date | string | No | Start date |
| to_date | string | No | End date |
| action_type | string | No | Filter by action type |
| entity_type | string | No | Filter by entity type |

**Request Example:**
```bash
curl -X GET "https://sac.saksolution.com/api/v1/audit/export?from_date=2024-12-01&to_date=2024-12-16" \
  -H "Authorization: Bearer <jwt_token>" \
  -o audit_logs.csv
```

**CSV Format:**
```csv
Audit ID,User ID,User Name,User Email,Action Type,Entity Type,Entity ID,IP Address,User Agent,Timestamp
123e4567...,user-uuid,Ahmed Khan,ahmed@example.com,DELETE,visitor,visitor-uuid,192.168.1.100,"Mozilla/5.0...",2024-12-16T10:30:00Z
```

---

## Automatic Audit Logging

The system automatically logs the following events:

### Authentication Events
- **LOGIN**: User logs into the system
- **LOGOUT**: User logs out
- IP address and user agent captured

### Access Control Events
- **ACCESS_GRANTED**: Door access granted via NFC card
- **ACCESS_DENIED**: Door access denied (invalid card, expired access, etc.)
- Includes door ID and denial reason

### Data Modification Events
- **CREATE**: New record created (user, visitor, meeting, leave, etc.)
- **UPDATE**: Record updated with old and new values
- **DELETE**: Record deleted with final state captured

### Security Events
- **SECURITY_VIOLATION**: Multiple failed login attempts, unauthorized access attempts
- Includes violation type and details

### Data Operations
- **EXPORT**: Data exported to CSV (attendance, access logs, etc.)
- **IMPORT**: Bulk data imported (holidays, users, etc.)

---

## Audit Service Integration

### Usage in Controllers

```typescript
import auditService from '../services/audit.service';

// Log user login
await auditService.logLogin(
  userId,
  req.ip,
  req.get('user-agent')
);

// Log entity creation
await auditService.logCreate(
  req.user!.id,
  'visitor',
  visitor.id,
  visitor,
  req.ip,
  req.get('user-agent')
);

// Log entity update
await auditService.logUpdate(
  req.user!.id,
  'leave',
  leaveId,
  oldLeaveData,
  newLeaveData,
  req.ip,
  req.get('user-agent')
);

// Log entity deletion
await auditService.logDelete(
  req.user!.id,
  'user',
  userId,
  userData,
  req.ip,
  req.get('user-agent')
);

// Log access attempt
await auditService.logAccessAttempt(
  userId,
  granted,
  doorId,
  req.ip,
  req.get('user-agent')
);

// Log security violation
await auditService.logSecurityViolation(
  userId,
  'MULTIPLE_FAILED_LOGINS',
  { attempts: 5, timeframe: '5 minutes' },
  req.ip,
  req.get('user-agent')
);

// Log data export
await auditService.logExport(
  req.user!.id,
  'attendance_records',
  { from_date, to_date },
  req.ip,
  req.get('user-agent')
);
```

---

## Database Schema

### audit_logs Table

```sql
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
    'ACCESS_GRANTED', 'ACCESS_DENIED', 'SECURITY_VIOLATION',
    'EXPORT', 'IMPORT'
  )),
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NULL,
  old_values JSONB NULL,
  new_values JSONB NULL,
  ip_address VARCHAR(255) NULL,
  user_agent TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_action_created ON audit_logs(action_type, created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

---

## Data Retention

### Cleanup Old Logs

The audit service includes a cleanup method to maintain database performance:

```typescript
// Keep logs for 90 days
const deletedCount = await auditService.cleanup(90);
```

### Recommended Cron Job

```bash
# Cleanup audit logs older than 90 days (run monthly)
0 2 1 * * /usr/bin/node /path/to/cleanup-script.js
```

**Cleanup Script Example:**
```javascript
const auditService = require('./services/audit.service');

(async () => {
  try {
    const deleted = await auditService.cleanup(90);
    console.log(`Cleaned up ${deleted} old audit logs`);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
})();
```

---

## Security Considerations

1. **Immutable Logs**: Audit logs cannot be edited or deleted by users
2. **User Anonymization**: When a user is deleted, audit logs preserve their ID but user reference is set to NULL
3. **IP Tracking**: All actions record the originating IP address
4. **User Agent**: Browser/device information captured for forensics
5. **Sensitive Data**: Passwords and sensitive fields excluded from old_values/new_values
6. **Access Control**: Only admins and security personnel can view audit logs
7. **Data Retention**: Configurable retention period (default 90 days)

---

## API Integration Examples

### JavaScript/React
```javascript
// Get audit logs
const getAuditLogs = async (filters) => {
  const queryParams = new URLSearchParams(filters).toString();
  const response = await fetch(
    `${API_URL}/audit?${queryParams}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};

// Get user activity
const getUserActivity = async (userId) => {
  const response = await fetch(
    `${API_URL}/audit/user/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};

// Export audit logs
const exportAuditLogs = async (filters) => {
  const queryParams = new URLSearchParams(filters).toString();
  const response = await fetch(
    `${API_URL}/audit/export?${queryParams}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  const blob = await response.blob();
  
  // Download file
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit_logs.csv';
  a.click();
};
```

### Python
```python
import requests

def get_audit_logs(token, filters=None):
    url = f"{API_URL}/audit"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers, params=filters)
    return response.json()

def get_audit_statistics(token, from_date=None, to_date=None):
    url = f"{API_URL}/audit/statistics"
    headers = {"Authorization": f"Bearer {token}"}
    params = {}
    if from_date:
        params['from_date'] = from_date
    if to_date:
        params['to_date'] = to_date
    response = requests.get(url, headers=headers, params=params)
    return response.json()
```

---

## Deployment Status

✅ **Backend:** Deployed (PM2 restart #70, PID 116352)
✅ **Database:** audit_logs table created
✅ **Endpoints:** 4 audit endpoints live
✅ **Auto-logging:** Login events integrated
✅ **Service:** audit.service.ts ready for integration

---

## Next Steps

1. ✅ Audit system deployed
2. ⏳ Integrate audit logging into all CRUD operations
3. ⏳ Add audit log viewer in admin dashboard
4. ⏳ Setup automated cleanup cron job
5. ⏳ Add audit log analytics and reporting
