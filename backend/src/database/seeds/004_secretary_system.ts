import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Create secretary users
  const secretaries = [
    {
      id: knex.raw('gen_random_uuid()'),
      its_id: 'ITS200001',
      name: 'Ana Martinez',
      email: 'ana.martinez@company.com',
      phone: '+919876540001',
      role: 'secretary',
      password_hash: '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', // Secretary123!
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      its_id: 'ITS200002',
      name: 'Joe Thompson',
      email: 'joe.thompson@company.com',
      phone: '+919876540002',
      role: 'secretary',
      password_hash: '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', // Secretary123!
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      its_id: 'ITS200003',
      name: 'Linda Chen',
      email: 'linda.chen@company.com',
      phone: '+919876540003',
      role: 'secretary',
      password_hash: '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', // Secretary123!
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  // Create employee users (ITS300001 - ITS300015)
  const employees = [];
  const employeeNames = [
    'Alex Johnson', 'Maria Garcia', 'Chris Lee', 'Patricia Davis', 'James Wilson',
    'Jennifer Taylor', 'Robert Anderson', 'Michelle Thomas', 'Daniel Martinez',
    'Jessica Robinson', 'Matthew Clark', 'Ashley Rodriguez', 'Andrew Lewis',
    'Stephanie Walker', 'Joshua Hall'
  ];

  for (let i = 0; i < 15; i++) {
    employees.push({
      id: knex.raw('gen_random_uuid()'),
      its_id: `ITS30000${i + 1}`.slice(0, 10), // ITS300001 to ITS300015
      name: employeeNames[i],
      email: `employee${i + 1}@company.com`,
      phone: `+9198765400${10 + i}`,
      role: 'employee',
      password_hash: '$2a$10$yG3L8KvFxQZPKH.WxI3dbuCqQYvJxRQZxQOQvRX0KvJxRQZxQOQvR', // Employee123!
      is_active: true,
      department_id: null,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // Insert secretaries and employees
  for (const secretary of secretaries) {
    await knex('users')
      .insert(secretary)
      .onConflict('its_id')
      .ignore();
  }
  
  for (const employee of employees) {
    await knex('users')
      .insert(employee)
      .onConflict('its_id')
      .ignore();
  }

  // Get inserted IDs for assignments
  const anaId = await knex('users').where({ its_id: 'ITS200001' }).select('id').first();
  const joeId = await knex('users').where({ its_id: 'ITS200002' }).select('id').first();
  const lindaId = await knex('users').where({ its_id: 'ITS200003' }).select('id').first();

  const employeeRecords = await knex('users')
    .whereIn('its_id', employees.map((_, i) => `ITS30000${i + 1}`.slice(0, 10)))
    .select('id', 'its_id');

  // Create assignments
  const assignments = [];

  // Ana manages employees 1-5 (ITS300001 to ITS300005)
  for (let i = 0; i < 5; i++) {
    const emp = employeeRecords.find(e => e.its_id === `ITS30000${i + 1}`.slice(0, 10));
    if (emp) {
      assignments.push({
        id: knex.raw('gen_random_uuid()'),
        secretary_id: anaId.id,
        employee_id: emp.id,
        is_active: true,
        assigned_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  // Joe manages employees 1, 3, 7, 8, 9 (ITS300001, ITS300003, ITS300007, ITS300008, ITS300009)
  const joeEmployeeIndices = [0, 2, 6, 7, 8];
  for (const i of joeEmployeeIndices) {
    const emp = employeeRecords.find(e => e.its_id === `ITS30000${i + 1}`.slice(0, 10));
    if (emp) {
      assignments.push({
        id: knex.raw('gen_random_uuid()'),
        secretary_id: joeId.id,
        employee_id: emp.id,
        is_active: true,
        assigned_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  // Linda manages employees 10-15 (ITS300010 to ITS300015)
  for (let i = 9; i < 15; i++) {
    const emp = employeeRecords.find(e => e.its_id === `ITS30000${i + 1}`.slice(0, 10));
    if (emp) {
      assignments.push({
        id: knex.raw('gen_random_uuid()'),
        secretary_id: lindaId.id,
        employee_id: emp.id,
        is_active: true,
        assigned_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  // Insert assignments
  if (assignments.length > 0) {
    await knex('secretary_employee_assignments').insert(assignments);
  }
}
