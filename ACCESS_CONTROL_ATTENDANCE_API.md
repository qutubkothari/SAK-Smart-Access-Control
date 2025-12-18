# Access Control & Attendance System API Documentation

## Table of Contents
1. [Visitor NFC Card Management](#visitor-nfc-card-management)
2. [Attendance System](#attendance-system)
3. [Setup Instructions](#setup-instructions)

---

## Visitor NFC Card Management

### 1. Issue Visitor Card
**Endpoint:** `POST /api/v1/visitor-cards/issue`

**Authorization:** Admin, Receptionist

**Description:** Issue an NFC card to a visitor. The system automatically determines allowed floors based on the meeting's department. Card validity is set to meeting end time + 1 hour.

**Request Body:**
```json
{
  "visitor_id": "string",
  "card_number": "string",
  "meeting_id": "string (optional)",
  "allowed_floors": [1, 2, 3] // Optional - auto-determined from meeting if not provided
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "visitor_id": "string",
    "card_number": "string",
    "meeting_id": "string",
    "allowed_floors": [1, 2],
    "valid_from": "2025-12-16T10:00:00Z",
    "valid_until": "2025-12-16T18:00:00Z",
    "is_active": true,
    "issued_by": "user_id",
    "issued_at": "2025-12-16T10:00:00Z"
  }
}
```

---

### 2. Validate Visitor Card
**Endpoint:** `POST /api/v1/visitor-cards/validate`

**Authorization:** Public (for scanner devices)

**Description:** Validate if a visitor card has access to a specific floor. Checks card status, validity time window, and floor permissions.

**Request Body:**
```json
{
  "card_number": "string",
  "floor_number": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_granted": true,
    "visitor": {
      "name": "John Doe",
      "company": "ABC Corp",
      "purpose": "Meeting"
    },
    "meeting": {
      "title": "Project Discussion",
      "department": "IT"
    },
    "card": {
      "card_number": "NFC001",
      "valid_until": "2025-12-16T18:00:00Z",
      "allowed_floors": [1, 2]
    },
    "denial_reason": null
  }
}
```

**Denial Reasons:**
- `CARD_NOT_FOUND` - Card number doesn't exist
- `CARD_INACTIVE` - Card has been deactivated
- `EXPIRED` - Current time outside valid_from/valid_until window
- `FLOOR_NOT_ALLOWED` - Requested floor not in allowed_floors array

---

### 3. Log Visitor Card Access
**Endpoint:** `POST /api/v1/visitor-cards/log`

**Authorization:** Public (for scanner devices)

**Description:** Log a visitor's elevator/floor access attempt. Records both successful and denied access.

**Request Body:**
```json
{
  "card_number": "string",
  "floor_number": 2,
  "access_point_id": "string",
  "scan_method": "NFC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "visitor_id": "string",
    "card_id": "string",
    "floor_number": 2,
    "access_point_id": "string",
    "access_time": "2025-12-16T10:30:00Z",
    "scan_method": "NFC",
    "access_granted": true,
    "denial_reason": null
  }
}
```

---

### 4. Deactivate Visitor Card
**Endpoint:** `POST /api/v1/visitor-cards/deactivate`

**Authorization:** Admin, Receptionist

**Description:** Deactivate a visitor's card when they check out. Card will no longer grant access.

**Request Body:**
```json
{
  "card_number": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Card deactivated successfully"
}
```

---

### 5. Get Visitor Card Details
**Endpoint:** `GET /api/v1/visitor-cards/:card_number`

**Authorization:** Authenticated users

**Description:** Retrieve details of a specific visitor card including visitor and meeting information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "card_number": "NFC001",
    "visitor": {
      "id": "string",
      "name": "John Doe",
      "company": "ABC Corp"
    },
    "meeting": {
      "id": "string",
      "title": "Project Discussion"
    },
    "allowed_floors": [1, 2],
    "valid_from": "2025-12-16T10:00:00Z",
    "valid_until": "2025-12-16T18:00:00Z",
    "is_active": true,
    "issued_at": "2025-12-16T10:00:00Z"
  }
}
```

---

### 6. Get All Visitor Card Access Logs
**Endpoint:** `GET /api/v1/visitor-cards/logs/all`

**Authorization:** Admin, Security, Receptionist

**Description:** Retrieve all visitor card access logs with filtering and pagination.

**Query Parameters:**
- `card_number` (optional) - Filter by specific card
- `visitor_id` (optional) - Filter by visitor
- `from_date` (optional) - Start date (YYYY-MM-DD)
- `to_date` (optional) - End date (YYYY-MM-DD)
- `access_granted` (optional) - Filter by access result (true/false)
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "visitor_name": "John Doe",
      "card_number": "NFC001",
      "floor_number": 2,
      "access_time": "2025-12-16T10:30:00Z",
      "access_granted": true,
      "denial_reason": null,
      "scan_method": "NFC"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "total_pages": 2
  }
}
```

---

## Attendance System

### 1. Calculate Attendance
**Endpoint:** `POST /api/v1/attendance/calculate`

**Authorization:** Admin only

**Description:** Calculate attendance for employees based on their access logs. Automatically determines status (present/late/absent/overtime), calculates work hours, and applies grace periods. Can be run manually or as a cron job.

**Query Parameters:**
- `date` (optional) - Date to calculate (YYYY-MM-DD). Defaults to today.
- `employee_id` (optional) - Calculate for specific employee. Omit to process all employees.

**Request:**
```
POST /api/v1/attendance/calculate?date=2025-12-15
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance calculated for 45 employees",
  "data": [
    {
      "employee_id": "user_001",
      "status": "processed"
    },
    {
      "employee_id": "user_002",
      "status": "late"
    }
  ],
  "date": "2025-12-15"
}
```

**Attendance Status Values:**
- `present` - On time, worked full shift
- `late` - Checked in after grace period
- `early_exit` - Left before shift end time
- `half_day` - Worked less than 4 hours
- `absent` - No access logs found
- `leave` - On approved leave
- `weekend` - Weekend day (no expectation)
- `holiday` - Company/department holiday
- `overtime` - Worked beyond shift hours or on weekend/holiday

**Attendance Calculation Logic:**
1. Get employee's assigned shift for the date
2. Check if date is weekend (based on department config) or holiday
3. Fetch all access logs for the day (entry/exit records)
4. Calculate first check-in and last check-out times
5. Compare against shift start time + grace period (15 min default)
6. Determine if late: `check_in > (shift_start + grace_period)`
7. Calculate work hours: `total_time - break_duration`
8. Calculate overtime: `work_time - shift_duration` if positive
9. Determine final status based on timing and hours worked

---

### 2. Get Attendance Records
**Endpoint:** `GET /api/v1/attendance/records`

**Authorization:** Admin, Security, Receptionist

**Description:** Retrieve attendance records with filtering and pagination.

**Query Parameters:**
- `employee_id` (optional) - Filter by employee
- `department_id` (optional) - Filter by department
- `from_date` (optional) - Start date (YYYY-MM-DD)
- `to_date` (optional) - End date (YYYY-MM-DD)
- `status` (optional) - Filter by status (present, late, absent, etc.)
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "employee_id": "string",
      "employee_name": "Ahmed Ali",
      "its_id": "ITS200001",
      "department_name": "IT",
      "shift_name": "General (9-6)",
      "date": "2025-12-15",
      "first_check_in": "2025-12-15T09:05:00Z",
      "last_check_out": "2025-12-15T18:10:00Z",
      "total_hours": "9.08",
      "work_hours": "8.08",
      "break_hours": "1.00",
      "status": "present",
      "expected_check_in": "09:00:00",
      "expected_check_out": "18:00:00",
      "is_late": false,
      "late_by_minutes": null,
      "is_early_exit": false,
      "early_exit_by_minutes": null,
      "overtime_minutes": 10
    }
  ],
  "meta": {
    "total": 500,
    "page": 1,
    "limit": 50,
    "total_pages": 10
  }
}
```

---

### 3. Get Employee Attendance Summary
**Endpoint:** `GET /api/v1/attendance/employee/:employee_id/summary`

**Authorization:** Authenticated users (employees can view their own)

**Description:** Get monthly attendance summary for a specific employee with breakdown by status.

**Query Parameters:**
- `month` (optional) - Month number (1-12). Defaults to current month.
- `year` (optional) - Year (YYYY). Defaults to current year.

**Response:**
```json
{
  "success": true,
  "data": {
    "employee_id": "user_001",
    "month": 12,
    "year": 2025,
    "summary": {
      "total_days": 22,
      "present": 18,
      "absent": 1,
      "late": 2,
      "half_day": 0,
      "early_exit": 1,
      "leave": 2,
      "weekend": 4,
      "holiday": 1,
      "overtime": 3,
      "total_work_hours": "162.50",
      "total_overtime_minutes": 180
    },
    "records": [
      {
        "date": "2025-12-15",
        "status": "present",
        "work_hours": "8.25",
        "first_check_in": "2025-12-15T09:00:00Z",
        "last_check_out": "2025-12-15T18:15:00Z"
      }
    ]
  }
}
```

---

### 4. Get Department Attendance Summary
**Endpoint:** `GET /api/v1/attendance/department/:department_id/summary`

**Authorization:** Admin, Security

**Description:** Get daily attendance summary for all employees in a department.

**Query Parameters:**
- `date` (optional) - Date to check (YYYY-MM-DD). Defaults to today.

**Response:**
```json
{
  "success": true,
  "data": {
    "department_id": "dept_001",
    "summary": {
      "date": "2025-12-16",
      "total_employees": 25,
      "present": 22,
      "absent": 1,
      "late": 3,
      "on_leave": 2
    },
    "records": [
      {
        "employee_id": "user_001",
        "employee_name": "Ahmed Ali",
        "its_id": "ITS200001",
        "status": "present",
        "first_check_in": "2025-12-16T09:00:00Z",
        "last_check_out": "2025-12-16T18:00:00Z"
      }
    ]
  }
}
```

---

## Setup Instructions

### 1. Cron Job for Auto-Attendance Calculation

The attendance calculation should run automatically every day at 1 AM to process the previous day's data.

**Setup Steps:**

1. Upload the cron script to the server:
```bash
scp -i sak-smart-access.pem scripts/calculate-attendance.sh ubuntu@3.108.52.219:~/SAK-Smart-Access-Control/scripts/
```

2. Make the script executable:
```bash
ssh ubuntu@3.108.52.219
chmod +x ~/SAK-Smart-Access-Control/scripts/calculate-attendance.sh
```

3. Add admin JWT token to environment:
```bash
# Login as admin user via API and copy JWT token
# Add to backend .env file
echo "ADMIN_JWT_TOKEN=your_admin_jwt_token" >> ~/SAK-Smart-Access-Control/backend/.env
```

4. Add to crontab:
```bash
crontab -e

