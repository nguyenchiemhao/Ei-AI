import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

export function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

async function appliedMigrations(client: Client): Promise<Map<string, string>> {
  const { rows } = await client.query<{ filename: string; checksum: string }>(
    'SELECT filename, checksum FROM schema_migrations',
  );
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

// Forward-only: an applied file may never change. A different checksum means the history
// on disk and the history in the database have diverged, which no `down` script can repair.
export function assertUnchanged(filename: string, sql: string, applied: Map<string, string>): void {
  const previous = applied.get(filename);
  if (previous !== undefined && previous !== checksum(sql)) {
    throw new Error(
      `Migration ${filename} has changed since it was applied. Migrations are forward-only: ` +
        `add a new numbered file instead of editing this one.`,
    );
  }
}

async function applyMigration(client: Client, filename: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
      filename,
      checksum(sql),
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function dropSchema(client: Client): Promise<void> {
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
}

export async function migrate(fresh = false): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (fresh) {
      await dropSchema(client);
      process.stdout.write('dropped and recreated schema public\n');
    }
    await client.query(LEDGER);
    const applied = await appliedMigrations(client);

    for (const filename of await migrationFiles()) {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
      assertUnchanged(filename, sql, applied);
      if (applied.has(filename)) {
        process.stdout.write(`= ${filename}\n`);
        continue;
      }
      await applyMigration(client, filename, sql);
      process.stdout.write(`+ ${filename}\n`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('migrate.js') || process.argv[1]?.endsWith('migrate.ts')) {
  migrate(process.argv.includes('--fresh')).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
