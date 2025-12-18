# Leave & Holiday Management API Documentation

## Leave Management System

### 1. Apply for Leave
**Endpoint:** `POST /api/v1/leaves/apply`

**Authorization:** All authenticated employees

**Description:** Employees can apply for different types of leave. The system calculates leave days automatically and notifies the department head for approval.

**Request Body:**
```json
{
  "leave_type": "annual",
  "from_date": "2025-12-20",
  "to_date": "2025-12-25",
  "reason": "Family vacation",
  "half_day": false,
  "half_day_period": null
}
```

**Leave Types:**
- `annual` - Annual paid leave
- `sick` - Sick leave
- `casual` - Casual leave
- `emergency` - Emergency leave
- `unpaid` - Unpaid leave

**Half Day Parameters:**
- `half_day`: `true` or `false`
- `half_day_period`: `"first_half"` or `"second_half"` (when half_day is true)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "leave_001",
    "employee_id": "user_001",
    "leave_type": "annual",
    "from_date": "2025-12-20",
    "to_date": "2025-12-25",
    "number_of_days": 6,
    "reason": "Family vacation",
    "half_day": false,
    "half_day_period": null,
    "status": "pending",
    "applied_at": "2025-12-16T10:00:00Z"
  },
  "message": "Leave application submitted successfully"
}
```

---

### 2. Get Leave Applications
**Endpoint:** `GET /api/v1/leaves/applications`

**Authorization:** All authenticated users

**Description:** Get leave applications. Employees see their own leaves, admin/security see all.

**Query Parameters:**
- `employee_id` (optional) - Filter by employee
- `department_id` (optional) - Filter by department
- `status` (optional) - Filter by status (pending/approved/rejected/cancelled)
- `from_date` (optional) - Start date filter (YYYY-MM-DD)
- `to_date` (optional) - End date filter (YYYY-MM-DD)
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "leave_001",
      "employee_id": "user_001",
      "employee_name": "Ahmed Ali",
      "its_id": "ITS200001",
      "department_name": "IT",
      "leave_type": "annual",
      "from_date": "2025-12-20",
      "to_date": "2025-12-25",
      "number_of_days": 6,
      "reason": "Family vacation",
      "status": "pending",
      "applied_at": "2025-12-16T10:00:00Z",
      "reviewed_by": null,
      "reviewed_at": null,
      "rejection_reason": null
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 50,
    "total_pages": 1
  }
}
```

---

### 3. Approve/Reject Leave
**Endpoint:** `PUT /api/v1/leaves/applications/:leave_id/status`

**Authorization:** Admin only (can be extended to department heads)

**Description:** Approve or reject a pending leave application. Employee gets real-time notification via Socket.IO.

**Request Body:**
```json
{
  "status": "approved",
  "rejection_reason": null
}
```

OR

```json
{
  "status": "rejected",
  "rejection_reason": "Department is understaffed during this period"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Leave approved successfully",
  "data": {
    "leave_id": "leave_001",
    "status": "approved",
    "reviewed_by": "admin_001",
    "reviewed_at": "2025-12-16T11:00:00Z"
  }
}
```

**Socket.IO Event:** `leave_status_update`
```json
{
  "type": "leave_status_update",
  "leave_id": "leave_001",
  "status": "approved",
  "rejection_reason": null,
  "from_date": "2025-12-20",
  "to_date": "2025-12-25",
  "leave_type": "annual"
}
```

---

### 4. Cancel Leave Application
**Endpoint:** `DELETE /api/v1/leaves/applications/:leave_id/cancel`

**Authorization:** Employee (own leaves only)

**Description:** Employee can cancel their own pending leave application.

**Response:**
```json
{
  "success": true,
  "message": "Leave cancelled successfully"
}
```

---

### 5. Get Leave Balance
**Endpoint:** `GET /api/v1/leaves/balance/:employee_id?`

**Authorization:** All authenticated users

