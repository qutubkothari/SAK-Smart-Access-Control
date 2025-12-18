import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasAuditLogs = await knex.schema.hasTable('audit_logs');
  if (hasAuditLogs) {
    return;
  }

  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('audit_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table
      .enum('action_type', [
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
      ])
      .notNullable();
    table.string('entity_type', 100).notNullable();
    table.string('entity_id', 255).nullable();
    table.jsonb('old_values').nullable();
    table.jsonb('new_values').nullable();
    table.string('ip_address').nullable();
    table.text('user_agent').nullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index('user_id');
    table.index('action_type');
    table.index('entity_type');
    table.index('created_at');
    table.index(['user_id', 'created_at']);
    table.index(['action_type', 'created_at']);
    table.index(['entity_type', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
