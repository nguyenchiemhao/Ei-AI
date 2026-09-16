import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';
import type { WorkspaceView } from './dto/workspace.dto';

export interface NewWorkspace {
  name: string;
  description?: string;
  languageHint?: string;
  createdBy: string;
}

export interface WorkspaceChanges {
  name?: string;
  description?: string;
  languageHint?: string;
  status?: string;
}

const COLUMNS = [
  'id',
  'name',
  'description',
  'language_hint',
  'status',
  'created_by',
  'created_at',
] as const;

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  language_hint: string;
  status: string;
  created_by: string;
  created_at: Date;
}

function toView(row: WorkspaceRow): WorkspaceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    languageHint: row.language_hint,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

@Injectable()
export class WorkspacesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Every method takes an optional transaction and falls back to the pool. BR-07 will need the
  // audit row written inside the caller's transaction, and a repository that only knows the
  // pool cannot be part of one.
  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  async insert(workspace: NewWorkspace, tx?: Tx): Promise<WorkspaceView> {
    const row = await this.on(tx)
      .insertInto('workspaces')
      .values({
        name: workspace.name,
        description: workspace.description ?? null,
        created_by: workspace.createdBy,
        ...(workspace.languageHint ? { language_hint: workspace.languageHint } : {}),
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toView(row as WorkspaceRow);
  }

  async findById(id: string, tx?: Tx): Promise<WorkspaceView | undefined> {
    const row = await this.on(tx)
      .selectFrom('workspaces')
      .select(COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toView(row as WorkspaceRow) : undefined;
  }

  // Archived workspaces are retained and still listed: FR-61 keeps them readable, and it is
  // retrieval that drops them, not this list.
  async listForMember(userId: string): Promise<WorkspaceView[]> {
    const rows = await this.db
      .selectFrom('workspaces')
      .innerJoin('workspace_members', 'workspace_members.workspace_id', 'workspaces.id')
      .select(COLUMNS.map((column) => `workspaces.${column}` as const))
      .where('workspace_members.user_id', '=', userId)
      .orderBy('workspaces.created_at', 'desc')
      .execute();
    return rows.map((row) => toView(row as WorkspaceRow));
  }

  async update(id: string, changes: WorkspaceChanges, tx?: Tx): Promise<WorkspaceView | undefined> {
    const row = await this.on(tx)
      .updateTable('workspaces')
      .set({
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.description !== undefined ? { description: changes.description } : {}),
        ...(changes.languageHint !== undefined ? { language_hint: changes.languageHint } : {}),
        ...(changes.status !== undefined ? { status: changes.status } : {}),
      })
      .where('id', '=', id)
      .returning(COLUMNS)
      .executeTakeFirst();
    return row ? toView(row as WorkspaceRow) : undefined;
  }
}
