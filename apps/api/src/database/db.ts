import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './schema';

// One pool for the process. The generated DB type comes from the live schema, so a column
// renamed in SQL and not in code fails typecheck rather than at 3 a.m. in production.
export function createDatabase(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

export type Database = Kysely<DB>;
