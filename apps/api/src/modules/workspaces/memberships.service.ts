import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import type { ActorContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
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
    private readonly audit: AuditService,
    private readonly members: WorkspaceMembersRepository,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // Owner-only, decided by WorkspaceRoleGuard on the route (`workspace.members`). The caller is
  // no longer an argument here: there is nothing left for this service to decide about them.
  list(workspaceId: string): Promise<MembershipView[]> {
    return this.members.list(workspaceId);
  }

  async put(
    workspaceId: string,
    request: MemberRequest,
    actor: ActorContext,
  ): Promise<MembershipView> {
    return withTransaction(this.db, async (tx) => {
      const existing = await this.members.findRole(workspaceId, request.userId, tx);
      await this.assertOwnerRemains(workspaceId, request.userId, request.role, tx);
      try {
        const membership = await this.members.upsert(
          { workspaceId, userId: request.userId, role: request.role, addedBy: actor.actorUserId },
          tx,
        );
        // Added and re-roled are different things to an auditor: one grants access that did not
        // exist, the other changes what an existing member may do.
        await this.audit.record(
          {
            ...actor,
            action:
              existing === undefined
                ? AUDIT_ACTIONS.MEMBERSHIP_ADDED
                : AUDIT_ACTIONS.MEMBERSHIP_ROLE_CHANGED,
            objectKind: AUDIT_OBJECTS.MEMBERSHIP,
            objectId: request.userId,
            workspaceId,
            detail: { role: request.role, previousRole: existing ?? null },
          },
          tx,
        );
        return membership;
      } catch (error) {
        if (isUnknownUser(error)) {
          throw new AppException('NOT_FOUND', 'User does not exist');
        }
        throw error;
      }
    });
  }

  async remove(workspaceId: string, userId: string, actor: ActorContext): Promise<void> {
    await withTransaction(this.db, async (tx) => {
      const previousRole = await this.members.findRole(workspaceId, userId, tx);
      await this.assertOwnerRemains(workspaceId, userId, undefined, tx);
      const removed = await this.members.remove(workspaceId, userId, tx);
      if (removed === 0) {
        throw new AppException('NOT_FOUND', 'User is not a member of this workspace');
      }
      await this.audit.record(
        {
          ...actor,
          action: AUDIT_ACTIONS.MEMBERSHIP_REMOVED,
          objectKind: AUDIT_OBJECTS.MEMBERSHIP,
          objectId: userId,
          workspaceId,
          detail: { previousRole: previousRole ?? null },
        },
        tx,
      );
    });
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
