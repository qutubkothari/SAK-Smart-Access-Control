# Multi-Day Visitor Access & QR Code Preferences - Feature Guide

## 🎯 Overview
Two critical features have been implemented to handle special visitor scenarios:

### 1. **Multi-Day Visitor Access**
For visitors who need access over multiple days with flexible timing (contractors, consultants, delegates, vendors)

### 2. **Optional QR Code Generation**
For large delegations where individual QR code scanning is not practical

---

## ✨ Features Implemented

### Multi-Day Access Pass
- **Flexible Date Range**: Specify start and end dates for visitor access
- **No Fixed Time Slots**: Visitors can enter anytime during the valid period
- **Extended QR Validity**: QR codes valid until end of last day (11:59 PM)
- **Use Cases**:
  - Contractors working on multi-day projects
  - Consultants with ongoing engagements
  - Vendor representatives with flexible schedules
  - Training program attendees
  - Conference delegates

### QR Code Preference
- **Individual QR Codes** (Default): Each visitor receives their own QR code via email/WhatsApp
- **No QR Codes**: For large groups/delegations
  - Visitors receive meeting details without QR codes
  - Instructions to check in at reception desk
  - Optional custom message template
  - Reduces friction for groups who won't scan QR codes

---

## 🖥️ How to Use

### Creating a Meeting with Multi-Day Access

1. **Navigate**: Dashboard → "Create Meeting"
2. **Select Host**: Search and select whom to meet
3. **Choose Date/Time**: Select initial meeting time
4. **Add Visitors**: Enter visitor details (Name, Email, Phone, Company, etc.)
5. **Enable Multi-Day Access**:
   - ✅ Check "Multi-Day Access"
   - Select "Access Valid From" date
   - Select "Access Valid Until" date
6. **QR Code Option**:
   - ✅ Keep "Generate Individual QR Codes" checked (default)
   - OR uncheck it for delegations
7. **Submit**: Click "Create Meeting & Send Invites"

### Creating a Meeting for Large Delegations (No QR)

1. Follow steps 1-4 above
2. **Add Multiple Visitors**: Click "+ Add Another Visitor" for each person
3. **QR Code Option**:
   - ❌ Uncheck "Generate Individual QR Codes"
   - (Optional) Enter custom message template
4. **Submit**: All visitors receive meeting details without QR codes

---

## 📧 Notifications Sent

### With QR Codes (Default)
**Email**:
- Meeting invitation with QR code embedded
- Meeting details (date, time, location, host)
- Instructions to show QR at reception

**WhatsApp**:
- QR code image
- Meeting details
- QR ID for reference

### Without QR Codes (Delegation Mode)
**Email**:
- Meeting invitation (no QR)
- Meeting details
- Instructions to check in at reception desk
- Multi-day access indicator (if applicable)

**WhatsApp**:
- Meeting details text message
- Check-in instructions
- Multi-day access validity dates (if applicable)

---

## 🗄️ Database Changes

### New Fields Added to `meetings` Table:
```sql
- is_multi_day (boolean, default: false)
- visit_start_date (date, nullable)
- visit_end_date (date, nullable)
- generate_individual_qr (boolean, default: true)
- meeting_message_template (text, nullable)
```

### New Fields Added to `visitors` Table:
```sql
- multi_day_access (boolean, default: false)
- access_valid_from (date, nullable)
- access_valid_until (date, nullable)
```

### New Table: `visitor_access_log`
Tracks multiple entries/exits for multi-day visitors:
```sql
- id, visitor_id, meeting_id
- entry_time, exit_time
- entry_point
- checked_in_by, checked_out_by
- notes, timestamps
```

---

## 🔍 Use Case Examples

### Example 1: IT Contractor (Multi-Day, With QR)
```
Scenario: External developer needs 5-day access (Mon-Fri)

Settings:
✅ Multi-Day Access
   From: 2025-01-20
   Until: 2025-01-24
✅ Generate Individual QR Codes

Result:
- Visitor receives 1 QR code valid for entire period
- Can enter/exit any time from Jan 20-24
- Reception scans QR on each entry
- System logs each visit in visitor_access_log
```

### Example 2: Government Delegation (Single Day, No QR)
```
Scenario: 15-member delegation visiting for 2-hour meeting

Settings:
❌ Multi-Day Access
✅ Meeting Date: 2025-01-22, 10:00 AM
❌ Generate Individual QR Codes
   Custom Message: "Welcome delegation! Please proceed to 
   Conference Room A on Floor 2. Security will verify IDs."

Result:
- All 15 members receive meeting details via email/WhatsApp
- No QR codes generated
- Reception manually checks in the group
- Custom message guides them to the location
```

