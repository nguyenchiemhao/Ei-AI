import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';
import { type HashableEvent, hashOf } from './audit-hash';

export interface NewAuditEvent {
  actorUserId?: string | null;
  actorIp?: string | null;
  action: string;
  objectKind: string;
  objectId?: string | null;
  workspaceId?: string | null;
  correlationId: string;
  detail?: Record<string, unknown>;
}

export interface RecordedAuditEvent extends HashableEvent {
  id: string;
  prevHash: Buffer | null;
  hash: Buffer;
}

// One lock for one chain. Without it two transactions read the same tip and both write `prev_hash`
// pointing at it — measured, not feared — and a fork is indistinguishable from the tampering FR-68
// exists to detect. Taken as a transaction lock, so it is released by commit or rollback and never
// leaks; the number is arbitrary but fixed, and nothing else in this system takes an advisory lock.
const CHAIN_LOCK = 20260921;

interface StoredRow {
  id: string;
  occurred_at: Date;
  actor_user_id: string | null;
  actor_ip: string | null;
  action: string;
  object_kind: string;
  object_id: string | null;
  workspace_id: string | null;
  correlation_id: string;
  detail: Record<string, unknown>;
  prev_hash: Buffer | null;
  hash: Buffer;
}

export function toRecorded(row: StoredRow): RecordedAuditEvent {
  return {
    id: row.id,
    occurredAt: new Date(row.occurred_at),
    actorUserId: row.actor_user_id,
    actorIp: row.actor_ip,
    action: row.action,
    objectKind: row.object_kind,
    objectId: row.object_id,
    workspaceId: row.workspace_id,
    correlationId: row.correlation_id,
    detail: row.detail,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // The transaction is the caller's, not one opened here: the record and the action it describes
  // commit or roll back together (BR-07), and that holds because it is literally the same object.
  async append(event: NewAuditEvent, tx: Tx): Promise<RecordedAuditEvent> {
    await sql`SELECT pg_advisory_xact_lock(${CHAIN_LOCK})`.execute(tx);
    const tip = await tx
      .selectFrom('audit_events')
      .select('hash')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();
    const prevHash = (tip?.hash as Buffer | undefined) ?? null;

    // Set here rather than left to `now()`, so the value that goes into the hash is the value
    // that lands in the column and the row can be verified against itself.
    const hashable: HashableEvent = {
      occurredAt: new Date(),
      actorUserId: event.actorUserId ?? null,
      actorIp: event.actorIp ?? null,
      action: event.action,
      objectKind: event.objectKind,
      objectId: event.objectId ?? null,
      workspaceId: event.workspaceId ?? null,
      correlationId: event.correlationId,
      detail: event.detail ?? {},
    };
    const hash = hashOf(hashable, prevHash);

    const row = await tx
      .insertInto('audit_events')
      .values({
        occurred_at: hashable.occurredAt,
        actor_user_id: hashable.actorUserId,
        actor_ip: hashable.actorIp,
        action: hashable.action,
        object_kind: hashable.objectKind,
        object_id: hashable.objectId,
        workspace_id: hashable.workspaceId,
        correlation_id: hashable.correlationId,
        detail: JSON.stringify(hashable.detail),
        prev_hash: prevHash,
        hash,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    return { ...hashable, id: String(row.id), prevHash, hash };
  }

  // Reads the chain in order for the integrity test. FR-67's search and FR-68's verification job
  // are milestone 2D's; this is the primitive they will be built on, not the feature.
  // `id` is a bigint, which the driver returns as a string and accepts as one.
  async readChain(afterId = '0', limit = 1000): Promise<RecordedAuditEvent[]> {
    const rows = await this.db
      .selectFrom('audit_events')
      .selectAll()
      .where('id', '>', afterId)
      .orderBy('id', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => toRecorded(row as unknown as StoredRow));
  }
}

export { CHAIN_LOCK };
