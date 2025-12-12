import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Create additional departments
  const departments = [
    { name: 'Engineering', code: 'ENG', building: 'Tech Tower', floor_number: 3 },
    { name: 'Sales', code: 'SALES', building: 'Main Building', floor_number: 2 },
    { name: 'HR', code: 'HR', building: 'Main Building', floor_number: 1 },
    { name: 'Finance', code: 'FIN', building: 'Admin Block', floor_number: 4 },
    { name: 'Marketing', code: 'MKT', building: 'Tech Tower', floor_number: 5 }
  ];

  const deptIds: Record<string, string> = {};
  
  for (const dept of departments) {
    const [existing] = await knex('departments')
      .where('code', dept.code)
      .select('id');
    
    if (existing) {
      deptIds[dept.code] = existing.id;
    } else {
      const [inserted] = await knex('departments')
        .insert(dept)
        .returning('id');
      deptIds[dept.code] = inserted.id;
    }
  }

  // Create test host users
  const password = await bcrypt.hash('Test123!', 10);
  
  const hosts = [
    {
      its_id: 'ITS100001',
      email: 'john.doe@company.com',
      name: 'John Doe',
      phone: '+919876543210',
      role: 'host',
      department_id: deptIds['ENG']
    },
    {
      its_id: 'ITS100002',
      email: 'jane.smith@company.com',
      name: 'Jane Smith',
      phone: '+919876543211',
      role: 'host',
      department_id: deptIds['SALES']
    },
    {
      its_id: 'ITS100003',
      email: 'robert.wilson@company.com',
      name: 'Robert Wilson',
      phone: '+919876543212',
      role: 'host',
      department_id: deptIds['HR']
    },
    {
      its_id: 'ITS100004',
      email: 'sarah.johnson@company.com',
      name: 'Sarah Johnson',
      phone: '+919876543213',
      role: 'host',
      department_id: deptIds['FIN']
    },
    {
      its_id: 'ITS100005',
      email: 'michael.brown@company.com',
      name: 'Michael Brown',
      phone: '+919876543214',
      role: 'host',
      department_id: deptIds['MKT']
    },
    {
      its_id: 'ITS100006',
      email: 'emily.davis@company.com',
      name: 'Emily Davis',
      phone: '+919876543215',
      role: 'host',
      department_id: deptIds['ENG']
    },
    {
      its_id: 'ITS100007',
      email: 'david.miller@company.com',
      name: 'David Miller',
      phone: '+919876543216',
      role: 'host',
      department_id: deptIds['SALES']
    },
    {
      its_id: 'ITS100008',
      email: 'lisa.anderson@company.com',
      name: 'Lisa Anderson',
      phone: '+919876543217',
      role: 'host',
      department_id: deptIds['HR']
    }
  ];

  for (const host of hosts) {
    await knex('users')
      .insert({
        ...host,
        password_hash: password,
        is_active: true
      })
      .onConflict('its_id')
      .ignore();
  }

  // Get some user IDs for creating test meetings
  const [user1] = await knex('users').where('its_id', 'ITS100001').select('id');

  // Create a test meeting
  const meetingTime = new Date();
  meetingTime.setHours(meetingTime.getHours() + 2);

  const [meeting] = await knex('meetings')
    .insert({
      host_id: user1.id,
      meeting_time: meetingTime.toISOString(),
      duration_minutes: 60,
      location: 'Tech Tower, Floor 3, Engineering',
      purpose: 'Project Discussion',
      status: 'scheduled'
    })
    .returning('id')
    .onConflict()
    .ignore();

  // Add test visitor records (past visitors for lookup)
  if (meeting) {
    const visitors = [
      {
        name: 'Amit Kumar',
        email: 'amit.kumar@external.com',
        phone: '+919123456789',
        company: 'TechCorp Solutions',
        meeting_id: meeting.id,
        qr_code: 'test_qr_1',
        qr_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        visitor_type: 'vendor'
      },
      {
        name: 'Priya Sharma',
        email: 'priya.sharma@consulting.com',
        phone: '+919123456790',
        company: 'Business Consultants Inc',
        meeting_id: meeting.id,
        qr_code: 'test_qr_2',
        qr_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        visitor_type: 'contractor'
      },
      {
        name: 'Rajesh Patel',
        email: 'rajesh.patel@partners.com',
        phone: '+919123456791',
        company: 'Strategic Partners Ltd',
        meeting_id: meeting.id,
        qr_code: 'test_qr_3',
        qr_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        visitor_type: 'vip'
      }
    ];

    for (const visitor of visitors) {
      await knex('visitors')
        .insert(visitor)
        .onConflict('qr_code')
        .ignore();
    }
  }

  console.log('✅ Test data seeded successfully!');
  console.log('');
  console.log('Test Hosts created (Password: Test123! for all):');
  console.log('1. John Doe (ITS100001) - Engineering');
  console.log('2. Jane Smith (ITS100002) - Sales');
  console.log('3. Robert Wilson (ITS100003) - HR');
  console.log('4. Sarah Johnson (ITS100004) - Finance');
  console.log('5. Michael Brown (ITS100005) - Marketing');
  console.log('6. Emily Davis (ITS100006) - Engineering');
  console.log('7. David Miller (ITS100007) - Sales');
  console.log('8. Lisa Anderson (ITS100008) - HR');
  console.log('');
  console.log('Test Visitors (for lookup testing):');
  console.log('1. Amit Kumar (+919123456789) - TechCorp Solutions');
  console.log('2. Priya Sharma (+919123456790) - Business Consultants Inc');
  console.log('3. Rajesh Patel (+919123456791) - Strategic Partners Ltd');
}
