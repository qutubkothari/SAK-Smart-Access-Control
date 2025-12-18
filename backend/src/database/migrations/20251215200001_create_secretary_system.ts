import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add secretary role if not exists
  await knex.raw(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
      ) THEN
        CREATE TYPE user_role AS ENUM ('admin', 'host', 'receptionist', 'secretary', 'employee');
      ELSE
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
      END IF;
    END $$;
  `);

  // Create secretary_employee_assignments table
  await knex.schema.createTable('secretary_employee_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('secretary_id').notNullable();
    table.uuid('employee_id').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table.uuid('assigned_by').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('secretary_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('assigned_by').references('id').inTable('users').onDelete('SET NULL');

    // Indexes
    table.index('secretary_id');
    table.index('employee_id');
    table.index('is_active');

    // Unique constraint: one employee can only be assigned to one secretary at a time
    table.unique(['employee_id', 'is_active']);
  });

  // Create employee_availability_blocks table (for employees to block their own time)
  await knex.schema.createTable('employee_availability_blocks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.string('reason', 255).nullable();
    table.string('block_type').defaultTo('busy'); // 'busy', 'out_of_office', 'do_not_disturb'
    table.boolean('is_recurring').defaultTo(false);
    table.string('recurrence_pattern').nullable(); // 'daily', 'weekly', 'monthly'
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');

    // Indexes
    table.index('employee_id');
    table.index('start_time');
    table.index('end_time');
    table.index(['employee_id', 'start_time', 'end_time']);
  });

  // Add secretary_id to meetings table to track who booked on behalf
  await knex.schema.table('meetings', (table) => {
    table.uuid('booked_by_secretary_id').nullable();
    table.foreign('booked_by_secretary_id').references('id').inTable('users').onDelete('SET NULL');
    table.index('booked_by_secretary_id');
  });

  // Add employee_id to internal_meeting_participants to track primary employee
  await knex.schema.table('internal_meeting_participants', (table) => {
    table.boolean('is_primary_employee').defaultTo(false).comment('True if this is the employee the meeting was booked for');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.table('internal_meeting_participants', (table) => {
    table.dropColumn('is_primary_employee');
  });

  await knex.schema.table('meetings', (table) => {
    table.dropForeign(['booked_by_secretary_id']);
    table.dropColumn('booked_by_secretary_id');
  });

  await knex.schema.dropTableIfExists('employee_availability_blocks');
  await knex.schema.dropTableIfExists('secretary_employee_assignments');
}
