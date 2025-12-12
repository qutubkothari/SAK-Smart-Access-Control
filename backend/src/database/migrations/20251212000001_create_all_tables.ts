import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create departments table (without manager_id foreign key initially)
  await knex.schema.createTable('departments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('code', 50).notNullable().unique();
    table.uuid('manager_id');
    table.integer('floor_number');
    table.string('building', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('its_id', 50).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('name', 255).notNullable();
    table.string('phone', 20);
    table.uuid('department_id').references('id').inTable('departments');
    table.string('role', 50).notNullable().defaultTo('host');
    table.text('profile_photo_url');
    table.boolean('is_active').defaultTo(true);
    table.string('preferred_notification_channel', 20).defaultTo('email');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['its_id']);
    table.index(['email']);
    table.index(['department_id']);
    table.index(['role']);
  });

  // Create meetings table
  await knex.schema.createTable('meetings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('host_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('meeting_time').notNullable();
    table.integer('duration_minutes').defaultTo(60);
    table.string('location', 255).notNullable();
    table.string('room_number', 50);
    table.text('purpose');
    table.string('status', 50).defaultTo('scheduled');
    table.text('qr_code_url');
    table.string('qr_code_hash', 255).unique();
    table.boolean('is_recurring').defaultTo(false);
    table.jsonb('recurrence_pattern');
    table.boolean('host_checked_in').defaultTo(false);
    table.timestamp('host_check_in_time');
    table.boolean('reminder_sent').defaultTo(false);
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['host_id']);
    table.index(['meeting_time']);
    table.index(['status']);
    table.index(['qr_code_hash']);
  });

  // Create visitors table
  await knex.schema.createTable('visitors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('meeting_id').notNullable().references('id').inTable('meetings').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable();
    table.string('phone', 20).notNullable();
    table.string('company', 255);
    table.string('visitor_type', 50).defaultTo('guest');
    table.text('qr_code').notNullable().unique();
    table.timestamp('qr_code_expires_at').notNullable();
    table.timestamp('check_in_time');
    table.timestamp('check_out_time');
    table.text('photo_url');
    table.string('badge_number', 50);
    table.string('id_proof_type', 50);
    table.string('id_proof_number', 100);
    table.text('purpose_of_visit');
    table.boolean('is_blacklisted').defaultTo(false);
    table.boolean('nda_signed').defaultTo(false);
    table.timestamp('nda_signed_at');
    table.uuid('checked_in_by').references('id').inTable('users');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['meeting_id']);
    table.index(['email']);
    table.index(['qr_code']);
    table.index(['check_in_time']);
    table.index(['phone']);
  });

  // Create notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('recipient_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.string('channel', 20).notNullable();
    table.string('subject', 255);
    table.text('message').notNullable();
    table.jsonb('metadata');
    table.string('status', 50).defaultTo('pending');
    table.timestamp('sent_at');
    table.timestamp('read_at');
    table.text('error_message');
    table.integer('retry_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['recipient_id']);
    table.index(['status']);
    table.index(['type']);
    table.index(['created_at']);
  });

  // Create audit_logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('entity_type', 50).notNullable();
    table.uuid('entity_id');
    table.string('ip_address', 45);
    table.text('user_agent');
    table.jsonb('request_data');
    table.jsonb('response_data');
    table.string('status', 20).defaultTo('success');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['action']);
    table.index(['entity_type', 'entity_id']);
    table.index(['created_at']);
  });

  // Create blacklist table
  await knex.schema.createTable('blacklist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255);
    table.string('phone', 20);
    table.string('name', 255);
    table.text('reason').notNullable();
    table.uuid('added_by').references('id').inTable('users');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['email'], 'idx_blacklist_email');
    table.index(['phone'], 'idx_blacklist_phone');
  });

  // Create settings table
  await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 100).notNullable().unique();
    table.jsonb('value').notNullable();
    table.text('description');
    table.boolean('is_public').defaultTo(false);
    table.uuid('updated_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Add foreign key constraint to departments table after users table exists
  await knex.schema.alterTable('departments', (table) => {
    table.foreign('manager_id').references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('blacklist');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('visitors');
  await knex.schema.dropTableIfExists('meetings');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('departments');
}
