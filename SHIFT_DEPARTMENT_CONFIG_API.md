# Shift Management & Department Configuration API

## Shift Management System

### 1. Create Shift
**Endpoint:** `POST /api/v1/shifts`

**Authorization:** Admin only

**Description:** Create a new attendance shift with custom timings, grace period, and break duration.

**Request Body:**
```json
{
  "name": "Early Shift (8-5)",
  "start_time": "08:00:00",
  "end_time": "17:00:00",
  "grace_period_minutes": 15,
  "break_duration_minutes": 60,
  "description": "Early shift for production team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shift_001",
    "name": "Early Shift (8-5)",
    "start_time": "08:00:00",
    "end_time": "17:00:00",
    "grace_period_minutes": 15,
    "break_duration_minutes": 60,
    "description": "Early shift for production team",
    "is_active": true
  },
  "message": "Shift created successfully"
}
```

---

### 2. Get All Shifts
**Endpoint:** `GET /api/v1/shifts`

**Authorization:** All authenticated users

**Description:** Get list of all shifts (active and inactive).

**Query Parameters:**
- `is_active` (optional) - Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "shift_001",
      "name": "General (9-6)",
      "start_time": "09:00:00",
      "end_time": "18:00:00",
      "grace_period_minutes": 15,
      "break_duration_minutes": 60,
      "description": "Standard office hours",
      "is_active": true
    },
    {
      "id": "shift_002",
      "name": "Early Shift (8-5)",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "grace_period_minutes": 15,
      "break_duration_minutes": 60,
      "description": "Early shift",
      "is_active": true
    }
  ]
}
```

---

### 3. Update Shift
**Endpoint:** `PUT /api/v1/shifts/:shift_id`

**Authorization:** Admin only

**Description:** Update shift details.

**Request Body:**
```json
{
  "name": "Early Shift (8-5) Updated",
  "start_time": "08:00:00",
  "end_time": "17:00:00",
  "grace_period_minutes": 20,
  "break_duration_minutes": 45,
  "description": "Updated early shift timing",
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shift_002",
    "name": "Early Shift (8-5) Updated",
    "start_time": "08:00:00",
    "end_time": "17:00:00",
    "grace_period_minutes": 20,
    "break_duration_minutes": 45,
    "description": "Updated early shift timing",
    "is_active": true
  },
  "message": "Shift updated successfully"
}
```

---

### 4. Delete Shift
**Endpoint:** `DELETE /api/v1/shifts/:shift_id`

**Authorization:** Admin only

**Description:** Soft delete a shift. Cannot delete if assigned to employees.

**Response (Success):**
```json
{
  "success": true,
  "message": "Shift deleted successfully"
}
```

**Response (If Assigned):**
```json
{
  "success": false,
  "error": {
    "code": "SHIFT_IN_USE",
    "message": "Cannot delete shift. It is assigned to 15 employee(s)"
  }
}
```

---

### 5. Assign Shift to Employee
**Endpoint:** `POST /api/v1/shifts/assign`

**Authorization:** Admin only

**Description:** Assign a shift to an employee. Automatically deactivates previous shift assignment.

**Request Body:**
```json
{
  "employee_id": "user_001",
  "shift_id": "shift_002",
  "effective_from": "2025-12-20",
  "effective_until": null
}
```

**Parameters:**
- `effective_from` (optional) - Start date of shift (defaults to today)
- `effective_until` (optional) - End date of shift (null = permanent)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_shift_001",
    "employee_id": "user_001",
    "shift_id": "shift_002",
    "effective_from": "2025-12-20T00:00:00Z",
    "effective_until": null,
    "is_active": true,
    "assigned_by": "admin_001"
  },
  "message": "Shift assigned successfully"
}
```

---

### 6. Bulk Assign Shift to Department
**Endpoint:** `POST /api/v1/shifts/bulk-assign`

**Authorization:** Admin only

**Description:** Assign a shift to all employees in a department.

