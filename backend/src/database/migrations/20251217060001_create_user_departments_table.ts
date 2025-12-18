import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create user_departments junction table for many-to-many relationship
  await knex.schema.createTable('user_departments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('department_id').notNullable().references('id').inTable('departments').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Ensure unique user-department pairs
    table.unique(['user_id', 'department_id']);
    
    // Indexes for performance
    table.index('user_id');
    table.index('department_id');
  });

  // Migrate existing department_id relationships to the new table
  await knex.raw(`
    INSERT INTO user_departments (user_id, department_id)
    SELECT id, department_id
    FROM users
    WHERE department_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_departments');
}
