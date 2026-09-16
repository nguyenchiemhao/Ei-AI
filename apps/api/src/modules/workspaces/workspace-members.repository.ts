import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';

export type WorkspaceRole = 'Owner' | 'Editor' | 'Reader';

export interface MembershipView {
  workspaceId: string;
  userId: string;
  workspaceRole: WorkspaceRole;
  addedAt: Date;
}

interface MembershipRow {
  workspace_id: string;
  user_id: string;
  workspace_role: string;
  added_at: Date;
}

function toView(row: MembershipRow): MembershipView {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    workspaceRole: row.workspace_role as WorkspaceRole,
    addedAt: row.added_at,
  };
}

@Injectable()
export class WorkspaceMembersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  async upsert(
    membership: { workspaceId: string; userId: string; role: WorkspaceRole; addedBy: string },
    tx?: Tx,
  ): Promise<MembershipView> {
    const row = await this.on(tx)
      .insertInto('workspace_members')
      .values({
        workspace_id: membership.workspaceId,
        user_id: membership.userId,
        workspace_role: membership.role,
        added_by: membership.addedBy,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['workspace_id', 'user_id'])
          .doUpdateSet({ workspace_role: membership.role }),
      )
      .returning(['workspace_id', 'user_id', 'workspace_role', 'added_at'])
      .executeTakeFirstOrThrow();
    return toView(row as MembershipRow);
  }

  async findRole(workspaceId: string, userId: string, tx?: Tx): Promise<WorkspaceRole | undefined> {
    const row = await this.on(tx)
      .selectFrom('workspace_members')
      .select('workspace_role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ? (row.workspace_role as WorkspaceRole) : undefined;
  }

  async list(workspaceId: string, tx?: Tx): Promise<MembershipView[]> {
    const rows = await this.on(tx)
      .selectFrom('workspace_members')
      .select(['workspace_id', 'user_id', 'workspace_role', 'added_at'])
      .where('workspace_id', '=', workspaceId)
      .orderBy('added_at', 'asc')
      .execute();
    return rows.map((row) => toView(row as MembershipRow));
  }

  async remove(workspaceId: string, userId: string, tx?: Tx): Promise<number> {
    const result = await this.on(tx)
      .deleteFrom('workspace_members')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  async countOwners(workspaceId: string, tx?: Tx): Promise<number> {
    const row = await this.on(tx)
      .selectFrom('workspace_members')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('workspace_id', '=', workspaceId)
      .where('workspace_role', '=', 'Owner')
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }
}
