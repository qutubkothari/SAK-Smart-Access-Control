const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'Secretary123!';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  // Test the hash
  const isValid = await bcrypt.compare(password, hash);
  console.log('Verification:', isValid);
  
  // Generate SQL
  console.log('\n--- SQL to update secretaries ---');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE its_id IN ('ITS200001', 'ITS200002', 'ITS200003');`);
}

generateHash();
