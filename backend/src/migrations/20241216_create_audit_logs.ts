import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create audit_logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('audit_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('user_id').inTable('users').onDelete('SET NULL');
    table.enum('action_type', [
      'CREATE',
      'UPDATE',
      'DELETE',
      'LOGIN',
      'LOGOUT',
      'ACCESS_GRANTED',
      'ACCESS_DENIED',
      'SECURITY_VIOLATION',
      'EXPORT',
      'IMPORT'
    ]).notNullable();
    table.string('entity_type', 100).notNullable(); // user, door, leave, attendance, etc.
    table.string('entity_id', 255).nullable(); // ID of the affected entity
    table.jsonb('old_values').nullable(); // Previous state
    table.jsonb('new_values').nullable(); // New state
    table.string('ip_address', 45).nullable(); // IPv4 or IPv6
    table.text('user_agent').nullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    // Indexes for common queries
    table.index('user_id');
    table.index('action_type');
    table.index('entity_type');
    table.index('created_at');
    table.index(['user_id', 'created_at']);
    table.index(['action_type', 'created_at']);
    table.index(['entity_type', 'entity_id']);
  });

  console.log('✅ Created audit_logs table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  console.log('✅ Dropped audit_logs table');
}
