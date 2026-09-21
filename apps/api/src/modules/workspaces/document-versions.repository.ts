import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { VersionStatus } from '../../database/schema';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  versionNo: number;
  storageKey: string;
  byteSize: number;
  sha256: string;
  status: string;
}

export interface NewDocumentVersion {
  documentId: string;
  versionNo: number;
  storageKey: string;
  byteSize: number;
  sha256: string;
  uploadedBy: string;
}

const COLUMNS = [
  'id',
  'document_id',
  'version_no',
  'storage_key',
  'byte_size',
  'sha256',
  'status',
] as const;

interface VersionRow {
  id: string;
  document_id: string;
  version_no: number;
  storage_key: string;
  byte_size: string | number;
  sha256: string;
  status: string;
}

function toRecord(row: VersionRow): DocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNo: row.version_no,
    storageKey: row.storage_key,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    status: row.status,
  };
}

@Injectable()
export class DocumentVersionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  async nextVersionNo(documentId: string, tx?: Tx): Promise<number> {
    const row = await this.on(tx)
      .selectFrom('document_versions')
      .select((eb) => eb.fn.max<number>('version_no').as('highest'))
      .where('document_id', '=', documentId)
      .executeTakeFirst();
    return (row?.highest ?? 0) + 1;
  }

  async insert(version: NewDocumentVersion, tx?: Tx): Promise<DocumentVersionRecord> {
    const row = await this.on(tx)
      .insertInto('document_versions')
      .values({
        document_id: version.documentId,
        version_no: version.versionNo,
        storage_key: version.storageKey,
        byte_size: version.byteSize,
        sha256: version.sha256,
        uploaded_by: version.uploadedBy,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toRecord(row as VersionRow);
  }

  // Written by the ingestion pipeline as a version moves through its state machine. The reason is
  // cleared on every transition that is not a failure, so a stale explanation cannot outlive it.
  async setStatus(
    id: string,
    status: VersionStatus,
    statusReason: string | null = null,
    tx?: Tx,
  ): Promise<void> {
    await this.on(tx)
      .updateTable('document_versions')
      .set({ status, status_reason: statusReason })
      .where('id', '=', id)
      .execute();
  }

  // The last transition writes three things at once: the state, the chunker that produced the
  // chunks, and the moment it happened. A re-index after a chunker change is identifiable because
  // `chunker_version` moves with `indexed_at`.
  async setIndexed(id: string, chunkerVersion: string, tx?: Tx): Promise<void> {
    await this.on(tx)
      .updateTable('document_versions')
      .set({
        status: 'indexed',
        status_reason: null,
        chunker_version: chunkerVersion,
        indexed_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  async findById(id: string, tx?: Tx): Promise<DocumentVersionRecord | undefined> {
    const row = await this.on(tx)
      .selectFrom('document_versions')
      .select(COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row as VersionRow) : undefined;
  }
}
