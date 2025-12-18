-- Insert secretaries (3 users)
INSERT INTO users (its_id, name, email, phone, role, password_hash, is_active) VALUES
('ITS200001', 'Ana Martinez', 'ana.martinez@company.com', '+919876540001', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS200002', 'Joe Thompson', 'joe.thompson@company.com', '+919876540002', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS200003', 'Linda Chen', 'linda.chen@company.com', '+919876540003', 'secretary', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true)
ON CONFLICT (its_id) DO NOTHING;

-- Insert employees (15 users)
INSERT INTO users (its_id, name, email, phone, role, password_hash, is_active) VALUES
('ITS300001', 'Alex Johnson', 'employee1@company.com', '+919876540010', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS300002', 'Maria Garcia', 'employee2@company.com', '+919876540011', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS300003', 'Chris Lee', 'employee3@company.com', '+919876540012', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS300004', 'Patricia Davis', 'employee4@company.com', '+919876540013', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS300005', 'James Wilson', 'employee5@company.com', '+919876540014', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', true),
('ITS300006', 'Jennifer Taylor', 'employee6@company.com', '+919876540015', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300007', 'Robert Anderson', 'employee7@company.com', '+919876540016', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300008', 'Michelle Thomas', 'employee8@company.com', '+919876540017', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300009', 'Daniel Martinez', 'employee9@company.com', '+919876540018', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300010', 'Jessica Robinson', 'employee10@company.com', '+919876540019', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300011', 'Matthew Clark', 'employee11@company.com', '+919876540020', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300012', 'Ashley Rodriguez', 'employee12@company.com', '+919876540021', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300013', 'Andrew Lewis', 'employee13@company.com', '+919876540022', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300014', 'Stephanie Walker', 'employee14@company.com', '+919876540023', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true),
('ITS300015', 'Joshua Hall', 'employee15@company.com', '+919876540024', 'employee', '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvR', true)
ON CONFLICT (its_id) DO NOTHING;

-- Ana manages employees 1-5
INSERT INTO secretary_employee_assignments (secretary_id, employee_id, is_active)
SELECT 
  (SELECT id FROM users WHERE its_id = 'ITS200001'),
  u.id,
  true
FROM users u WHERE u.its_id IN ('ITS300001', 'ITS300002', 'ITS300003', 'ITS300004', 'ITS300005');

-- Joe manages employees 1, 3, 7, 8, 9
INSERT INTO secretary_employee_assignments (secretary_id, employee_id, is_active)
SELECT 
  (SELECT id FROM users WHERE its_id = 'ITS200002'),
  u.id,
  true
FROM users u WHERE u.its_id IN ('ITS300001', 'ITS300003', 'ITS300007', 'ITS300008', 'ITS300009');

-- Linda manages employees 10-15
INSERT INTO secretary_employee_assignments (secretary_id, employee_id, is_active)
SELECT 
  (SELECT id FROM users WHERE its_id = 'ITS200003'),
  u.id,
  true
FROM users u WHERE u.its_id IN ('ITS300010', 'ITS300011', 'ITS300012', 'ITS300013', 'ITS300014', 'ITS300015');

SELECT 'Secretaries:' AS info, COUNT(*) AS count FROM users WHERE role='secretary';
SELECT 'Employees:' AS info, COUNT(*) AS count FROM users WHERE role='employee';
SELECT 'Assignments:' AS info, COUNT(*) AS count FROM secretary_employee_assignments;
