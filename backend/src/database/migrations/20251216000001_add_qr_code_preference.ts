import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add QR code generation preference to meetings table
  await knex.schema.alterTable('meetings', (table) => {
    table.boolean('generate_individual_qr').defaultTo(true); // Default to generating individual QR codes
    table.text('meeting_message_template'); // Custom message template when QR codes are not generated
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('meetings', (table) => {
    table.dropColumn('generate_individual_qr');
    table.dropColumn('meeting_message_template');
  });
}
