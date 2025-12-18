# Secretary-Based Meeting Room Booking System

## Overview
A complete secretary and employee management system for internal meeting room bookings. Secretaries can book meetings on behalf of their assigned employees, and employees can block their own time or make their own bookings.

## Key Features

### 1. **Secretary Management**
- Multiple secretaries can manage different sets of employees
- One employee can be managed by multiple secretaries
- Secretaries can only book meetings for their assigned employees

### 2. **Employee Self-Management**
- Employees can block their own time (busy, out of office, do not disturb)
- Employees can view their upcoming meetings
- Employees can book their own meetings

### 3. **Conflict Prevention**
- System checks employee availability blocks before booking
- Prevents double-booking unless overridden
- Secretaries cannot book if employee has blocked the time (unless override)

### 4. **Meeting Room Integration**
- Works with existing 13 meeting rooms across 6 floors
- Capacity validation
- Equipment tracking
- QR code generation for all participants
- WhatsApp notifications with QR codes

## Database Schema

### New Tables:
1. **`secretary_employee_assignments`** - Links secretaries to employees
2. **`employee_availability_blocks`** - Employee time blocks
3. **`meetings`** - Added `booked_by_secretary_id` column
4. **`internal_meeting_participants`** - Added `is_primary_employee` flag

### New User Roles:
- `secretary` - Can book meetings for assigned employees
- `employee` - Can block own time and book own meetings

## Login Credentials

### Secretaries (Password: `Secretary123!`)

| Name | ITS ID | Email | Manages Employees |
|------|---------|--------|-------------------|
| **Ana Martinez** | ITS200001 | ana.martinez@company.com | ITS300001, ITS300002, ITS300003, ITS300004, ITS300005 |
| **Joe Thompson** | ITS200002 | joe.thompson@company.com | ITS300001, ITS300003, ITS300007, ITS300008, ITS300009 |
| **Linda Chen** | ITS200003 | linda.chen@company.com | ITS300010, ITS300011, ITS300012, ITS300013, ITS300014, ITS300015 |

### Employees (Password: `Employee123!`)

| Name | ITS ID | Email | Managed By |
|------|---------|--------|------------|
| **Alex Johnson** | ITS300001 | employee1@company.com | Ana, Joe |
| **Maria Garcia** | ITS300002 | employee2@company.com | Ana |
| **Chris Lee** | ITS300003 | employee3@company.com | Ana, Joe |
| **Patricia Davis** | ITS300004 | employee4@company.com | Ana |
| **James Wilson** | ITS300005 | employee5@company.com | Ana |
| **Jennifer Taylor** | ITS300006 | employee6@company.com | _(none)_ |
| **Robert Anderson** | ITS300007 | employee7@company.com | Joe |
| **Michelle Thomas** | ITS300008 | employee8@company.com | Joe |
| **Daniel Martinez** | ITS300009 | employee9@company.com | Joe |
| **Jessica Robinson** | ITS300010 | employee10@company.com | Linda |
| **Matthew Clark** | ITS300011 | employee11@company.com | Linda |
| **Ashley Rodriguez** | ITS300012 | employee12@company.com | Linda |
| **Andrew Lewis** | ITS300013 | employee13@company.com | Linda |
| **Stephanie Walker** | ITS300014 | employee14@company.com | Linda |
| **Joshua Hall** | ITS300015 | employee15@company.com | Linda |

## API Endpoints

### Secretary Endpoints
- `GET /api/v1/secretaries/my-employees` - Get assigned employees (secretary only)
- `GET /api/v1/secretaries/can-book/:employee_its_id` - Check if can book for employee
- `GET /api/v1/secretaries/all` - List all secretaries (admin only)
- `POST /api/v1/secretaries/assign` - Assign employee to secretary (admin only)
- `DELETE /api/v1/secretaries/assignment/:assignment_id` - Remove assignment (admin only)

### Employee Availability Endpoints
- `POST /api/v1/employee-availability/blocks` - Create availability block (employee)
- `GET /api/v1/employee-availability/blocks` - Get my availability blocks (employee)
- `DELETE /api/v1/employee-availability/blocks/:block_id` - Delete block (employee)
- `GET /api/v1/employee-availability/meetings` - Get my upcoming meetings (employee)
- `POST /api/v1/employee-availability/check` - Check employee availability (secretary)

### Internal Meeting Endpoints (Updated)
- `POST /api/v1/internal-meetings` - Create meeting (now supports secretary & employee roles)
  - **New field**: `primary_employee_its_id` - The employee the meeting is for (when booked by secretary)
  - System validates secretary can book for that employee
  - Checks employee availability blocks

- `POST /api/v1/internal-meetings/check-availability` - Check conflicts
- `GET /api/v1/internal-meetings/:meeting_id/participants` - List participants

## Usage Examples

### 1. Secretary Books Meeting for Employee

```json
POST /api/v1/internal-meetings
Authorization: Bearer <ana_martinez_token>

{
  "meeting_room_id": "room-uuid",
  "meeting_time": "2025-12-16T14:00:00",
  "duration_minutes": 60,
  "primary_employee_its_id": "ITS300001",  // Alex Johnson
  "participant_its_ids": ["ITS300001", "ITS300002"],
  "purpose": "Team sync",
  "override_conflicts": false
}
```

**Response**:
- If Ana tries to book for ITS300006 (not her employee): `403 Forbidden`
- If ITS300001 has blocked that time: `409 Conflict` with block details
- If successful: Meeting created with `booked_by_secretary_id` = Ana's ID

### 2. Employee Blocks Time

