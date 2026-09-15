import type { Transaction } from 'kysely';
import type { Database } from './db';
import type { DB } from './schema';

export type Tx = Transaction<DB>;

// Audit rows are written inside the caller's transaction (BR-07), so the work and the record
// of it commit or roll back together. Every write path takes this helper rather than the
// Kysely instance directly, which is what makes that guarantee hold by construction.
export function withTransaction<T>(db: Database, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute(work);
}
