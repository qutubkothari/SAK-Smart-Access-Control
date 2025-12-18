const jwt = require('../backend/node_modules/jsonwebtoken');

const token = jwt.sign(
  { user_id: 1, role: 'admin' },
  process.env.JWT_SECRET || 'sak_2025_ultra_secure_jwt_secret_key_change_this_in_production_mode',
  { expiresIn: '365d' }
);

console.log(token);