```json
POST /api/v1/employee-availability/blocks
Authorization: Bearer <alex_johnson_token>

{
  "start_time": "2025-12-16T14:00:00",
  "end_time": "2025-12-16T15:00:00",
  "reason": "Out of office - client visit",
  "block_type": "out_of_office"
}
```

**Block Types**:
- `busy` - General busy time
- `out_of_office` - Not in office
- `do_not_disturb` - Available but should not be disturbed

### 3. Employee Books Own Meeting

```json
POST /api/v1/internal-meetings
Authorization: Bearer <alex_johnson_token>

{
  "meeting_room_id": "room-uuid",
  "meeting_time": "2025-12-16T16:00:00",
  "duration_minutes": 30,
  "participant_its_ids": ["ITS300001", "ITS100001"],  // Alex + John Doe (host)
  "purpose": "Project discussion"
}
```

No `primary_employee_its_id` needed - system uses logged-in user as organizer.

### 4. Check Employee Availability (Secretary)

```json
POST /api/v1/employee-availability/check
Authorization: Bearer <joe_thompson_token>

{
  "employee_id": "employee-uuid-of-ITS300007",
  "start_time": "2025-12-16T14:00:00",
  "duration_minutes": 60
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "is_available": false,
    "blocks": [
      {
        "id": "block-uuid",
        "start_time": "2025-12-16T13:00:00",
        "end_time": "2025-12-16T15:00:00",
        "reason": "Weekly team meeting",
        "block_type": "busy"
      }
    ],
    "conflicting_meetings": []
  }
}
```

## Business Rules

### Secretary Booking Rules:
1. ✅ Secretary MUST specify `primary_employee_its_id` in request
2. ✅ Secretary can ONLY book for their assigned employees
3. ✅ System checks employee availability blocks before booking
4. ✅ If employee blocked time, secretary gets 409 error (unless override)
5. ✅ Meeting is recorded with `booked_by_secretary_id` for audit trail

### Employee Booking Rules:
1. ✅ Employee can book without `primary_employee_its_id` (uses their own ID)
2. ✅ Employee can add other participants (hosts, employees)
3. ✅ Employee's own blocks don't prevent them from booking (they override themselves)

### Conflict Detection:
1. ✅ Checks existing meetings for all participants
2. ✅ Checks primary employee's availability blocks (if booked by secretary)
3. ✅ Returns detailed conflict info with meeting details
4. ✅ Supports override with reason (cancels conflicting meetings + notifications)

## Testing Scenarios

### Scenario 1: Ana books for Alex (Success)
```
Login: ITS200001 / Secretary123!
Book meeting for: ITS300001
Expected: ✅ Success (Ana manages Alex)
```

### Scenario 2: Ana books for Robert (Failure)
```
Login: ITS200001 / Secretary123!
Book meeting for: ITS300007
Expected: ❌ 403 Forbidden (Robert is managed by Joe, not Ana)
```

### Scenario 3: Alex blocks time, Ana tries to book (Conflict)
```
1. Login as ITS300001 / Employee123!
2. Block time: Tomorrow 2:00 PM - 3:00 PM
3. Logout, Login as ITS200001 / Secretary123!
4. Try to book meeting for ITS300001 at 2:00 PM
Expected: ❌ 409 Conflict with block details
```

### Scenario 4: Alex books own meeting during blocked time (Override)
```
1. Login as ITS300001 / Employee123!
2. Block time: Tomorrow 2:00 PM - 3:00 PM  
3. Book meeting for 2:00 PM (without primary_employee_its_id)
Expected: ✅ Success (employees can override their own blocks)
```

### Scenario 5: Cross-Secretary Assignment
```
Alex (ITS300001) is managed by both Ana AND Joe.
Both can book meetings for Alex independently.
Conflict detection works across all bookings.
```

## Frontend Integration

The existing `BookInternalMeetingPage.tsx` now supports:
- Secretary login: Shows dropdown to select employee
- Employee login: Books for self automatically
- Admin/Host/Receptionist: Works as before

**Updates needed**:
- Add employee selector dropdown for secretary role
- Show "Booked by Secretary" badge on meetings
- Add availability calendar view for employees
- Add "Block Time" button in employee dashboard

## Migration Status

- ✅ Migration Batch 6: `20251215200001_create_secretary_system.ts`
- ✅ Secretary role added to user_role enum
- ✅ Employee role added to user_role enum
- ✅ 3 secretaries created (ITS200001-ITS200003)
- ✅ 15 employees created (ITS300001-ITS300015)
- ✅ 16 secretary-employee assignments created
- ✅ Backend API deployed and running
- ✅ PM2 restart successful

## Security & Permissions

| Role | Can Book Meetings | Can Book For Others | Can Block Time | Can Manage Assignments |
|------|-------------------|---------------------|----------------|------------------------|
| Admin | ✅ | ✅ (anyone) | ✅ (self) | ✅ |
| Secretary | ✅ | ✅ (assigned employees only) | ❌ | ❌ |
| Employee | ✅ | ❌ | ✅ (self) | ❌ |
| Host | ✅ | ❌ | ❌ | ❌ |
| Receptionist | ✅ | ❌ | ❌ | ❌ |

## Next Steps

1. ✅ **Backend Complete** - All APIs deployed
2. ⏳ **Frontend Update** - Add secretary booking UI
3. ⏳ **Employee Dashboard** - Add time blocking interface
4. ⏳ **Testing** - Test all scenarios above
5. ⏳ **Documentation** - Update API docs

---

**System is LIVE and ready for testing!**

Access at: **https://sac.saksolution.com/**

Use the login credentials above to test different scenarios.
