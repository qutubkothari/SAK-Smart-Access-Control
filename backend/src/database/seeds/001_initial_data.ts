import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Insert default department
  const [department] = await knex('departments')
    .insert({
      name: 'General',
      code: 'GEN',
      building: 'Main Building'
    })
    .returning('id')
    .onConflict('code')
    .ignore();

  // Create admin user with password: Admin123!
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  
  await knex('users')
    .insert({
      its_id: 'ITS000001',
      email: 'admin@sak-access.com',
      password_hash: adminPassword,
      name: 'System Administrator',
      role: 'admin',
      department_id: department?.id || null,
      is_active: true
    })
    .onConflict('its_id')
    .ignore();

  // Create receptionist user
  const receptionistPassword = await bcrypt.hash('Reception123!', 10);
  
  await knex('users')
    .insert({
      its_id: 'ITS000002',
      email: 'reception@sak-access.com',
      password_hash: receptionistPassword,
      name: 'Reception Desk',
      role: 'receptionist',
      department_id: department?.id || null,
      is_active: true
    })
    .onConflict('its_id')
    .ignore();

  // Insert default settings
  const settings = [
    {
      key: 'meeting_reminder_minutes',
      value: JSON.stringify(30),
      description: 'Minutes before meeting to send reminder',
      is_public: true
    },
    {
      key: 'qr_expiry_hours',
      value: JSON.stringify(24),
      description: 'Hours before QR code expires',
      is_public: true
    },
    {
      key: 'max_visitors_per_meeting',
      value: JSON.stringify(10),
      description: 'Maximum visitors allowed per meeting',
      is_public: true
    },
    {
      key: 'working_hours_start',
      value: JSON.stringify('09:00'),
      description: 'Working hours start time',
      is_public: true
    },
    {
      key: 'working_hours_end',
      value: JSON.stringify('18:00'),
      description: 'Working hours end time',
      is_public: true
    },
    {
      key: 'enable_whatsapp',
      value: JSON.stringify(true),
      description: 'Enable WhatsApp notifications',
      is_public: false
    },
    {
      key: 'enable_sms',
      value: JSON.stringify(false),
      description: 'Enable SMS notifications',
      is_public: false
    }
  ];

  for (const setting of settings) {
    await knex('settings')
      .insert(setting)
      .onConflict('key')
      .ignore();
  }

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Default users created:');
  console.log('1. Admin:');
  console.log('   ITS ID: ITS000001');
  console.log('   Email: admin@sak-access.com');
  console.log('   Password: Admin123!');
  console.log('');
  console.log('2. Receptionist:');
  console.log('   ITS ID: ITS000002');
  console.log('   Email: reception@sak-access.com');
  console.log('   Password: Reception123!');
  console.log('');
  console.log('⚠️  Please change these passwords after first login!');
}
