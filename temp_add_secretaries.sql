-- Add secretary users (Password: Secretary123!)
-- Hash generated with: bcrypt.hash('Secretary123!', 10)
INSERT INTO users (its_id, email, name, phone, role, password_hash, is_active, created_at, updated_at)
VALUES 
  ('ITS200001', 'ana.martinez@company.com', 'Ana Martinez', '+919876540001', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true, NOW(), NOW()),
  ('ITS200002', 'joe.thompson@company.com', 'Joe Thompson', '+919876540002', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true, NOW(), NOW()),
  ('ITS200003', 'linda.chen@company.com', 'Linda Chen', '+919876540003', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true, NOW(), NOW())
ON CONFLICT (its_id) DO NOTHING;
