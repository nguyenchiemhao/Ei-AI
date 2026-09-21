import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  title: string;
  sourceFilename: string;
  contentType: string;
  currentVersionId: string | null;
}

export interface DocumentListing {
  id: string;
  title: string;
  sourceFilename: string;
  contentType: string;
  createdAt: Date;
  versionId: string | null;
  versionNo: number | null;
  status: string | null;
  statusReason: string | null;
  byteSize: number | null;
  pageCount: number | null;
  chunkerVersion: string | null;
  indexedAt: Date | null;
}

export interface NewDocument {
  workspaceId: string;
  title: string;
  sourceFilename: string;
  contentType: string;
  createdBy: string;
}

const COLUMNS = [
  'id',
  'workspace_id',
  'title',
  'source_filename',
  'content_type',
  'current_version_id',
] as const;

interface DocumentRow {
  id: string;
  workspace_id: string;
  title: string;
  source_filename: string;
  content_type: string;
  current_version_id: string | null;
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    sourceFilename: row.source_filename,
    contentType: row.content_type,
    currentVersionId: row.current_version_id,
  };
}

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  // A second upload of the same filename into the same workspace is a new version of that
  // document, not a second document: FR-02 keeps versions, and `dv_content_unique` is what
  // refuses one whose bytes have not changed.
  async findByFilename(
    workspaceId: string,
    sourceFilename: string,
    tx?: Tx,
  ): Promise<DocumentRecord | undefined> {
    const row = await this.on(tx)
      .selectFrom('documents')
      .select(COLUMNS)
      .where('workspace_id', '=', workspaceId)
      .where('source_filename', '=', sourceFilename)
      .executeTakeFirst();
    return row ? toRecord(row as DocumentRow) : undefined;
  }

  async insert(document: NewDocument, tx?: Tx): Promise<DocumentRecord> {
    const row = await this.on(tx)
      .insertInto('documents')
      .values({
        workspace_id: document.workspaceId,
        title: document.title,
        source_filename: document.sourceFilename,
        content_type: document.contentType,
        created_by: document.createdBy,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toRecord(row as DocumentRow);
  }

  async setCurrentVersion(id: string, versionId: string, tx?: Tx): Promise<void> {
    await this.on(tx)
      .updateTable('documents')
      .set({ current_version_id: versionId })
      .where('id', '=', id)
      .execute();
  }

  // The list the documents screen reads, with each document's current version joined on so the
  // ingestion state travels with the row rather than needing a request per document.
  async listWithStatus(workspaceId: string, tx?: Tx): Promise<DocumentListing[]> {
    const rows = await this.on(tx)
      .selectFrom('documents')
      .leftJoin('document_versions', 'document_versions.id', 'documents.current_version_id')
      .select([
        'documents.id as id',
        'documents.title as title',
        'documents.source_filename as source_filename',
        'documents.content_type as content_type',
        'documents.created_at as created_at',
        'document_versions.id as version_id',
        'document_versions.version_no as version_no',
        'document_versions.status as status',
        'document_versions.status_reason as status_reason',
        'document_versions.byte_size as byte_size',
        'document_versions.page_count as page_count',
        'document_versions.chunker_version as chunker_version',
        'document_versions.indexed_at as indexed_at',
      ])
      .where('documents.workspace_id', '=', workspaceId)
      .orderBy('documents.source_filename')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceFilename: row.source_filename,
      contentType: row.content_type,
      createdAt: row.created_at,
      versionId: row.version_id,
      versionNo: row.version_no,
      status: row.status,
      statusReason: row.status_reason,
      byteSize: row.byte_size === null ? null : Number(row.byte_size),
      pageCount: row.page_count,
      chunkerVersion: row.chunker_version,
      indexedAt: row.indexed_at,
    }));
  }

  async findById(id: string, tx?: Tx): Promise<DocumentRecord | undefined> {
    const row = await this.on(tx)
      .selectFrom('documents')
      .select(COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row as DocumentRow) : undefined;
  }
}
