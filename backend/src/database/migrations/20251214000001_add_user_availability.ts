import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasUserAvailability = await knex.schema.hasTable('user_availability');
  if (hasUserAvailability) {
    return;
  }

  await knex.schema.createTable('user_availability', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.string('reason', 255);
    table.enum('type', ['time_off', 'busy', 'meeting', 'unavailable']).defaultTo('busy');
    table.boolean('all_day').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id', 'start_time', 'end_time']);
    table.index('type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_availability');
}
