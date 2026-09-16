import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
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
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // The workspace and its first membership commit together: a workspace whose creator is not
  // its Owner is one nobody can administer, and a half-written pair is exactly what a crash
  // between two statements would leave.
  async create(request: CreateWorkspaceRequest, createdBy: string): Promise<WorkspaceView> {
    try {
      return await withTransaction(this.db, async (tx) => {
        const workspace = await this.workspaces.insert({ ...request, createdBy }, tx);
        await this.members.upsert(
          { workspaceId: workspace.id, userId: createdBy, role: 'Owner', addedBy: createdBy },
          tx,
        );
        return workspace;
      });
    } catch (error) {
      if (isNameClash(error)) {
        throw new AppException('WORKSPACE_NAME_TAKEN', `Tên "${request.name}" đã được dùng`);
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
      throw new AppException('NOT_FOUND', 'Workspace không tồn tại');
    }
    return workspace;
  }

  // FR-61. Archiving is a status change and nothing else: the rows stay, the list keeps showing
  // them, and it is retrieval that stops offering their content (T-2.3-06).
  async update(id: string, changes: UpdateWorkspaceRequest): Promise<WorkspaceView> {
    const updated = await this.workspaces.update(id, changes);
    if (!updated) {
      throw new AppException('NOT_FOUND', 'Workspace không tồn tại');
    }
    return updated;
  }
}
