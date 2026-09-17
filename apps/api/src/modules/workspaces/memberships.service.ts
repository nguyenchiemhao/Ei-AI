import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
import type { Tx } from '../../database/transaction';
import type { MemberRequest } from './dto/workspace.dto';
import { type MembershipView, WorkspaceMembersRepository } from './workspace-members.repository';

const FOREIGN_KEY_VIOLATION = '23503';

function isUnknownUser(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === FOREIGN_KEY_VIOLATION
  );
}

// T-3.2-06 replaces this with WorkspaceRoleGuard. Until then the rule lives here, because a
// membership endpoint with no rule at all is worse than one whose rule is in the wrong layer.
@Injectable()
export class MembershipsService {
  constructor(
    private readonly members: WorkspaceMembersRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async list(workspaceId: string, callerId: string): Promise<MembershipView[]> {
    await this.assertOwner(workspaceId, callerId);
    return this.members.list(workspaceId);
  }

  async put(
    workspaceId: string,
    request: MemberRequest,
    callerId: string,
  ): Promise<MembershipView> {
    return withTransaction(this.db, async (tx) => {
      await this.assertOwner(workspaceId, callerId, tx);
      await this.assertOwnerRemains(workspaceId, request.userId, request.role, tx);
      try {
        return await this.members.upsert(
          { workspaceId, userId: request.userId, role: request.role, addedBy: callerId },
          tx,
        );
      } catch (error) {
        if (isUnknownUser(error)) {
          throw new AppException('NOT_FOUND', 'User does not exist');
        }
        throw error;
      }
    });
  }

  async remove(workspaceId: string, userId: string, callerId: string): Promise<void> {
    await withTransaction(this.db, async (tx) => {
      await this.assertOwner(workspaceId, callerId, tx);
      await this.assertOwnerRemains(workspaceId, userId, undefined, tx);
      const removed = await this.members.remove(workspaceId, userId, tx);
      if (removed === 0) {
        throw new AppException('NOT_FOUND', 'User is not a member of this workspace');
      }
    });
  }

  private async assertOwner(workspaceId: string, callerId: string, tx?: Tx): Promise<void> {
    const role = await this.members.findRole(workspaceId, callerId, tx);
    if (role !== 'Owner') {
      throw new AppException('AUTHZ_WORKSPACE_FORBIDDEN', 'Only an Owner may change membership');
    }
  }

  // A workspace with no Owner is one nobody can administer, and nothing in the schema forbids
  // it. `nextRole` is undefined when the member is being removed outright.
  private async assertOwnerRemains(
    workspaceId: string,
    targetId: string,
    nextRole: string | undefined,
    tx: Tx,
  ): Promise<void> {
    const current = await this.members.findRole(workspaceId, targetId, tx);
    if (current !== 'Owner' || nextRole === 'Owner') {
      return;
    }
    if ((await this.members.countOwners(workspaceId, tx)) <= 1) {
      throw new AppException(
        'WORKSPACE_LAST_OWNER',
        'The last Owner of a workspace cannot be removed or demoted',
      );
    }
  }
}
