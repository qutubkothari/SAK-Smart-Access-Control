import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add multi-day visit support to meetings table
  await knex.schema.alterTable('meetings', (table) => {
    table.date('visit_start_date');
    table.date('visit_end_date');
    table.boolean('is_multi_day').defaultTo(false);
  });

  // Add multi-day tracking to visitors table
  await knex.schema.alterTable('visitors', (table) => {
    table.date('access_valid_from');
    table.date('access_valid_until');
    table.boolean('multi_day_access').defaultTo(false);
  });

  // Create visitor_access_log table for multiple entries tracking
  await knex.schema.createTable('visitor_access_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('visitor_id').notNullable().references('id').inTable('visitors').onDelete('CASCADE');
    table.uuid('meeting_id').notNullable().references('id').inTable('meetings').onDelete('CASCADE');
    table.timestamp('entry_time').notNullable();
    table.timestamp('exit_time');
    table.string('entry_point', 100);
    table.uuid('checked_in_by').references('id').inTable('users');
    table.uuid('checked_out_by').references('id').inTable('users');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['visitor_id']);
    table.index(['meeting_id']);
    table.index(['entry_time']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('visitor_access_log');
  
  await knex.schema.alterTable('meetings', (table) => {
    table.dropColumn('visit_start_date');
    table.dropColumn('visit_end_date');
    table.dropColumn('is_multi_day');
  });

  await knex.schema.alterTable('visitors', (table) => {
    table.dropColumn('access_valid_from');
    table.dropColumn('access_valid_until');
    table.dropColumn('multi_day_access');
  });
}
