import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mayUseWorkspaceAction } from '@ei-ai/shared-types';
import { DocumentsRepository } from '../../modules/workspaces/documents.repository';
import { WorkspaceMembersRepository } from '../../modules/workspaces/workspace-members.repository';
import { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../http.types';
import { WORKSPACE_ACTION, type WorkspaceActionMetadata } from './roles.decorator';

interface ParameterisedRequest extends AuthenticatedRequest {
  params?: Record<string, string>;
}

// FR-62's three workspace roles, decided from the same table as the system roles. Not a member at
// all and a member with too small a role are the same answer to the caller — telling them apart
// would say whether a workspace exists.
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: WorkspaceMembersRepository,
    private readonly documents: DocumentsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<WorkspaceActionMetadata | undefined>(
      WORKSPACE_ACTION,
      [context.getHandler(), context.getClass()],
    );
    if (metadata === undefined) return true;

    const request = context.switchToHttp().getRequest<ParameterisedRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
    }
    const workspaceId = await this.workspaceOf(request, metadata);
    const role = await this.members.findRole(workspaceId, principal.userId);
    if (role === undefined || !mayUseWorkspaceAction(role, metadata.action)) {
      throw new AppException('AUTHZ_WORKSPACE_FORBIDDEN', 'Not permitted in this workspace', {
        action: metadata.action,
      });
    }
    return true;
  }

  private async workspaceOf(
    request: ParameterisedRequest,
    metadata: WorkspaceActionMetadata,
  ): Promise<string> {
    const value = request.params?.[metadata.param];
    if (!value) {
      throw new AppException('VALIDATION_FAILED', `Route has no ${metadata.param} parameter`);
    }
    if (metadata.from === 'param') return value;

    const document = await this.documents.findById(value);
    if (document === undefined) {
      throw new AppException('NOT_FOUND', 'Document does not exist');
    }
    return document.workspaceId;
  }
}
