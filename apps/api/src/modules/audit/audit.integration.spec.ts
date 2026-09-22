import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
import { hashOf } from './audit-hash';
import { AuditRepository, type RecordedAuditEvent } from './audit.repository';

const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';

let client: Client;
let db: Database;
let repository: AuditRepository;
let actor: string;

// The table is append-only, so nothing this suite writes can ever be cleaned up. It therefore
// verifies only the segment it appended, identified by an object id of its own — the rest of the
// table is whatever earlier runs left, and a test that depended on it would be testing history.
const RUN = randomUUID();

function append(action: string, detail: Record<string, unknown> = {}): Promise<RecordedAuditEvent> {
  return withTransaction(db, (tx) =>
    repository.append(
      {
        actorUserId: actor,
        action,
        objectKind: 'audit_it',
        objectId: RUN,
        correlationId: randomUUID(),
        detail,
      },
      tx,
    ),
  );
}

async function segment(): Promise<RecordedAuditEvent[]> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM audit_events WHERE object_id = $1 ORDER BY id`,
    [RUN],
  );
  const ids = new Set(rows.map((row) => row.id));
  const chain = await repository.readChain('0', 10_000);
  return chain.filter((event) => ids.has(event.id));
}

beforeAll(async () => {
  client = new Client({ connectionString: CONNECTION });
  await client.connect();
  db = createDatabase(CONNECTION);
  repository = new AuditRepository(db);
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM users ORDER BY email LIMIT 1`,
  );
  actor = rows[0]!.id;
});

afterAll(async () => {
  await db.destroy();
  await client.end();
});

describe('immutability', () => {
  it('refuses an UPDATE, which is what makes the log evidence', async () => {
    await append('it.immutable.update');
    await expect(
      client.query(`UPDATE audit_events SET action = 'tampered' WHERE object_id = $1`, [RUN]),
    ).rejects.toThrow(/does not allow UPDATE/);
  });

  it('refuses a DELETE, so nothing can be quietly removed', async () => {
    await expect(
      client.query(`DELETE FROM audit_events WHERE object_id = $1`, [RUN]),
    ).rejects.toThrow(/does not allow DELETE/);
  });
});

describe('the chain', () => {
  it('links each event to the one before it', async () => {
    const first = await append('it.chain.first');
    const second = await append('it.chain.second');
    expect(second.prevHash).not.toBeNull();
    expect(Buffer.compare(second.prevHash!, first.hash)).toBe(0);
  });

  it('gives back a hash that recomputes from the stored row', async () => {
    await append('it.chain.recompute', { b: 2, a: 1, nested: { z: 1, y: 2 } });
    const events = await segment();
    for (const event of events) {
      expect(Buffer.compare(hashOf(event, event.prevHash), event.hash)).toBe(0);
    }
  });

  it('verifies unbroken across everything this run appended', async () => {
    const events = await segment();
    expect(events.length).toBeGreaterThan(2);
    for (let i = 1; i < events.length; i += 1) {
      const recomputed = hashOf(events[i]!, events[i - 1]!.hash);
      expect(Buffer.compare(recomputed, events[i]!.hash)).toBe(0);
    }
  });

  it('does not fork when many events are written at once', async () => {
    const written = await Promise.all(
      Array.from({ length: 12 }, (_, i) => append(`it.chain.concurrent.${i}`)),
    );
    const previous = written.map((event) => String(event.prevHash));
    expect(new Set(previous).size).toBe(written.length);
  });
});

describe('detecting a break', () => {
  // The database refuses an UPDATE, so a tampered row cannot be made by editing one. What can be
  // made is a row whose hash was wrong when it was written, which is what an attacker with insert
  // rights but not table ownership would leave — and recomputation finds it at exactly that row.
  it('names the one row whose hash does not match its contents', async () => {
    const before = await append('it.break.before');
    await client.query(
      `INSERT INTO audit_events
         (occurred_at, actor_user_id, action, object_kind, object_id, correlation_id,
          detail, prev_hash, hash)
       VALUES (now(), $1, 'it.break.planted', 'audit_it', $2, gen_random_uuid(),
               '{}'::jsonb, $3, $4)`,
      [actor, RUN, before.hash, Buffer.alloc(32, 7)],
    );
    await append('it.break.after');

    const events = await segment();
    const broken = events.filter(
      (event) => Buffer.compare(hashOf(event, event.prevHash), event.hash) !== 0,
    );
    expect(broken).toHaveLength(1);
    expect(broken[0]!.action).toBe('it.break.planted');
  });
});
