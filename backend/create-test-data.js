const knexConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './src/database/migrations'
  }
};

const knex = require('knex')(knexConfig);

async function createTestData() {
  try {
    // Get admin user
    const [host] = await knex('users').where('email', 'admin@sak-access.com').select('id');
    
    if (!host) {
      console.log('❌ Admin user not found');
      await knex.destroy();
      return;
    }

    // Create a meeting for today
    const meetingTime = new Date();
    meetingTime.setHours(meetingTime.getHours() + 2);

    const [meeting] = await knex('meetings').insert({
      host_id: host.id,
      meeting_time: meetingTime.toISOString(),
      duration_minutes: 60,
      location: 'Conference Room A',
      purpose: 'Product Demo',
      status: 'scheduled'
    }).returning('*');

    console.log('✅ Meeting created:', meeting.id);

    // Create a visitor for the meeting
    await knex('visitors').insert({
      meeting_id: meeting.id,
      name: 'Test Visitor',
      email: 'test@visitor.com',
      phone: '+919999999999',
      company: 'Test Corp',
      qr_code: 'test_qr_' + Date.now(),
      qr_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      visitor_type: 'guest'
    });

    console.log('✅ Visitor created for meeting');

    // Create a checked-in visitor
    const meetingTime2 = new Date();
    meetingTime2.setHours(meetingTime2.getHours() + 1);

    const [meeting2] = await knex('meetings').insert({
      host_id: host.id,
      meeting_time: meetingTime2.toISOString(),
      duration_minutes: 45,
      location: 'Meeting Room B',
      purpose: 'Client Meeting',
      status: 'active'
    }).returning('*');

    await knex('visitors').insert({
      meeting_id: meeting2.id,
      name: 'Active Visitor',
      email: 'active@visitor.com',
      phone: '+919888888888',
      company: 'Active Corp',
      qr_code: 'active_qr_' + Date.now(),
      qr_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      visitor_type: 'client',
      check_in_time: new Date()
    });

    console.log('✅ Active visitor created');
    console.log('✅ Test data created successfully!');

    await knex.destroy();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await knex.destroy();
    process.exit(1);
  }
}

createTestData();