**Request Body:**
```json
{
  "department_id": "dept_001",
  "shift_id": "shift_002",
  "effective_from": "2025-12-20"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shift assigned to 25 employee(s)",
  "data": {
    "shift_id": "shift_002",
    "department_id": "dept_001",
    "employees_count": 25
  }
}
```

---

### 7. Get Employee Shift Assignments
**Endpoint:** `GET /api/v1/shifts/employee/:employee_id`

**Authorization:** All authenticated users

**Description:** Get all shift assignments for an employee (current and historical).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "emp_shift_002",
      "employee_id": "user_001",
      "shift_id": "shift_002",
      "shift_name": "Early Shift (8-5)",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "grace_period_minutes": 15,
      "break_duration_minutes": 60,
      "effective_from": "2025-12-20T00:00:00Z",
      "effective_until": null,
      "is_active": true,
      "assigned_by": "admin_001",
      "assigned_by_name": "Admin User"
    },
    {
      "id": "emp_shift_001",
      "employee_id": "user_001",
      "shift_id": "shift_001",
      "shift_name": "General (9-6)",
      "start_time": "09:00:00",
      "end_time": "18:00:00",
      "grace_period_minutes": 15,
      "break_duration_minutes": 60,
      "effective_from": "2025-01-01T00:00:00Z",
      "effective_until": "2025-12-19T00:00:00Z",
      "is_active": false,
      "assigned_by": "admin_001",
      "assigned_by_name": "Admin User"
    }
  ]
}
```

---

### 8. Get Current Shift for Employee
**Endpoint:** `GET /api/v1/shifts/employee/:employee_id/current`

**Authorization:** All authenticated users

**Description:** Get employee's currently active shift.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_shift_002",
    "employee_id": "user_001",
    "shift_id": "shift_002",
    "shift_name": "Early Shift (8-5)",
    "start_time": "08:00:00",
    "end_time": "17:00:00",
    "grace_period_minutes": 15,
    "break_duration_minutes": 60,
    "effective_from": "2025-12-20T00:00:00Z",
    "effective_until": null,
    "is_active": true
  }
}
```

---

## Department Configuration System

### 1. Get Department Configuration
**Endpoint:** `GET /api/v1/department-config/:department_id`

**Authorization:** All authenticated users

**Description:** Get shift and attendance configuration for a department. Auto-creates default config if doesn't exist.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config_001",
    "department_id": "dept_001",
    "default_shift_id": "shift_001",
    "default_shift_name": "General (9-6)",
    "default_shift_start": "09:00:00",
    "default_shift_end": "18:00:00",
    "working_days": [1, 2, 3, 4, 5, 6],
    "weekend_days": [0],
    "require_checkout": true,
    "auto_checkout_after_hours": 12,
    "late_arrival_threshold_minutes": 15,
    "early_departure_threshold_minutes": 15
  }
}
```

**Configuration Fields:**
- `default_shift_id` - Default shift for new employees
- `working_days` - Array of working day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
- `weekend_days` - Array of weekend day numbers
- `require_checkout` - Whether checkout is mandatory
- `auto_checkout_after_hours` - Auto checkout after X hours if no manual checkout
- `late_arrival_threshold_minutes` - Minutes after shift start to mark late
- `early_departure_threshold_minutes` - Minutes before shift end to mark early exit

---

### 2. Update Department Configuration
**Endpoint:** `PUT /api/v1/department-config/:department_id`

**Authorization:** Admin only

**Description:** Update department-specific attendance configuration.

**Request Body:**
```json
{
  "default_shift_id": "shift_002",
  "working_days": [1, 2, 3, 4, 5, 6],
  "weekend_days": [0],
  "require_checkout": true,
  "auto_checkout_after_hours": 10,
  "late_arrival_threshold_minutes": 10,
  "early_departure_threshold_minutes": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config_001",
    "department_id": "dept_001",
    "default_shift_id": "shift_002",
    "working_days": "[1,2,3,4,5,6]",
    "weekend_days": "[0]",
    "require_checkout": true,
    "auto_checkout_after_hours": 10,
    "late_arrival_threshold_minutes": 10,
    "early_departure_threshold_minutes": 10
  },
  "message": "Department configuration updated successfully"
}
```

---

### 3. Get All Department Configurations
**Endpoint:** `GET /api/v1/department-config`

**Authorization:** Admin only

**Description:** Get configurations for all departments.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "config_001",
      "department_id": "dept_001",
      "department_name": "IT",
      "default_shift_id": "shift_001",
      "default_shift_name": "General (9-6)",
      "default_shift_start": "09:00:00",
      "default_shift_end": "18:00:00",
      "working_days": [1, 2, 3, 4, 5, 6],
      "weekend_days": [0],
      "require_checkout": true,
      "auto_checkout_after_hours": 12
    },
    {
      "id": "config_002",
      "department_id": "dept_002",
      "department_name": "Production",
      "default_shift_id": "shift_002",
      "default_shift_name": "Early Shift (8-5)",
      "default_shift_start": "08:00:00",
      "default_shift_end": "17:00:00",
      "working_days": [1, 2, 3, 4, 5, 6],
      "weekend_days": [0],
      "require_checkout": true,
      "auto_checkout_after_hours": 10
    }
  ]
}
```

