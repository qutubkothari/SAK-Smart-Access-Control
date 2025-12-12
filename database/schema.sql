-- SAK Smart Access Control - Complete Database Schema
-- PostgreSQL 14+
-- Run this file to create all tables manually (or use npm run migrate)

-- =====================================================
-- 1. DEPARTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    manager_id UUID,
    floor_number INTEGER,
    building VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_role CHECK (role IN ('admin', 'security', 'receptionist', 'host'))
);

-- Add foreign key for manager
ALTER TABLE departments 
ADD CONSTRAINT fk_department_manager 
FOREIGN KEY (manager_id) REFERENCES users(id);

-- =====================================================
-- 3. MEETINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meetings (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
);

-- =====================================================
-- 4. VISITORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS visitors (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_visitor_type CHECK (visitor_type IN ('guest', 'vendor', 'contractor', 'consultant', 'candidate'))
);

-- =====================================================
-- 5. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_notification_type CHECK (type IN ('visitor_arrival', 'meeting_reminder', 'meeting_cancelled', 'visitor_waiting', 'meeting_expiring')),
    CONSTRAINT check_channel CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
);

-- =====================================================
-- 6. AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_status_audit CHECK (status IN ('success', 'failure', 'error'))
);

-- =====================================================
-- 7. BLACKLIST TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS blacklist (
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

-- =====================================================
-- 8. SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_its_id ON users(its_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(meeting_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_qr_hash ON meetings(qr_code_hash);

-- Visitors indexes
CREATE INDEX IF NOT EXISTS idx_visitors_meeting ON visitors(meeting_id);
CREATE INDEX IF NOT EXISTS idx_visitors_email ON visitors(email);
CREATE INDEX IF NOT EXISTS idx_visitors_qr ON visitors(qr_code);
CREATE INDEX IF NOT EXISTS idx_visitors_check_in ON visitors(check_in_time);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(created_at);

-- Blacklist indexes
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone) WHERE is_active = true;

-- =====================================================
-- DEFAULT DATA / SEED DATA
-- =====================================================

-- Insert default department
INSERT INTO departments (name, code, building) 
VALUES ('General', 'GEN', 'Main Building')
ON CONFLICT (code) DO NOTHING;

-- Insert default admin user
-- Password: Admin123! (hashed with bcrypt, 10 rounds)
INSERT INTO users (its_id, email, password_hash, name, role, department_id)
VALUES (
    'ITS000001',
    'admin@sak-access.com',
    '$2a$10$YourBcryptHashHere',  -- Replace with actual hash
    'System Administrator',
    'admin',
    (SELECT id FROM departments WHERE code = 'GEN')
)
ON CONFLICT (its_id) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value, description, is_public) VALUES
('meeting_reminder_minutes', '30', 'Minutes before meeting to send reminder', true),
('qr_expiry_hours', '24', 'Hours before QR code expires', true),
('max_visitors_per_meeting', '10', 'Maximum visitors allowed per meeting', true),
('working_hours_start', '"09:00"', 'Working hours start time', true),
('working_hours_end', '"18:00"', 'Working hours end time', true),
('enable_whatsapp', 'true', 'Enable WhatsApp notifications', false),
('enable_sms', 'false', 'Enable SMS notifications', false)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blacklist_updated_at BEFORE UPDATE ON blacklist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active visitors view
CREATE OR REPLACE VIEW active_visitors AS
SELECT 
    v.id,
    v.name,
    v.email,
    v.company,
    v.check_in_time,
    m.location,
    m.meeting_time,
    u.name as host_name,
    u.email as host_email
FROM visitors v
JOIN meetings m ON v.meeting_id = m.id
JOIN users u ON m.host_id = u.id
WHERE v.check_in_time IS NOT NULL 
  AND v.check_out_time IS NULL;

-- Today's meetings view
CREATE OR REPLACE VIEW todays_meetings AS
SELECT 
    m.id,
    m.meeting_time,
    m.location,
    m.status,
    u.name as host_name,
    u.email as host_email,
    COUNT(v.id) as visitor_count
FROM meetings m
JOIN users u ON m.host_id = u.id
LEFT JOIN visitors v ON m.id = v.meeting_id
WHERE DATE(m.meeting_time) = CURRENT_DATE
GROUP BY m.id, u.name, u.email;

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Grant all permissions to sak_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sak_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sak_user;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📊 Tables created: 8';
    RAISE NOTICE '🔍 Indexes created: 20+';
    RAISE NOTICE '⚡ Triggers created: 6';
    RAISE NOTICE '👁️  Views created: 2';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '1. Update admin password hash in users table';
    RAISE NOTICE '2. Run: npm run migrate (if using migrations)';
    RAISE NOTICE '3. Start your application';
END $$;