**Description:** Get leave balance for an employee. If employee_id not provided, returns balance for current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "employee_id": "user_001",
    "employee_name": "Ahmed Ali",
    "its_id": "ITS200001",
    "year": 2025,
    "balance": {
      "annual": {
        "allocated": 20,
        "used": 6,
        "remaining": 14
      },
      "sick": {
        "allocated": 15,
        "used": 2,
        "remaining": 13
      },
      "casual": {
        "allocated": 10,
        "used": 3,
        "remaining": 7
      },
      "emergency": {
        "allocated": 5,
        "used": 0,
        "remaining": 5
      },
      "unpaid": {
        "used": 0
      }
    }
  }
}
```

**Default Leave Allocations:**
- Annual: 20 days
- Sick: 15 days
- Casual: 10 days
- Emergency: 5 days
- Unpaid: Unlimited (tracked but not limited)

---

### 6. Get Leave Statistics
**Endpoint:** `GET /api/v1/leaves/statistics`

**Authorization:** Admin, Security

**Description:** Get aggregated leave statistics for department or company-wide.

**Query Parameters:**
- `department_id` (optional) - Filter by department (omit for company-wide)
- `year` (optional) - Year filter (defaults to current year)

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "department_id": "all",
    "statistics": {
      "total_applications": 125,
      "total_days": 450,
      "by_type": {
        "annual": {
          "count": 60,
          "days": 250
        },
        "sick": {
          "count": 30,
          "days": 100
        },
        "casual": {
          "count": 25,
          "days": 75
        },
        "emergency": {
          "count": 10,
          "days": 25
        }
      }
    }
  }
}
```

---

## Holiday Management System

### 1. Create Holiday
**Endpoint:** `POST /api/v1/holidays`

**Authorization:** Admin only

**Description:** Create a company-wide or department-specific holiday.

**Request Body:**
```json
{
  "name": "Eid ul Fitr",
  "date": "2025-04-10",
  "description": "Islamic festival",
  "applicable_to_department": null,
  "is_optional": false
}
```

OR for department-specific:
```json
{
  "name": "Department Day",
  "date": "2025-05-15",
  "description": "IT Department celebration",
  "applicable_to_department": "dept_001",
  "is_optional": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "holiday_001",
    "name": "Eid ul Fitr",
    "date": "2025-04-10",
    "description": "Islamic festival",
    "applicable_to_department": null,
    "is_optional": false,
    "is_active": true,
    "created_by": "admin_001"
  },
  "message": "Holiday created successfully"
}
```

**Socket.IO Broadcast:** `holiday_added`
```json
{
  "type": "holiday_added",
  "holiday": {
    "id": "holiday_001",
    "name": "Eid ul Fitr",
    "date": "2025-04-10"
  }
}
```

---

### 2. Get Holidays
**Endpoint:** `GET /api/v1/holidays`

**Authorization:** All authenticated users

**Description:** Get filtered list of holidays.

**Query Parameters:**
- `year` (optional) - Filter by year
- `month` (optional) - Filter by month (1-12, requires year)
- `department_id` (optional) - Filter by department (shows company-wide + department-specific)
- `is_optional` (optional) - Filter optional holidays (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "holiday_001",
      "name": "New Year",
      "date": "2025-01-01",
      "description": "New Year celebration",
      "department_name": null,
      "is_optional": false,
      "is_active": true
    },
    {
      "id": "holiday_002",
      "name": "IT Department Day",
      "date": "2025-05-15",
      "description": "IT celebration",
      "department_name": "IT",
      "is_optional": true,
      "is_active": true
    }
  ],
  "meta": {
    "total": 12
  }
}
```

---

### 3. Get Upcoming Holidays
**Endpoint:** `GET /api/v1/holidays/upcoming`

**Authorization:** All authenticated users

**Description:** Get next upcoming holidays from today.

**Query Parameters:**
- `department_id` (optional) - Filter by department
- `limit` (default: 10) - Number of holidays to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "holiday_003",
      "name": "Eid ul Fitr",
      "date": "2025-04-10",
      "description": "Islamic festival",
      "department_name": null,
      "is_optional": false
    },
    {
      "id": "holiday_004",
      "name": "Independence Day",
      "date": "2025-08-14",
      "description": "National holiday",
      "department_name": null,
      "is_optional": false
    }
  ]
}
```

---

### 4. Get Holiday Calendar
**Endpoint:** `GET /api/v1/holidays/calendar`

**Authorization:** All authenticated users

**Description:** Get holiday calendar grouped by month.

