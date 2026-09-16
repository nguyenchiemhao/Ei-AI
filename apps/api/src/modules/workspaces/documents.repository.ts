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

  async findById(id: string, tx?: Tx): Promise<DocumentRecord | undefined> {
    const row = await this.on(tx)
      .selectFrom('documents')
      .select(COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row as DocumentRow) : undefined;
  }
}
