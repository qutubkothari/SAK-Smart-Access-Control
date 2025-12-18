import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Fix production drift: some environments have tables created manually / from older bundles.

  // 1) audit_logs.action_type
  const hasAuditLogs = await knex.schema.hasTable('audit_logs');
  if (hasAuditLogs) {
    const hasActionType = await knex.schema.hasColumn('audit_logs', 'action_type');
    if (!hasActionType) {
      await knex.schema.alterTable('audit_logs', (table) => {
        // Use string for compatibility (Postgres enum types may not exist in drifted DBs)
        table.string('action_type', 50);
      });

      // Backfill from older column names if present
      const hasAction = await knex.schema.hasColumn('audit_logs', 'action');
      if (hasAction) {
        await knex.raw('UPDATE audit_logs SET action_type = action WHERE action_type IS NULL');
      }

      await knex.raw("UPDATE audit_logs SET action_type = COALESCE(action_type, 'UNKNOWN')");
      await knex.schema.alterTable('audit_logs', (table) => {
        table.string('action_type', 50).notNullable().alter();
      });

      // Helpful indexes (ignore if they already exist)
      await knex.raw('CREATE INDEX IF NOT EXISTS audit_logs_action_type_idx ON audit_logs(action_type)');
      await knex.raw('CREATE INDEX IF NOT EXISTS audit_logs_action_type_created_at_idx ON audit_logs(action_type, created_at)');
    }
  }

  // 2) departments.is_active
  const hasDepartments = await knex.schema.hasTable('departments');
  if (hasDepartments) {
    const hasIsActive = await knex.schema.hasColumn('departments', 'is_active');
    if (!hasIsActive) {
      await knex.schema.alterTable('departments', (table) => {
        table.boolean('is_active').defaultTo(true);
      });
      await knex.raw('UPDATE departments SET is_active = true WHERE is_active IS NULL');
      await knex.schema.alterTable('departments', (table) => {
        table.boolean('is_active').notNullable().defaultTo(true).alter();
      });
      await knex.raw('CREATE INDEX IF NOT EXISTS departments_is_active_idx ON departments(is_active)');
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Down migration is intentionally conservative: only drop columns if they exist.
  const hasAuditLogs = await knex.schema.hasTable('audit_logs');
  if (hasAuditLogs) {
    const hasActionType = await knex.schema.hasColumn('audit_logs', 'action_type');
    if (hasActionType) {
      await knex.schema.alterTable('audit_logs', (table) => {
        table.dropColumn('action_type');
      });
    }
  }

  const hasDepartments = await knex.schema.hasTable('departments');
  if (hasDepartments) {
    const hasIsActive = await knex.schema.hasColumn('departments', 'is_active');
    if (hasIsActive) {
      await knex.schema.alterTable('departments', (table) => {
        table.dropColumn('is_active');
      });
    }
  }
}
