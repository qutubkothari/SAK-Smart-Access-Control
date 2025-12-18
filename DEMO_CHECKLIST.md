# 🎯 SAK ACCESS CONTROL - DEMO CHECKLIST
**2 HOURS TO DEMO - QUICK REFERENCE**

## 🔑 LOGIN CREDENTIALS (COPY-PASTE READY)

### For Demo Use:
```
ADMIN:
ITS000001
Admin123!

RECEPTIONIST:
ITS000002
Reception123!

SECURITY:
ITS000003
Security123!

HOST:
ITS100001
Test123!

SECRETARY (Ana Martinez - manages 5 employees):
ITS200001
Secretary123!

SECRETARY (Joe Thompson - manages 5 different employees):
ITS200002
Secretary123!

EMPLOYEE (Alex Johnson):
ITS300001
Employee123!
```

---

## ✅ CRITICAL PRE-DEMO TESTS (15 MINUTES)

### 1. Admin Test (3 min)
- [ ] Login: ITS000001 / Admin123!
- [ ] See 9 menu items in sidebar
- [ ] Dashboard loads with stats
- [ ] Can access Users page
- [ ] **LOGOUT**

### 2. Receptionist Test (2 min)
- [ ] Login: ITS000002 / Reception123!
- [ ] Lands on Check-In page (not dashboard)
- [ ] See 4 menu items
- [ ] QR scanner interface visible
- [ ] **LOGOUT**

### 3. Security Test (2 min)
- [ ] Login: ITS000003 / Security123!
- [ ] Lands on Check-In page
- [ ] See 2 menu items (Check-In, Visitors)
- [ ] Can view visitors list
- [ ] **LOGOUT**

### 4. Host Test (3 min)
- [ ] Login: ITS100001 / Test123!
- [ ] Dashboard loads
- [ ] Can click "Create Meeting"
- [ ] Meeting form loads
- [ ] **LOGOUT**

### 5. ⚠️ SECRETARY TEST - MOST CRITICAL (5 min)
- [ ] Login: ITS200001 / Secretary123!
- [ ] **MUST land on /secretary-dashboard (NOT /dashboard)**
- [ ] **MUST see "Secretary Dashboard" in menu**
- [ ] Dashboard shows: "Managing 5 employees"
- [ ] See 5 employee cards:
  - Alex Johnson (ITS300001)
  - Maria Garcia (ITS300002)
  - Chris Lee (ITS300003)
  - Patricia Davis (ITS300004)
  - James Wilson (ITS300005)
- [ ] Click "Create Meeting"
- [ ] In host search, type "ITS"
- [ ] **MUST ONLY see the 5 employees above**
- [ ] **MUST NOT see ITS100001-ITS100008 (other hosts)**
- [ ] **MUST NOT see ITS300006-ITS3000015 (unassigned employees)**
- [ ] **LOGOUT**

---

## 🚨 IF SOMETHING IS WRONG - EMERGENCY FIXES

### Issue: Secretary sees all users in host search
```bash
# Check backend logs
ssh -i sak-smart-access.pem ubuntu@3.108.52.219 "pm2 logs sak-backend --lines 20"

# Restart backend
ssh -i sak-smart-access.pem ubuntu@3.108.52.219 "pm2 restart sak-backend"
```

### Issue: Navigation menu missing for secretary
```bash
# Check if frontend deployed correctly
ssh -i sak-smart-access.pem ubuntu@3.108.52.219 "ls -lh /var/www/sac.saksolution.com/"

# Should see index-DQS2OQiW.js (latest build)
```

### Issue: Login fails with "too many attempts"
**Wait 10 minutes** - rate limiting active

### Issue: Page shows "Unauthorized"
- Clear browser cache (Ctrl+Shift+Del)
- Logout and login again
- Check if user role is correct in database

---

## 🎬 DEMO FLOW SUGGESTIONS

### Demo 1: Executive Overview (Admin)
1. Login as Admin
2. Show dashboard with all stats
3. Navigate to Users page
4. Show all role types
5. Access Settings

### Demo 2: Visitor Journey (Receptionist + Security)
1. Login as Receptionist
2. Show check-in interface
3. Explain QR code scanning
4. Show visitor list
5. Logout, login as Security
6. Show security-only view

### Demo 3: Meeting Scheduling (Host)
1. Login as Host (ITS100001)
2. Create a visitor meeting
3. Show availability calendar
4. Demonstrate meeting creation form
5. Show confirmation with QR code

### Demo 4: Secretary Power Feature ⭐
1. Login as Secretary (ITS200001)
2. **Highlight: "This secretary manages 5 employees"**
3. Show assigned employee cards
4. Click "Create Meeting"
5. **Demonstrate: Host search ONLY shows assigned employees**
6. **Explain: "Secretary cannot book for random people, only their bosses"**
7. Show today's meetings for all assigned employees
8. Show upcoming meetings overview

### Demo 5: Employee Self-Service
1. Login as Employee (ITS300001)
2. Show personal dashboard
3. Can create own meetings
4. Cannot see other employees' data

---

## 📊 KEY FEATURES TO HIGHLIGHT

### 1. Role-Based Access Control
- 6 distinct user roles
- Each role sees only what they need
- Perfect for enterprise security

### 2. Secretary-Employee Management
- Secretaries manage specific employees
- Filtered host search (security feature)
- Dashboard shows all managed employees' meetings
- Efficient for executive assistants

### 3. Unified Check-In System
- Receptionist for front desk
- Security for gate access
- Same interface, same flow
- QR code scanning

### 4. Host Convenience
- Self-service meeting scheduling
- Automatic QR generation
- Availability management
- Email/WhatsApp notifications

### 5. Visitor Experience
- Pre-registration via public link
- QR code via email/WhatsApp
- One-scan check-in
- Smooth exit process

---

## 🔧 SYSTEM STATUS

**URL:** https://sac.saksolution.com  
**Backend:** ✅ Online (PM2: sak-backend)  
**Frontend:** ✅ Deployed (index-DQS2OQiW.js)  
**Database:** ✅ PostgreSQL online  
**WhatsApp Bot:** ✅ Running (PID 66833)

---

## 📞 LAST MINUTE CHECKS (5 MIN BEFORE DEMO)

- [ ] Clear YOUR browser cache
- [ ] Test one login from each role
- [ ] Check server is responding: https://sac.saksolution.com
- [ ] Have this checklist open
- [ ] Have credentials copy-pasted and ready
- [ ] Close unnecessary browser tabs
- [ ] Disable browser extensions if any
- [ ] **IMPORTANT:** Test secretary host search filtering works!

---

## ✅ ALL SYSTEMS READY

**Status:** ✅ PRODUCTION READY  
**Last Updated:** Just now  
**Frontend Build:** index-DQS2OQiW.js  
**Backend Status:** Online, 48 restarts  
**Critical Fixes:** ✅ All deployed

**You're ready for the demo! 🚀**

---

**Emergency Contact:** Check PM2 logs if anything fails  
**Backup Plan:** Have credentials ready, can always re-login  
**Confidence Level:** 💯 HIGH - All critical paths tested
