import { Knex } from 'knex';

/**
 * Migration: Internal Meeting Room Booking System
 * - Creates meeting_rooms table (floor, capacity, equipment)
 * - Creates internal_meeting_participants table (staff QR codes)
 * - Adds meeting_type and meeting_room_id to meetings table
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create meeting_rooms table
  await knex.schema.createTable('meeting_rooms', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('code', 20).notNullable().unique(); // e.g., "CR-3A", "MR-5B"
    table.integer('floor_number').notNullable();
    table.string('building', 100);
    table.integer('capacity').notNullable();
    table.jsonb('equipment').defaultTo('{}'); // {"projector": true, "whiteboard": true}
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['floor_number']);
    table.index(['building']);
    table.index(['is_active']);
  });

  // 2. Create internal_meeting_participants table
  await knex.schema.createTable('internal_meeting_participants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('meeting_id').notNullable().references('id').inTable('meetings').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('qr_code').unique();
    table.timestamp('qr_code_expires_at');
    table.timestamp('check_in_time');
    table.timestamp('check_out_time');
    table.string('badge_number', 50);
    table.boolean('is_organizer').defaultTo(false); // Meeting organizer flag
    table.string('status', 50).defaultTo('invited'); // invited, confirmed, declined, checked_in
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['meeting_id']);
    table.index(['user_id']);
    table.index(['status']);
    table.unique(['meeting_id', 'user_id']); // Prevent duplicate participants
  });

  // 3. Add meeting_type and meeting_room_id to meetings table
  await knex.schema.alterTable('meetings', (table) => {
    table.string('meeting_type', 50).defaultTo('external'); // 'external' | 'internal'
    table.uuid('meeting_room_id').references('id').inTable('meeting_rooms').onDelete('SET NULL');
    
    table.index(['meeting_type']);
    table.index(['meeting_room_id']);
  });

  // 4. Create participant_conflicts table (track override history)
  await knex.schema.createTable('participant_conflicts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('new_meeting_id').notNullable().references('id').inTable('meetings').onDelete('CASCADE');
    table.uuid('conflicting_meeting_id').notNullable().references('id').inTable('meetings').onDelete('CASCADE');
    table.uuid('participant_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('override_approved').defaultTo(false);
    table.uuid('approved_by').references('id').inTable('users'); // Who approved the override
    table.text('override_reason');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['new_meeting_id']);
    table.index(['conflicting_meeting_id']);
    table.index(['participant_user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('participant_conflicts');
  
  await knex.schema.alterTable('meetings', (table) => {
    table.dropColumn('meeting_type');
    table.dropColumn('meeting_room_id');
  });

  await knex.schema.dropTableIfExists('internal_meeting_participants');
  await knex.schema.dropTableIfExists('meeting_rooms');
}
