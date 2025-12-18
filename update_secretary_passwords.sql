-- Update secretary passwords to Secretary123!
-- This hash was generated with bcrypt.hash('Secretary123!', 10) in Node.js

UPDATE users 
SET password_hash = '$2a$10$niVPYAnJrOgW8eRGwaVBG.vQbALeY5ZC5rAE/Ha7EoSZ5ne2L9w0q'
WHERE its_id IN ('ITS200001', 'ITS200002', 'ITS200003');

-- Verify the update
SELECT its_id, name, role, 
       LEFT(password_hash, 20) as hash_preview,
       is_active 
FROM users 
WHERE its_id IN ('ITS200001', 'ITS200002', 'ITS200003');
