import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Attendance Shifts
  await knex.schema.createTable('attendance_shifts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable(); // e.g., 'Morning Shift', 'Night Shift'
    table.time('start_time').notNullable(); // e.g., '09:00:00'
    table.time('end_time').notNullable();   // e.g., '18:00:00'
    table.integer('grace_period_minutes').defaultTo(15); // Late check-in grace period
    table.integer('break_duration_minutes').defaultTo(60); // Lunch break
    table.time('break_start_time'); // e.g., '13:00:00'
    table.time('break_end_time');   // e.g., '14:00:00'
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.uuid('department_id'); // Optional: shift can be department-specific
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
    table.index('is_default');
    table.index('is_active');
    table.index('department_id');
  });

  // 2. Employee Shift Assignments
  await knex.schema.createTable('employee_shifts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.uuid('shift_id').notNullable();
    table.date('effective_from').notNullable();
    table.date('effective_until'); // NULL = indefinite
    table.boolean('is_active').defaultTo(true);
    table.uuid('assigned_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('shift_id').references('id').inTable('attendance_shifts').onDelete('RESTRICT');
    table.foreign('assigned_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('employee_id');
    table.index('shift_id');
    table.index('effective_from');
    table.index(['employee_id', 'is_active']);
  });

  // 3. Attendance Records (Daily summary)
  await knex.schema.createTable('attendance_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.uuid('shift_id'); // Shift applicable on this day
    table.date('date').notNullable();
    table.timestamp('first_check_in');
    table.timestamp('last_check_out');
    table.decimal('total_hours', 5, 2); // Total time spent (including breaks)
    table.decimal('work_hours', 5, 2);  // Actual work hours (excluding breaks)
    table.decimal('break_hours', 5, 2);
    table.enum('status', [
      'present',
      'absent',
      'late',
      'early_exit',
      'half_day',
      'overtime',
      'leave',
      'holiday',
      'weekend'
    ]).defaultTo('absent');
    table.time('expected_check_in'); // Expected time based on shift
    table.time('expected_check_out');
    table.boolean('is_late').defaultTo(false);
    table.integer('late_by_minutes');
    table.boolean('is_early_exit').defaultTo(false);
    table.integer('early_exit_by_minutes');
    table.integer('overtime_minutes');
    table.text('notes'); // Admin notes or employee remarks
    table.uuid('approved_by'); // For overtime approval
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('shift_id').references('id').inTable('attendance_shifts').onDelete('SET NULL');
    table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');

    table.unique(['employee_id', 'date']); // One record per employee per day
    table.index('employee_id');
    table.index('date');
    table.index('status');
    table.index(['employee_id', 'date']);
  });

  // 4. Department Shift Configuration
  await knex.schema.createTable('department_shift_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('department_id').notNullable();
    table.uuid('default_shift_id').notNullable();
    table.specificType('working_days', 'integer[]').defaultTo('{1,2,3,4,5,6}'); // 0=Sunday, 1=Monday, etc.
    table.specificType('weekend_days', 'integer[]').defaultTo('{0}'); // Sunday by default
    table.boolean('flexible_timing').defaultTo(false);
    table.boolean('track_breaks').defaultTo(true);
    table.boolean('require_approval_overtime').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('department_id').references('id').inTable('departments').onDelete('CASCADE');
    table.foreign('default_shift_id').references('id').inTable('attendance_shifts').onDelete('RESTRICT');

    table.unique('department_id');
    table.index('department_id');
  });

  // 5. Leave Management
  await knex.schema.createTable('employee_leaves', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.date('from_date').notNullable();
    table.date('to_date').notNullable();
    table.enum('leave_type', ['sick', 'casual', 'annual', 'emergency', 'unpaid']).notNullable();
    table.text('reason');
    table.enum('status', ['pending', 'approved', 'rejected', 'cancelled']).defaultTo('pending');
    table.uuid('approved_by');
    table.timestamp('approved_at');
    table.text('rejection_reason');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('employee_id');
    table.index('status');
    table.index(['from_date', 'to_date']);
  });

  // 6. Holidays
  await knex.schema.createTable('holidays', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.date('date').notNullable();
    table.text('description');
    table.boolean('is_optional').defaultTo(false);
    table.uuid('applicable_to_department'); // NULL = all departments
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('applicable_to_department').references('id').inTable('departments').onDelete('SET NULL');

    table.index('date');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('holidays');
  await knex.schema.dropTableIfExists('employee_leaves');
  await knex.schema.dropTableIfExists('department_shift_config');
  await knex.schema.dropTableIfExists('attendance_records');
  await knex.schema.dropTableIfExists('employee_shifts');
  await knex.schema.dropTableIfExists('attendance_shifts');
}