### Example 3: Training Program (Multi-Day, No QR)
```
Scenario: 20 trainees attending 3-day workshop

Settings:
✅ Multi-Day Access
   From: 2025-02-10
   Until: 2025-02-12
❌ Generate Individual QR Codes

Result:
- All 20 trainees receive meeting details
- No individual QR codes (reduces friction)
- Reception maintains manual attendance
- Access valid for full 3 days
```

---

## 🔒 Security Considerations

### Multi-Day Access
- QR codes expire at end of last day (11:59:59 PM)
- Each entry/exit logged in `visitor_access_log` table
- Reception can verify visitor identity on each visit
- Access can be revoked by canceling the meeting

### No QR Mode
- Reception desk must manually verify visitor identities
- Suitable for trusted visitors or groups with IDs
- Meeting details still require host approval
- Check-in records maintained in system

---

## 🎨 UI Changes

### CreateMeetingPage.tsx
**New Section**: "Step 3: Visit Options" appears after adding visitors

**Multi-Day Access Card** (Blue):
- Checkbox: "Multi-Day Access"
- Description: "Enable this for visitors who need multiple days entry..."
- Date Inputs: "Access Valid From" and "Access Valid Until"

**QR Code Option Card** (Green):
- Checkbox: "Generate Individual QR Codes" (checked by default)
- Description: Dynamic text based on visitor count
- Textarea: "Custom Meeting Message" (shown when unchecked)

---

## 🧪 Testing Steps

### Test 1: Multi-Day Contractor
1. Login as receptionist/host
2. Create meeting for contractor
3. Enable multi-day: Jan 20 - Jan 24
4. Add contractor details
5. Submit → Verify contractor receives QR code
6. Check QR expiry: Should be Jan 24, 11:59 PM
7. Test QR scan on Jan 20, Jan 22, Jan 24
8. Verify visitor_access_log entries

### Test 2: Large Delegation (No QR)
1. Create meeting with 10+ visitors
2. Add all visitor details
3. Uncheck "Generate Individual QR Codes"
4. Enter custom message
5. Submit → Verify:
   - All visitors receive email/WhatsApp
   - No QR codes attached
   - Custom message included
   - Reception can manually check in

### Test 3: Mixed Scenario
1. Multi-day access: Yes (3 days)
2. Individual QR: No
3. Custom message: Yes
4. Verify visitors receive:
   - Date range in message
   - No QR codes
   - Custom instructions
   - Multi-day access indicator

---

## 📊 Database Migration

**Migration**: `20251216000001_add_qr_code_preference.ts`
**Batch**: 7
**Status**: ✅ Applied to production

**Already Existing**: `20251215000001_add_multiday_visit_support.ts` (Batch 5)

---

## 🚀 Deployment Status

✅ **Backend**: Deployed (Build + Migration + PM2 Restart)
✅ **Frontend**: Deployed (New UI with multi-day and QR options)
✅ **Database**: Migration Batch 7 applied
✅ **Notifications**: Email/WhatsApp services updated

**Server**: https://sac.saksolution.com
**PM2 Status**: sak-backend online (PID 88244, 0 restarts since deploy)

---

## 📝 API Changes

### POST /api/v1/meetings
**New Request Fields**:
```json
{
  "host_id": "uuid",
  "meeting_time": "2025-01-20T10:00:00",
  "duration_minutes": 60,
  "location": "Office",
  "visitors": [...],
  
  // NEW FIELDS
  "is_multi_day": true,
  "visit_start_date": "2025-01-20",
  "visit_end_date": "2025-01-24",
  "generate_individual_qr": false,
  "meeting_message_template": "Custom message here"
}
```

---

## 🎯 Benefits

1. **Flexibility**: Supports various visitor scenarios
2. **Efficiency**: Reduces QR code overhead for large groups
3. **Security**: Maintains audit trail via access logs
4. **User Experience**: Clear UI with helpful descriptions
5. **Scalability**: Handles 1 visitor or 100+ delegation members

---

## 📞 Support

For issues or questions:
- Check PM2 logs: `pm2 logs sak-backend`
- Database queries: Check `meetings`, `visitors`, `visitor_access_log` tables
- Frontend: Clear browser cache if not seeing new options

---

**Deployed**: December 16, 2025  
**Version**: Backend 1.0.0, Frontend (index-D-MPgXrQ.js)  
**Migration Batch**: 7
