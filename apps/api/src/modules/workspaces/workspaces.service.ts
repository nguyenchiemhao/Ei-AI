import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import type { ActorContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceView,
} from './dto/workspace.dto';
import { WorkspaceMembersRepository } from './workspace-members.repository';
import { WorkspacesRepository } from './workspaces.repository';

const UNIQUE_VIOLATION = '23505';

function isNameClash(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION &&
    String((error as { constraint?: string }).constraint ?? '').includes('workspaces_name_unique')
  );
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaces: WorkspacesRepository,
    private readonly members: WorkspaceMembersRepository,
    private readonly audit: AuditService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // The workspace and its first membership commit together: a workspace whose creator is not
  // its Owner is one nobody can administer, and a half-written pair is exactly what a crash
  // between two statements would leave.
  async create(request: CreateWorkspaceRequest, actor: ActorContext): Promise<WorkspaceView> {
    const createdBy = actor.actorUserId;
    try {
      return await withTransaction(this.db, async (tx) => {
        const workspace = await this.workspaces.insert({ ...request, createdBy }, tx);
        await this.members.upsert(
          { workspaceId: workspace.id, userId: createdBy, role: 'Owner', addedBy: createdBy },
          tx,
        );
        await this.audit.record(
          {
            ...actor,
            action: AUDIT_ACTIONS.WORKSPACE_CREATED,
            objectKind: AUDIT_OBJECTS.WORKSPACE,
            objectId: workspace.id,
            workspaceId: workspace.id,
            detail: { name: workspace.name },
          },
          tx,
        );
        return workspace;
      });
    } catch (error) {
      if (isNameClash(error)) {
        throw new AppException(
          'WORKSPACE_NAME_TAKEN',
          `The name "${request.name}" is already taken`,
        );
      }
      throw error;
    }
  }

  listFor(userId: string): Promise<WorkspaceView[]> {
    return this.workspaces.listForMember(userId);
  }

  async read(id: string): Promise<WorkspaceView> {
    const workspace = await this.workspaces.findById(id);
    if (!workspace) {
      throw new AppException('NOT_FOUND', 'Workspace does not exist');
    }
    return workspace;
  }

  // FR-61. Archiving is a status change and nothing else: the rows stay, the list keeps showing
  // them, and it is retrieval that stops offering their content (T-2.3-06).
  async update(
    id: string,
    changes: UpdateWorkspaceRequest,
    actor: ActorContext,
  ): Promise<WorkspaceView> {
    return withTransaction(this.db, async (tx) => {
      const updated = await this.workspaces.update(id, changes, tx);
      if (!updated) {
        throw new AppException('NOT_FOUND', 'Workspace does not exist');
      }
      // Archiving is the change an auditor looks for, so it gets its own action rather than
      // hiding inside a generic update with a status field in the detail.
      await this.audit.record(
        {
          ...actor,
          action:
            changes.status === 'archived'
              ? AUDIT_ACTIONS.WORKSPACE_ARCHIVED
              : AUDIT_ACTIONS.WORKSPACE_UPDATED,
          objectKind: AUDIT_OBJECTS.WORKSPACE,
          objectId: updated.id,
          workspaceId: updated.id,
          detail: { changed: Object.keys(changes).sort() },
        },
        tx,
      );
      return updated;
    });
  }
}
