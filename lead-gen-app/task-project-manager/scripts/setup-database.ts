import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is required. Set it in .env or the environment.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        focus_area TEXT,
        cadence TEXT,
        health_score NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        project_id UUID REFERENCES task_projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority_level TEXT NOT NULL DEFAULT 'medium',
        priority_score NUMERIC NOT NULL DEFAULT 0,
        impact INTEGER,
        effort INTEGER,
        confidence INTEGER,
        due_date TIMESTAMP WITH TIME ZONE,
        start_date TIMESTAMP WITH TIME ZONE,
        estimated_minutes INTEGER,
        actual_minutes INTEGER,
        tags TEXT[],
        blocked_reason TEXT,
        auto_insights JSONB,
        recurrence_pattern TEXT,
        recurrence_parent_id UUID REFERENCES task_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_task_items_user ON task_items(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_task_items_due_date ON task_items(due_date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_task_projects_user ON task_projects(user_id);
    `);

    await client.query('COMMIT');
    console.log('Database setup complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Fatal error running setup:', error);
  process.exit(1);
});
