import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { WORKSPACE_ROLES } from '@ei-ai/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentsRepository } from '../../modules/workspaces/documents.repository';
import type {
  WorkspaceMembersRepository,
  WorkspaceRole as Role,
} from '../../modules/workspaces/workspace-members.repository';
import type { AppException } from '../app-exception';
import type { WorkspaceActionMetadata } from './roles.decorator';
import { WorkspaceRoleGuard } from './workspace-role.guard';

const PRINCIPAL = {
  userId: 'u-1',
  systemRole: 'Member',
  tokenId: 't-1',
  issuedAt: new Date(),
  expiresAt: new Date(),
};

interface Fixture {
  metadata?: WorkspaceActionMetadata | null;
  role?: Role | null;
  params?: Record<string, string>;
  document?: { workspaceId: string } | null;
  principal?: typeof PRINCIPAL | null;
}

function guardWith({
  metadata = { action: 'workspace.members', from: 'param', param: 'id' },
  role = 'Owner',
  params = { id: 'w-1' },
  document = { workspaceId: 'w-from-document' },
  principal = PRINCIPAL,
}: Fixture = {}) {
  const findRole = vi.fn().mockResolvedValue(role ?? undefined);
  const findById = vi.fn().mockResolvedValue(document ?? undefined);
  const guard = new WorkspaceRoleGuard(
    { getAllAndOverride: vi.fn().mockReturnValue(metadata ?? undefined) } as unknown as Reflector,
    { findRole } as unknown as WorkspaceMembersRepository,
    { findById } as unknown as DocumentsRepository,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ params, principal: principal ?? undefined }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { guard, context, findRole, findById };
}

describe('WorkspaceRoleGuard', () => {
  it('lets a route with no decision through', async () => {
    const { guard, context } = guardWith({ metadata: null });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses a request the authentication guard has not filled in', async () => {
    const { guard, context } = guardWith({ principal: null });
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // What moved here from memberships, upload, downloads and documents-listing.
  it.each(WORKSPACE_ROLES)('decides workspace.members for %s from the table', async (role) => {
    const { guard, context } = guardWith({ role: role as Role });
    if (role === 'Owner') await expect(guard.canActivate(context)).resolves.toBe(true);
    else await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it.each(WORKSPACE_ROLES)('decides workspace.documents for %s from the table', async (role) => {
    const { guard, context } = guardWith({
      metadata: { action: 'workspace.documents', from: 'param', param: 'id' },
      role: role as Role,
    });
    if (role === 'Reader') await expect(guard.canActivate(context)).rejects.toThrow();
    else await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it.each(WORKSPACE_ROLES)('lets every role read', async (role) => {
    const { guard, context } = guardWith({
      metadata: { action: 'workspace.read', from: 'param', param: 'id' },
      role: role as Role,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses someone who is not a member at all', async () => {
    const { guard, context } = guardWith({ role: null });
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // Not a member and too small a role give the same answer: telling them apart would say whether
  // a workspace exists to someone who may not know.
  it('gives a non-member the same code as a member whose role is too small', async () => {
    const codeFor = async (role: Role | null): Promise<string> => {
      const { guard, context } = guardWith({ role });
      try {
        await guard.canActivate(context);
        return 'allowed';
      } catch (error) {
        return (error as AppException).code;
      }
    };
    expect(await codeFor(null)).toBe('AUTHZ_WORKSPACE_FORBIDDEN');
    expect(await codeFor('Reader')).toBe(await codeFor(null));
  });

  it('reads the workspace from the route parameter it was told to use', async () => {
    const { guard, context, findRole } = guardWith({
      metadata: { action: 'workspace.read', from: 'param', param: 'workspaceId' },
      params: { workspaceId: 'w-9' },
    });
    await guard.canActivate(context);
    expect(findRole).toHaveBeenCalledWith('w-9', 'u-1');
  });

  it('resolves the workspace through the document when the route names no workspace', async () => {
    const { guard, context, findRole, findById } = guardWith({
      metadata: { action: 'workspace.read', from: 'document', param: 'id' },
      params: { id: 'd-1' },
    });
    await guard.canActivate(context);
    expect(findById).toHaveBeenCalledWith('d-1');
    expect(findRole).toHaveBeenCalledWith('w-from-document', 'u-1');
  });

  it('refuses a document that does not exist rather than asking about a workspace', async () => {
    const { guard, context, findRole } = guardWith({
      metadata: { action: 'workspace.read', from: 'document', param: 'id' },
      document: null,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(/Document does not exist/);
    expect(findRole).not.toHaveBeenCalled();
  });

  it('refuses a route whose parameter is missing, rather than guessing', async () => {
    const { guard, context } = guardWith({ params: {} });
    await expect(guard.canActivate(context)).rejects.toThrow(/no id parameter/);
  });
});