---

### 4. Reset Department Configuration
**Endpoint:** `POST /api/v1/department-config/:department_id/reset`

**Authorization:** Admin only

**Description:** Reset department configuration to system defaults.

**Default Configuration:**
- Default Shift: General (9-6)
- Working Days: Monday to Saturday [1,2,3,4,5,6]
- Weekend: Sunday [0]
- Require Checkout: true
- Auto Checkout: 12 hours
- Late Threshold: 15 minutes
- Early Departure Threshold: 15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config_001",
    "department_id": "dept_001",
    "default_shift_id": "shift_001",
    "working_days": "[1,2,3,4,5,6]",
    "weekend_days": "[0]",
    "require_checkout": true,
    "auto_checkout_after_hours": 12,
    "late_arrival_threshold_minutes": 15,
    "early_departure_threshold_minutes": 15
  },
  "message": "Department configuration reset to defaults"
}
```

---

## Usage Examples

### Admin: Create Custom Shift

**Step 1: Create Shift**
```bash
curl -X POST https://sac.saksolution.com/api/v1/shifts \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Night Shift (10PM-6AM)",
    "start_time": "22:00:00",
    "end_time": "06:00:00",
    "grace_period_minutes": 30,
    "break_duration_minutes": 45,
    "description": "Night shift for security team"
  }'
```

**Step 2: Assign to Employee**
```bash
curl -X POST https://sac.saksolution.com/api/v1/shifts/assign \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "user_001",
    "shift_id": "shift_003",
    "effective_from": "2026-01-01"
  }'
```

**Step 3: Verify Assignment**
```bash
curl https://sac.saksolution.com/api/v1/shifts/employee/user_001/current \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### Admin: Configure Department

**Step 1: View Current Config**
```bash
curl https://sac.saksolution.com/api/v1/department-config/dept_001 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Step 2: Update Config**
```bash
curl -X PUT https://sac.saksolution.com/api/v1/department-config/dept_001 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_shift_id": "shift_002",
    "working_days": [1, 2, 3, 4, 5],
    "weekend_days": [0, 6],
    "late_arrival_threshold_minutes": 10,
    "auto_checkout_after_hours": 10
  }'
```

**Step 3: Bulk Assign Shift to Department**
```bash
curl -X POST https://sac.saksolution.com/api/v1/shifts/bulk-assign \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "dept_001",
    "shift_id": "shift_002",
    "effective_from": "2026-01-01"
  }'
```

---

### Employee: View Own Shift

**Get Current Shift**
```bash
curl https://sac.saksolution.com/api/v1/shifts/employee/user_001/current \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

