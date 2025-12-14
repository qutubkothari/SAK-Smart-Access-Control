import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('visitors', (table) => {
    table.string('its_id', 50).nullable();
    table.index(['its_id']);
  });

  await knex.schema.createTable('visitor_directory', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('its_id', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable();
    table.string('phone', 20).notNullable();
    table.string('company', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['its_id']);
    table.index(['phone']);
    table.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('visitor_directory');

  await knex.schema.alterTable('visitors', (table) => {
    table.dropIndex(['its_id']);
    table.dropColumn('its_id');
  });
}
