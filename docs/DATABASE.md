# Database Schema Documentation

## Overview
PostgreSQL database schema for SAK Smart Access Control System.

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Users     │       │   Meetings   │       │   Visitors   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │───┐   │ id (PK)      │───┐   │ id (PK)      │
│ its_id       │   └──→│ host_id (FK) │   └──→│ meeting_id   │
│ email        │       │ meeting_time │       │ name         │
│ name         │       │ location     │       │ email        │
│ phone        │       │ purpose      │       │ phone        │
│ department   │       │ qr_code      │       │ qr_code      │
│ role         │       │ status       │       │ check_in     │
│ created_at   │       │ created_at   │       │ check_out    │
└──────────────┘       └──────────────┘       └──────────────┘
```

## Tables

### 1. Users (Employees/Hosts)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    its_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(id),
    role VARCHAR(50) NOT NULL DEFAULT 'host',
    profile_photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    preferred_notification_channel VARCHAR(20) DEFAULT 'email',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_its_id ON users(its_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department ON users(department_id);
```

**Roles:** `admin`, `security`, `receptionist`, `host`

---

### 2. Departments
```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    manager_id UUID REFERENCES users(id),
    floor_number INTEGER,
    building VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3. Meetings
```sql
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255) NOT NULL,
    room_number VARCHAR(50),
    purpose TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    qr_code_url TEXT,
    qr_code_hash VARCHAR(255) UNIQUE,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    host_checked_in BOOLEAN DEFAULT false,
    host_check_in_time TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meetings_host ON meetings(host_id);
CREATE INDEX idx_meetings_time ON meetings(meeting_time);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_qr_hash ON meetings(qr_code_hash);
```

**Status Values:** `scheduled`, `in_progress`, `completed`, `cancelled`, `no_show`

---

### 4. Visitors
```sql
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    company VARCHAR(255),
    visitor_type VARCHAR(50) DEFAULT 'guest',
    qr_code TEXT UNIQUE NOT NULL,
    qr_code_expires_at TIMESTAMP NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    photo_url TEXT,
    badge_number VARCHAR(50),
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    purpose_of_visit TEXT,
    is_blacklisted BOOLEAN DEFAULT false,
    nda_signed BOOLEAN DEFAULT false,
    nda_signed_at TIMESTAMP,
    checked_in_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visitors_meeting ON visitors(meeting_id);
CREATE INDEX idx_visitors_email ON visitors(email);
CREATE INDEX idx_visitors_qr ON visitors(qr_code);
CREATE INDEX idx_visitors_check_in ON visitors(check_in_time);
```

**Visitor Types:** `guest`, `vendor`, `contractor`, `consultant`, `candidate`

---

### 5. Notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
```

**Notification Types:** 
- `visitor_arrival`
- `meeting_reminder`
- `meeting_cancelled`
- `visitor_waiting`
- `meeting_expiring`

**Channels:** `email`, `sms`, `whatsapp`, `push`, `in_app`

---

### 6. Audit Logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(created_at);
```

---

### 7. Blacklist
```sql
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    phone VARCHAR(20),
    name VARCHAR(255),
    reason TEXT NOT NULL,
    added_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blacklist_email ON blacklist(email) WHERE is_active = true;
CREATE INDEX idx_blacklist_phone ON blacklist(phone) WHERE is_active = true;
```

---

### 8. Settings
```sql
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Settings:**
```json
{
  "meeting_reminder_minutes": 30,
  "qr_expiry_hours": 24,
  "max_visitors_per_meeting": 10,
  "working_hours_start": "09:00",
  "working_hours_end": "18:00",
  "enable_whatsapp": true,
  "enable_sms": false
}
```

---

## Relationships

1. **Users ↔ Meetings**: One-to-Many (One user hosts many meetings)
2. **Meetings ↔ Visitors**: One-to-Many (One meeting has many visitors)
3. **Users ↔ Departments**: Many-to-One (Many users in one department)
4. **Users ↔ Notifications**: One-to-Many (One user receives many notifications)
5. **Users ↔ Audit Logs**: One-to-Many (One user performs many actions)

---

## Indexes Strategy

- **Primary Keys**: Clustered indexes on all `id` fields
- **Foreign Keys**: Indexed for JOIN optimization
- **Search Fields**: `its_id`, `email`, `qr_code`
- **Time-based**: `meeting_time`, `check_in_time`, `created_at`
- **Status Fields**: For filtering active/completed records

---

## Performance Optimization

1. **Partitioning**: Partition `audit_logs` by month
2. **Archiving**: Move old meetings (>6 months) to archive table
3. **Materialized Views**: For analytics dashboard queries
4. **Connection Pooling**: Max 20 connections
5. **Query Caching**: Redis cache for frequent queries

---

## Backup Strategy

- **Frequency**: Daily full backup at 2 AM
- **Retention**: 30 days
- **Point-in-Time Recovery**: Enabled (7 days)
- **Replication**: Standby replica for high availability

---

## Migration Scripts

See `/backend/src/database/migrations/` for all migration files.

```bash
# Run migrations
npm run migrate

# Rollback
npm run migrate:rollback

# Create new migration
npm run migrate:create <migration_name>
```