**Get Shift History**
```bash
curl https://sac.saksolution.com/api/v1/shifts/employee/user_001 \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

---

## Integration with Attendance System

### How Shifts Affect Attendance Calculation

When the attendance cron job runs (`POST /api/v1/attendance/calculate`):

1. **Shift Lookup:**
   - Queries `employee_shifts` to find active shift for employee on target date
   - Joins with `attendance_shifts` to get shift timings

2. **Late Detection:**
   - Compares first check-in time with `shift.start_time + grace_period_minutes`
   - If later → `is_late = true`, calculates `late_by_minutes`

3. **Early Exit Detection:**
   - Compares last check-out with `shift.end_time`
   - If earlier by > 15 minutes → `is_early_exit = true`

4. **Work Hours Calculation:**
   ```
   total_hours = last_checkout - first_checkin
   work_hours = total_hours - break_duration_minutes
   ```

5. **Overtime Detection:**
   - If `last_checkout > shift.end_time`, calculates overtime minutes
   - Status becomes `'overtime'` if overtime > 60 minutes

### Department Config Impact

1. **Weekend Detection:**
   - Uses `department_shift_config.weekend_days` array
   - If day matches weekend → status: `'weekend'` (unless has access logs)

2. **Working Days:**
   - `working_days` array defines expected work days
   - Days not in working_days are treated as weekends

3. **Late/Early Thresholds:**
   - `late_arrival_threshold_minutes` - grace period for marking late
   - `early_departure_threshold_minutes` - tolerance for early exit

4. **Auto Checkout:**
   - If `require_checkout = true` and no manual checkout
   - Auto-generates checkout after `auto_checkout_after_hours`

---

## Common Shift Patterns

### Standard Office (Mon-Sat, 9-6)
```json
{
  "name": "General (9-6)",
  "start_time": "09:00:00",
  "end_time": "18:00:00",
  "grace_period_minutes": 15,
  "break_duration_minutes": 60
}
```

### Early Shift (Mon-Sat, 8-5)
```json
{
  "name": "Early Shift (8-5)",
  "start_time": "08:00:00",
  "end_time": "17:00:00",
  "grace_period_minutes": 15,
  "break_duration_minutes": 60
}
```

### Late Shift (Mon-Sat, 10-7)
```json
{
  "name": "Late Shift (10-7)",
  "start_time": "10:00:00",
  "end_time": "19:00:00",
  "grace_period_minutes": 15,
  "break_duration_minutes": 60
}
```

### Flexible Hours
```json
{
  "name": "Flexible",
  "start_time": "00:00:00",
  "end_time": "23:59:59",
  "grace_period_minutes": 30,
  "break_duration_minutes": 60
}
```

### Night Shift (10PM-6AM)
```json
{
  "name": "Night Shift",
  "start_time": "22:00:00",
  "end_time": "06:00:00",
  "grace_period_minutes": 30,
  "break_duration_minutes": 45
}
```

---

## API Endpoints Summary

### Shift Management
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/shifts` | Admin | Create shift |
| GET | `/api/v1/shifts` | Authenticated | Get all shifts |
| PUT | `/api/v1/shifts/:id` | Admin | Update shift |
| DELETE | `/api/v1/shifts/:id` | Admin | Delete shift |
| POST | `/api/v1/shifts/assign` | Admin | Assign shift to employee |
| POST | `/api/v1/shifts/bulk-assign` | Admin | Bulk assign to department |
| GET | `/api/v1/shifts/employee/:id` | Authenticated | Get employee shifts |
| GET | `/api/v1/shifts/employee/:id/current` | Authenticated | Get current shift |

### Department Configuration
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/department-config` | Admin | Get all configs |
| GET | `/api/v1/department-config/:id` | Authenticated | Get department config |
| PUT | `/api/v1/department-config/:id` | Admin | Update config |
| POST | `/api/v1/department-config/:id/reset` | Admin | Reset to defaults |

---

## Day Number Reference

When setting `working_days` and `weekend_days`:

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

**Examples:**
- Monday-Friday: `[1,2,3,4,5]`
- Monday-Saturday: `[1,2,3,4,5,6]`
- Sunday only: `[0]`
- Saturday-Sunday: `[0,6]`
- Friday only (Middle East): `[5]`