# Add this line (runs daily at 1 AM):
0 1 * * * /home/ubuntu/SAK-Smart-Access-Control/scripts/calculate-attendance.sh
```

5. View logs:
```bash
tail -f ~/SAK-Smart-Access-Control/logs/attendance-cron.log
```

---

### 2. Testing Visitor Card System

**Test Flow:**

1. **Issue Card to Visitor:**
```bash
curl -X POST https://sac.saksolution.com/api/v1/visitor-cards/issue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitor_id": "visitor_001",
    "card_number": "NFC001",
    "meeting_id": "meeting_001"
  }'
```

2. **Scan Card at Elevator (Floor 2):**
```bash
curl -X POST https://sac.saksolution.com/api/v1/visitor-cards/validate \
  -H "Content-Type: application/json" \
  -d '{
    "card_number": "NFC001",
    "floor_number": 2
  }'
```

3. **Log the Access:**
```bash
curl -X POST https://sac.saksolution.com/api/v1/visitor-cards/log \
  -H "Content-Type: application/json" \
  -d '{
    "card_number": "NFC001",
    "floor_number": 2,
    "access_point_id": "FLOOR_2_LIFT",
    "scan_method": "NFC"
  }'
```

4. **Deactivate Card on Checkout:**
```bash
curl -X POST https://sac.saksolution.com/api/v1/visitor-cards/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "card_number": "NFC001"
  }'
