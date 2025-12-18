import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Access Points (Entry/Exit points, floors, zones)
  await knex.schema.createTable('access_points', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('code', 50).unique().notNullable(); // e.g., 'MAIN_ENTRY', 'FLOOR_2_LIFT'
    table.string('location', 255);
    table.integer('floor_number');
    table.string('building', 50);
    table.string('zone', 50);
    table.enum('point_type', ['entry', 'exit', 'elevator', 'door', 'gate', 'turnstile']).notNullable();
    table.boolean('requires_nfc').defaultTo(false);
    table.boolean('requires_qr').defaultTo(false);
    table.boolean('requires_manual_approval').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('code');
    table.index('floor_number');
    table.index('building');
    table.index('is_active');
  });

  // 2. Employee Floor Access Permissions
  await knex.schema.createTable('employee_floor_access', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.integer('floor_number').notNullable();
    table.string('building', 50).defaultTo('Main');
    table.string('zone', 50);
    table.enum('access_type', ['permanent', 'temporary', 'time_based']).defaultTo('permanent');
    table.time('allowed_from_time'); // e.g., '09:00:00'
    table.time('allowed_to_time');   // e.g., '18:00:00'
    table.date('valid_from');
    table.date('valid_until');
    table.boolean('is_active').defaultTo(true);
    table.uuid('granted_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('granted_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('employee_id');
    table.index('floor_number');
    table.index('is_active');
    table.index(['employee_id', 'floor_number', 'is_active']);
  });

  // 3. Employee Access Logs (Multi-entry tracking)
  await knex.schema.createTable('employee_access_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('employee_id').notNullable();
    table.uuid('access_point_id');
    table.timestamp('entry_time').notNullable();
    table.timestamp('exit_time');
    table.enum('access_method', ['nfc', 'qr', 'manual_its', 'card_number', 'facial']).notNullable();
    table.string('card_number', 50);
    table.string('its_id', 50);
    table.integer('floor_number');
    table.string('building', 50);
    table.string('zone', 50);
    table.boolean('access_granted').defaultTo(true);
    table.string('denial_reason', 255);
    table.string('device_id', 100); // Scanner/reader device identifier
    table.uuid('authorized_by'); // If manual approval
    table.jsonb('metadata'); // Additional data (temperature, photo, etc.)
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.foreign('employee_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('access_point_id').references('id').inTable('access_points').onDelete('SET NULL');
    table.foreign('authorized_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('employee_id');
    table.index('entry_time');
    table.index('access_point_id');
    table.index('access_granted');
    table.index(['employee_id', 'entry_time']);
    table.index('card_number');
    table.index('its_id');
  });

  // 4. Visitor Access Cards (NFC card pairing for visitors)
  await knex.schema.createTable('visitor_access_cards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('visitor_id').notNullable();
    table.string('card_number', 50).unique().notNullable();
    table.enum('card_type', ['nfc', 'rfid', 'qr', 'temporary']).defaultTo('nfc');
    table.timestamp('issued_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('valid_from').notNullable();
    table.timestamp('valid_until').notNullable();
    table.specificType('allowed_floors', 'integer[]'); // e.g., [1, 2, 3]
    table.specificType('allowed_zones', 'varchar(100)[]'); // e.g., ['Zone A', 'Zone B']
    table.boolean('is_active').defaultTo(true);
    table.timestamp('deactivated_at');
    table.uuid('issued_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('visitor_id').references('id').inTable('visitors').onDelete('CASCADE');
    table.foreign('issued_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('visitor_id');
    table.index('card_number');
    table.index('is_active');
    table.index(['visitor_id', 'is_active']);
  });

  // 5. Visitor Access Logs (Track visitor movements)
  await knex.schema.createTable('visitor_floor_access_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('visitor_id').notNullable();
    table.uuid('access_point_id');
    table.uuid('card_id'); // visitor_access_cards.id
    table.timestamp('entry_time').notNullable();
    table.timestamp('exit_time');
    table.enum('access_method', ['nfc', 'qr', 'manual']).notNullable();
    table.string('card_number', 50);
    table.integer('floor_number');
    table.string('building', 50);
    table.string('zone', 50);
    table.boolean('access_granted').defaultTo(true);
    table.string('denial_reason', 255);
    table.uuid('authorized_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.foreign('visitor_id').references('id').inTable('visitors').onDelete('CASCADE');
    table.foreign('access_point_id').references('id').inTable('access_points').onDelete('SET NULL');
    table.foreign('card_id').references('id').inTable('visitor_access_cards').onDelete('SET NULL');
    table.foreign('authorized_by').references('id').inTable('users').onDelete('SET NULL');

    table.index('visitor_id');
    table.index('entry_time');
    table.index('card_number');
    table.index('access_granted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('visitor_floor_access_logs');
  await knex.schema.dropTableIfExists('visitor_access_cards');
  await knex.schema.dropTableIfExists('employee_access_logs');
  await knex.schema.dropTableIfExists('employee_floor_access');
  await knex.schema.dropTableIfExists('access_points');
}