**Query Parameters:**
- `year` (optional) - Year (defaults to current year)

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "total_holidays": 15,
    "calendar": {
      "1": [
        {
          "id": "holiday_001",
          "name": "New Year",
          "date": "2025-01-01",
          "description": "New Year celebration",
          "department_name": "Company-wide",
          "is_optional": false
        }
      ],
      "2": [],
      "3": [
        {
          "id": "holiday_002",
          "name": "Pakistan Day",
          "date": "2025-03-23",
          "description": "National holiday",
          "department_name": "Company-wide",
          "is_optional": false
        }
      ],
      "4": [
        {
          "id": "holiday_003",
          "name": "Eid ul Fitr",
          "date": "2025-04-10",
          "description": "Islamic festival",
          "department_name": "Company-wide",
          "is_optional": false
        }
      ]
    }
  }
}
```

---

### 5. Update Holiday
**Endpoint:** `PUT /api/v1/holidays/:holiday_id`

**Authorization:** Admin only

**Description:** Update holiday details.

**Request Body:**
```json
{
  "name": "Eid ul Fitr (Updated)",
  "date": "2025-04-11",
  "description": "Islamic festival - date adjusted",
  "is_optional": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "holiday_003",
    "name": "Eid ul Fitr (Updated)",
    "date": "2025-04-11",
    "description": "Islamic festival - date adjusted",
    "applicable_to_department": null,
    "is_optional": false,
    "is_active": true
  },
  "message": "Holiday updated successfully"
}
```

---

### 6. Delete Holiday
**Endpoint:** `DELETE /api/v1/holidays/:holiday_id`

**Authorization:** Admin only

**Description:** Soft delete a holiday (sets is_active to false).

**Response:**
```json
{
  "success": true,
  "message": "Holiday deleted successfully"
}
```

---

### 7. Bulk Import Holidays
**Endpoint:** `POST /api/v1/holidays/bulk-import`

**Authorization:** Admin only

**Description:** Import multiple holidays at once. Useful for annual holiday setup.

**Request Body:**
```json
{
  "holidays": [
    {
      "name": "New Year",
      "date": "2025-01-01",
      "description": "New Year celebration",
      "applicable_to_department": null,
      "is_optional": false
    },
    {
      "name": "Pakistan Day",
      "date": "2025-03-23",
      "description": "National holiday",
      "applicable_to_department": null,
      "is_optional": false
    },
    {
      "name": "Labour Day",
      "date": "2025-05-01",
      "description": "International Workers Day",
      "applicable_to_department": null,
      "is_optional": false
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "holiday_001",
      "name": "New Year",
      "date": "2025-01-01"
    },
    {
      "id": "holiday_002",
      "name": "Pakistan Day",
      "date": "2025-03-23"
    },
    {
      "id": "holiday_003",
      "name": "Labour Day",
      "date": "2025-05-01"
    }
  ],
  "message": "3 holidays imported successfully"
}
```

---

## Integration with Attendance System

### Leave Impact on Attendance

When the attendance calculation cron job runs (`POST /api/v1/attendance/calculate`), it checks for approved leaves:

1. **Leave Detection:** Checks `employee_leaves` table for approved leaves on the target date
2. **Status Override:** If employee is on leave, attendance status is set to `'leave'` regardless of access logs
3. **No Penalty:** Leave days don't count as absent or late
4. **Balance Deduction:** Leave days are deducted from the employee's annual balance

### Holiday Impact on Attendance

1. **Holiday Detection:** Checks `holidays` table for company-wide or department-specific holidays
2. **Status Override:** If it's a holiday, attendance status is set to `'holiday'`
3. **Overtime on Holidays:** If employee has access logs on a holiday, status becomes `'overtime'` and they get overtime credit
4. **Weekend Priority:** Weekends are checked first (configured per department), then holidays

### Calculation Priority

```
1. Check if weekend (from department_shift_config.weekend_days)
   → If weekend + no access logs → status: 'weekend'
   → If weekend + access logs → status: 'overtime'

2. Check if holiday (from holidays table)
   → If holiday + no access logs → status: 'holiday'
   → If holiday + access logs → status: 'overtime'

3. Check if on approved leave (from employee_leaves)
   → status: 'leave'

4. Check access logs
   → No logs → status: 'absent'
   → Has logs → Calculate: present/late/early_exit/half_day/overtime
```

---

## Usage Examples

### Employee Leave Workflow

**Step 1: Check Leave Balance**
```bash
curl https://sac.saksolution.com/api/v1/leaves/balance \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

**Step 2: Apply for Leave**
```bash
curl -X POST https://sac.saksolution.com/api/v1/leaves/apply \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type": "annual",
    "from_date": "2025-12-20",
    "to_date": "2025-12-25",
    "reason": "Family vacation"
  }'
```

