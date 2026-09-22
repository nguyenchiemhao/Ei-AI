import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuditAction, AuditObjectKind } from '@ei-ai/shared-types';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { type Tx, withTransaction } from '../../database/transaction';
import { AuditRepository, type RecordedAuditEvent } from './audit.repository';

export interface AuditRecord {
  action: AuditAction;
  objectKind: AuditObjectKind;
  objectId?: string | null;
  actorUserId?: string | null;
  actorIp?: string | null;
  workspaceId?: string | null;
  correlationId: string;
  detail?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly events: AuditRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // The caller's transaction, always. BR-07 is not a convention here — the record and the action
  // are the same transaction object, so an audit write that throws takes the action down with it.
  record(record: AuditRecord, tx: Tx): Promise<RecordedAuditEvent> {
    return this.events.append(record, tx);
  }

  // The exception to BR-07, and the only one. Two kinds of event need it: an action that failed,
  // whose transaction has rolled the record away with it, and an action that never had a
  // transaction to join — authentication writes a login attempt and may set a lock, but it does
  // not wrap them, so there is nothing for the record to be atomic with. A failed login that
  // leaves no trace would empty the log of exactly what an auditor opens it for.
  async recordIndependently(record: AuditRecord): Promise<void> {
    try {
      await withTransaction(this.db, (tx) => this.events.append(record, tx));
    } catch (error) {
      // Nothing above this can be told: the action has already failed and its response is written.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`could not record ${record.action}: ${reason}`);
    }
  }
}
