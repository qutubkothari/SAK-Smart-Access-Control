import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // 1. Create Access Points
  await knex('access_points').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Main Entrance',
      code: 'MAIN_ENTRY',
      location: 'Ground Floor Main Door',
      floor_number: 0,
      building: 'Main',
      zone: 'Reception',
      point_type: 'entry',
      requires_nfc: true,
      requires_qr: true,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Main Exit',
      code: 'MAIN_EXIT',
      location: 'Ground Floor Main Door',
      floor_number: 0,
      building: 'Main',
      zone: 'Reception',
      point_type: 'exit',
      requires_nfc: true,
      requires_qr: true,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Floor 1 Elevator',
      code: 'FLOOR_1_LIFT',
      location: 'First Floor Elevator',
      floor_number: 1,
      building: 'Main',
      point_type: 'elevator',
      requires_nfc: true,
      requires_qr: true,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Floor 2 Elevator',
      code: 'FLOOR_2_LIFT',
      location: 'Second Floor Elevator',
      floor_number: 2,
      building: 'Main',
      point_type: 'elevator',
      requires_nfc: true,
      requires_qr: true,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Floor 3 Elevator',
      code: 'FLOOR_3_LIFT',
      location: 'Third Floor Elevator',
      floor_number: 3,
      building: 'Main',
      point_type: 'elevator',
      requires_nfc: true,
      requires_qr: true,
      is_active: true
    }
  ]);

  // 2. Create Default Attendance Shifts
  await knex('attendance_shifts').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'General Shift (9 AM - 6 PM)',
      start_time: '09:00:00',
      end_time: '18:00:00',
      grace_period_minutes: 15,
      break_duration_minutes: 60,
      break_start_time: '13:00:00',
      break_end_time: '14:00:00',
      is_default: true,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Early Shift (8 AM - 5 PM)',
      start_time: '08:00:00',
      end_time: '17:00:00',
      grace_period_minutes: 15,
      break_duration_minutes: 60,
      break_start_time: '12:00:00',
      break_end_time: '13:00:00',
      is_default: false,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Late Shift (10 AM - 7 PM)',
      start_time: '10:00:00',
      end_time: '19:00:00',
      grace_period_minutes: 15,
      break_duration_minutes: 60,
      break_start_time: '14:00:00',
      break_end_time: '15:00:00',
      is_default: false,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Flexible Shift',
      start_time: '09:00:00',
      end_time: '18:00:00',
      grace_period_minutes: 30,
      break_duration_minutes: 60,
      is_default: false,
      is_active: true
    }
  ]);

  // 3. Grant all employees access to their department floors (example)
  const employees = await knex('users')
    .where('role', 'employee')
    .orWhere('role', 'host')
    .select('id', 'department_id');

  const departments = await knex('departments')
    .select('id', 'floor_number');

  const floorAccessRecords = [];
  for (const emp of employees) {
    const dept = departments.find(d => d.id === emp.department_id);
    if (dept && dept.floor_number) {
      floorAccessRecords.push({
        id: knex.raw('gen_random_uuid()'),
        employee_id: emp.id,
        floor_number: dept.floor_number,
        building: 'Main',
        access_type: 'permanent',
        is_active: true
      });
      
      // Also grant access to ground floor for entry/exit
      floorAccessRecords.push({
        id: knex.raw('gen_random_uuid()'),
        employee_id: emp.id,
        floor_number: 0,
        building: 'Main',
        access_type: 'permanent',
        is_active: true
      });
    }
  }

  if (floorAccessRecords.length > 0) {
    await knex('employee_floor_access').insert(floorAccessRecords);
  }

  // 4. Assign default shifts to all employees
  const defaultShift = await knex('attendance_shifts')
    .where('is_default', true)
    .first();

  if (defaultShift) {
    const shiftAssignments = employees.map(emp => ({
      id: knex.raw('gen_random_uuid()'),
      employee_id: emp.id,
      shift_id: defaultShift.id,
      effective_from: knex.raw('CURRENT_DATE'),
      is_active: true
    }));

    if (shiftAssignments.length > 0) {
      await knex('employee_shifts').insert(shiftAssignments);
    }
  }

  // 5. Setup department shift configurations
  const allDepartments = await knex('departments').select('id');
  
  if (defaultShift && allDepartments.length > 0) {
    const deptConfigs = allDepartments.map(dept => ({
      id: knex.raw('gen_random_uuid()'),
      department_id: dept.id,
      default_shift_id: defaultShift.id,
      working_days: '{1,2,3,4,5,6}', // Monday to Saturday
      weekend_days: '{0}', // Sunday
      flexible_timing: false,
      track_breaks: true,
      require_approval_overtime: true
    }));

    await knex('department_shift_config').insert(deptConfigs);
  }

  // 6. Add common holidays for current year
  await knex('holidays').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Sunday (Weekly Holiday)',
      date: '2025-12-21',
      description: 'Weekly off day',
      is_optional: false,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Christmas',
      date: '2025-12-25',
      description: 'Christmas Day',
      is_optional: false,
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'New Year 2026',
      date: '2026-01-01',
      description: 'New Year Day',
      is_optional: false,
      is_active: true
    }
  ]);
}