**Step 3: Check Application Status**
```bash
curl https://sac.saksolution.com/api/v1/leaves/applications \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

**Step 4: Cancel if Needed (before approval)**
```bash
curl -X DELETE https://sac.saksolution.com/api/v1/leaves/applications/leave_001/cancel \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

---

### Admin Leave Management

**View All Pending Leaves**
```bash
curl "https://sac.saksolution.com/api/v1/leaves/applications?status=pending" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Approve Leave**
```bash
curl -X PUT https://sac.saksolution.com/api/v1/leaves/applications/leave_001/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

**Reject Leave**
```bash
curl -X PUT https://sac.saksolution.com/api/v1/leaves/applications/leave_001/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "rejection_reason": "Department understaffed"
  }'
```

**View Department Statistics**
```bash
curl "https://sac.saksolution.com/api/v1/leaves/statistics?department_id=dept_001&year=2025" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### Admin Holiday Management

**Create Holiday**
```bash
curl -X POST https://sac.saksolution.com/api/v1/holidays \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Eid ul Fitr",
    "date": "2025-04-10",
    "description": "Islamic festival",
    "is_optional": false
  }'
```

**Bulk Import Annual Holidays**
```bash
curl -X POST https://sac.saksolution.com/api/v1/holidays/bulk-import \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "holidays": [
      {"name": "New Year", "date": "2025-01-01", "is_optional": false},
      {"name": "Pakistan Day", "date": "2025-03-23", "is_optional": false},
      {"name": "Labour Day", "date": "2025-05-01", "is_optional": false},
      {"name": "Independence Day", "date": "2025-08-14", "is_optional": false},
      {"name": "Eid ul Fitr", "date": "2025-04-10", "is_optional": false},
      {"name": "Eid ul Adha", "date": "2025-06-17", "is_optional": false},
      {"name": "Iqbal Day", "date": "2025-11-09", "is_optional": false},
      {"name": "Quaid Day", "date": "2025-12-25", "is_optional": false}
    ]
  }'
```

**View Holiday Calendar**
```bash
curl "https://sac.saksolution.com/api/v1/holidays/calendar?year=2025" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Socket.IO Events

### Leave Application Notification
**Event:** `leave_application`

**Sent to:** Department Head

**Payload:**
```json
{
  "type": "leave_application",
  "employee_name": "Ahmed Ali",
  "employee_its_id": "ITS200001",
  "leave_type": "annual",
  "from_date": "2025-12-20",
  "to_date": "2025-12-25",
  "days": 6,
  "leave_id": "leave_001"
}
```

### Leave Status Update
**Event:** `leave_status_update`

**Sent to:** Employee

**Payload:**
```json
{
  "type": "leave_status_update",
  "leave_id": "leave_001",
  "status": "approved",
  "rejection_reason": null,
  "from_date": "2025-12-20",
  "to_date": "2025-12-25",
  "leave_type": "annual"
}
```

### Holiday Added
**Event:** `holiday_added`

**Broadcast to:** All users

**Payload:**
```json
{
  "type": "holiday_added",
  "holiday": {
    "id": "holiday_001",
    "name": "Eid ul Fitr",
    "date": "2025-04-10",
    "is_optional": false
  }
}
```

---

## API Endpoints Summary

### Leave Management
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/leaves/apply` | All employees | Apply for leave |
| GET | `/api/v1/leaves/applications` | Authenticated | Get leave applications |
| PUT | `/api/v1/leaves/applications/:id/status` | Admin | Approve/reject leave |
| DELETE | `/api/v1/leaves/applications/:id/cancel` | Employee | Cancel own leave |
| GET | `/api/v1/leaves/balance/:employee_id?` | Authenticated | Get leave balance |
| GET | `/api/v1/leaves/statistics` | Admin/Security | Leave statistics |

### Holiday Management
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/holidays` | Admin | Create holiday |
| GET | `/api/v1/holidays` | Authenticated | Get holidays |
| GET | `/api/v1/holidays/upcoming` | Authenticated | Get upcoming holidays |
| GET | `/api/v1/holidays/calendar` | Authenticated | Get holiday calendar |
| PUT | `/api/v1/holidays/:id` | Admin | Update holiday |
| DELETE | `/api/v1/holidays/:id` | Admin | Delete holiday |
| POST | `/api/v1/holidays/bulk-import` | Admin | Bulk import holidays |
