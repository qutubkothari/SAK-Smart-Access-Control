const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function testAnalytics() {
  try {
    console.log('=== Testing SAK Analytics Features ===\n');

    // 1. Login to get token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      its_id: 'ITS0001',
      password: 'Admin@123'
    });
    
    if (!loginResponse.data.success) {
      console.log('Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✓ Login successful\n');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Test System Analytics
    console.log('2. Testing System Analytics (Last 30 days)...');
    const systemAnalytics = await axios.get(`${BASE_URL}/analytics/system?period=30`, { headers });
    console.log('✓ System Analytics Response:');
    console.log(JSON.stringify(systemAnalytics.data, null, 2));
    console.log('\n');

  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAnalytics();