```

---

### 3. Testing Attendance System

**Manual Attendance Calculation:**
```bash
# Calculate for today
curl -X POST https://sac.saksolution.com/api/v1/attendance/calculate \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Calculate for specific date
curl -X POST https://sac.saksolution.com/api/v1/attendance/calculate?date=2025-12-15 \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Calculate for specific employee
curl -X POST https://sac.saksolution.com/api/v1/attendance/calculate?employee_id=user_001 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**View Attendance Records:**
```bash
# Get all records
curl https://sac.saksolution.com/api/v1/attendance/records \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by date range
curl "https://sac.saksolution.com/api/v1/attendance/records?from_date=2025-12-01&to_date=2025-12-15" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by employee
curl "https://sac.saksolution.com/api/v1/attendance/records?employee_id=user_001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Employee Summary:**
```bash
curl https://sac.saksolution.com/api/v1/attendance/employee/user_001/summary?month=12&year=2025 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Department Summary:**
```bash
curl https://sac.saksolution.com/api/v1/attendance/department/dept_001/summary?date=2025-12-16 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Database Tables

### visitor_access_cards
- Stores NFC card assignments to visitors
- Auto-determines allowed floors from meeting department
- Validity period: meeting end + 1 hour

### visitor_floor_access_logs
- Records all elevator/floor access attempts
- Includes both granted and denied access
- Tracks scan method (NFC/QR/ITS)

### attendance_records
- Daily attendance summary per employee
- Calculated from employee_access_logs
- Includes work hours, status, late/overtime tracking

### employee_shifts
- Links employees to attendance shifts
- Supports date ranges (effective_from/effective_until)

### attendance_shifts
- Defines shift timings (start_time, end_time)
- Grace period for late arrivals (default 15 min)
- Break duration (default 60 min)

---

## Integration Notes

### Mobile NFC Reader Integration
The visitor card validation and logging endpoints are public (no authentication) to support direct API calls from mobile NFC readers. The device should:

1. Read NFC card number
2. Call `/api/v1/visitor-cards/validate` with card_number and floor_number
3. Display access granted/denied on device screen
4. Call `/api/v1/visitor-cards/log` to record the attempt
5. If access granted, trigger elevator button or door unlock

### Attendance Cron Job
The attendance calculation runs daily at 1 AM via cron. It:
- Processes all employees for previous day
- Queries access logs to find first check-in and last check-out
- Compares against employee's shift times
- Applies grace period for late arrivals (15 min default)
- Calculates work hours (total time - break duration)
- Determines status (present/late/absent/overtime)
- Checks for weekends/holidays/approved leaves
- Inserts/updates attendance_records table

---

## API Endpoints Summary

### Visitor Cards
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/visitor-cards/issue` | Admin/Receptionist | Issue NFC card |
| POST | `/api/v1/visitor-cards/validate` | Public | Validate card access |
| POST | `/api/v1/visitor-cards/log` | Public | Log access attempt |
| POST | `/api/v1/visitor-cards/deactivate` | Admin/Receptionist | Deactivate card |
| GET | `/api/v1/visitor-cards/:card_number` | Authenticated | Get card details |
| GET | `/api/v1/visitor-cards/logs/all` | Admin/Security/Receptionist | Get all logs |

### Attendance
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/attendance/calculate` | Admin | Calculate attendance |
| GET | `/api/v1/attendance/records` | Admin/Security/Receptionist | Get records |
| GET | `/api/v1/attendance/employee/:id/summary` | Authenticated | Employee summary |
| GET | `/api/v1/attendance/department/:id/summary` | Admin/Security | Department summary |
