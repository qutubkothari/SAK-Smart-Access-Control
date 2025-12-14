# SAK Access Control - Enhancement Implementation Plan

## Issues to Fix (Client Trial Feedback)

### 1. Role-Based Access Control
**Current:** All authenticated users see all features
**Required:**
- Receptionist: Check-in page + Visitors list (read-only)
- Security: Check-in page only
- Admin: Full access

**Implementation:**
- Update routes with proper `authorize()` middleware
- Add role-based menu filtering in frontend
- Update dashboard to show role-appropriate views

### 2. Check-in Time Window Validation
**Required:** Block check-in if >30 minutes before meeting time

**Implementation:**
- Add validation in `checkInVisitor` controller
- Check `meeting.meeting_time` vs current time
- Return error if too early

### 3. Edit Meeting Feature
**Required:** Allow editing meeting details after creation

**Implementation:**
- Add `PUT /api/v1/meetings/:id` endpoint
- Add "Edit" button in meeting detail page
- Support editing: time, duration, location, purpose

### 4. Dashboard - Upcoming Meetings & Recent Visitors Not Showing
**Required:** Fix data not appearing in dashboard cards

**Implementation:**
- Debug `getDashboardStats` controller
- Check data transformation in frontend
- Verify query logic

### 5. Meetings List - Missing Key Info
**Required:** Show host name, visitor names, time in the list view (not just in details)

**Implementation:**
- Update meetings query to join users + visitors
- Update `MeetingsPage` table columns
- Add: Host, Visitors, Date/Time columns

### 6. Post Check-in - Tabs Not Refreshing
**Required:** Auto-refresh meetings/visitors after check-in

**Implementation:**
- Add websocket event or polling
- Trigger refetch in `MeetingsPage` and `VisitorsPage`
- Option: auto-refresh on navigation

### 7. Auto Checkout + Manual Checkout
**Required:**
- Manual checkout button
- Auto-checkout 2 hours after meeting end time

**Implementation:**
- Add `POST /api/v1/visitors/:id/check-out` endpoint
- Add "Check Out" button in visitor detail / list
- Add cron job / scheduled task for auto-checkout

### 8. Host Availability / Time Blocking
**Required:** Host can block time slots (busy/unavailable)

**Implementation:**
- Create `availability_blocks` table
- Add `/api/v1/users/me/availability` CRUD endpoints
- Update meeting availability query to exclude blocked slots
- Add "My Availability" page for hosts

### 9. Multiple QR Codes (One Per Visitor)
**Required:** Generate individual QR for each visitor (with bulk option)

**Implementation:**
- Already generates one QR per visitor in backend
- Frontend needs to display all QRs in meeting detail
- Add "bulk_qr" flag for delegation scenarios

### 10. Visitors Screen - Status Not Updating
**Required:** Show real-time check-in/check-out status

**Implementation:**
- Add computed `status` field in visitor query
- Show: "Pending", "Checked In", "Checked Out", "Expired"
- Auto-refresh or websocket updates

### 11. Filter, Sort, Edit, Delete on All Screens
**Required:** Table enhancements across all list pages

**Implementation:**
- Add column sorting (click header)
- Add search/filter inputs
- Add inline edit/delete actions
- Add pagination

---

## Priority Order (Highest Impact First)

### Phase 1 (Critical - Do Now)
1. ✅ Role-based access (#1)
2. ✅ Check-in time window (#2)
3. ✅ Dashboard fix (#4)
4. ✅ Meetings list info (#5)
5. ✅ Visitors status (#10)

### Phase 2 (High Priority)
6. ✅ Manual/Auto checkout (#7)
7. ✅ Edit meeting (#3)
8. ✅ Multiple QRs display (#9)

### Phase 3 (Nice to Have)
9. ✅ Post check-in refresh (#6)
10. ✅ Filter/sort/edit/delete (#11)
11. ✅ Host availability blocking (#8)

---

## Estimated Implementation Time
- Phase 1: 2-3 hours
- Phase 2: 2-3 hours  
- Phase 3: 4-5 hours
**Total: 8-11 hours**
