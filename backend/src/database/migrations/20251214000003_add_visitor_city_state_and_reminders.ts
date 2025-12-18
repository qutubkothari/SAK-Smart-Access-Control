import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('visitors', (table) => {
    table.string('city', 100).nullable();
    table.string('state', 100).nullable();
    table.timestamp('reminder_sent_at').nullable();

    table.index(['city']);
    table.index(['state']);
    table.index(['reminder_sent_at']);
  });

  await knex.schema.alterTable('visitor_directory', (table) => {
    table.string('city', 100).nullable();
    table.string('state', 100).nullable();

    table.index(['city']);
    table.index(['state']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('visitor_directory', (table) => {
    table.dropIndex(['state']);
    table.dropIndex(['city']);
    table.dropColumn('state');
    table.dropColumn('city');
  });

  await knex.schema.alterTable('visitors', (table) => {
    table.dropIndex(['reminder_sent_at']);
    table.dropIndex(['state']);
    table.dropIndex(['city']);
    table.dropColumn('reminder_sent_at');
    table.dropColumn('state');
    table.dropColumn('city');
  });
}
