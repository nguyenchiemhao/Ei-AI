import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  systemRole: string;
  status: string;
  lockedUntil: Date | null;
}

export interface MembershipSummary {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
}

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
  systemRole?: string;
}

const COLUMNS = [
  'id',
  'email',
  'display_name',
  'password_hash',
  'system_role',
  'status',
  'locked_until',
] as const;

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  system_role: string;
  status: string;
  locked_until: Date | null;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    systemRole: row.system_role,
    status: row.status,
    lockedUntil: row.locked_until,
  };
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Email is compared lower-cased on both sides: users_email_unique is case-sensitive, so
  // without this two accounts differing only in case would both be reachable.
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const row = await this.db
      .selectFrom('users')
      .select(COLUMNS)
      .where((eb) => eb(eb.fn('lower', ['email']), '=', email.trim().toLowerCase()))
      .executeTakeFirst();
    return row ? toRecord(row as UserRow) : undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const row = await this.db
      .selectFrom('users')
      .select(COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row as UserRow) : undefined;
  }

  async create(user: NewUser): Promise<UserRecord> {
    const row = await this.db
      .insertInto('users')
      .values({
        email: user.email.trim().toLowerCase(),
        display_name: user.displayName,
        password_hash: user.passwordHash,
        auth_source: 'local',
        ...(user.systemRole ? { system_role: user.systemRole } : {}),
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toRecord(row as UserRow);
  }

  // `GET /me` answers "which workspaces am I in, and as what", which workspaces/ has no query for:
  // listForMember returns the workspaces without the role. The read lives here rather than reaching
  // into another module, because architecture rule 3 forbids the import and a shared table does not
  // need one. Recorded as an open question in docs/plan/notes/WP-3.5.md.
  async listWorkspaceMemberships(userId: string): Promise<MembershipSummary[]> {
    const rows = await this.db
      .selectFrom('workspace_members')
      .innerJoin('workspaces', 'workspaces.id', 'workspace_members.workspace_id')
      .select([
        'workspace_members.workspace_id as workspace_id',
        'workspaces.name as workspace_name',
        'workspace_members.workspace_role as workspace_role',
      ])
      .where('workspace_members.user_id', '=', userId)
      .orderBy('workspaces.name')
      .execute();
    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      workspaceRole: row.workspace_role,
    }));
  }

  async setLockedUntil(id: string, lockedUntil: Date | null): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ locked_until: lockedUntil })
      .where('id', '=', id)
      .execute();
  }
}
