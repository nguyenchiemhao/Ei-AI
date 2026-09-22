import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES } from '@ei-ai/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../http.types';
import { RolesGuard } from './roles.guard';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardFor(action: string | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(action),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

function principal(systemRole: string): Partial<AuthenticatedRequest> {
  return {
    principal: {
      userId: 'u-1',
      systemRole,
      tokenId: 't-1',
      issuedAt: new Date(),
      expiresAt: new Date(),
    },
  };
}

describe('RolesGuard', () => {
  it('lets a route with no decision through, so the decision lives on the route', () => {
    expect(guardFor(undefined).canActivate(contextFor(principal('Member')))).toBe(true);
  });

  it('refuses a request the authentication guard has not filled in', () => {
    expect(() => guardFor('question.ask').canActivate(contextFor({}))).toThrow();
  });

  // The behaviour that moved here from four services: the decision comes from the table.
  it.each(SYSTEM_ROLES)('decides workspace.manage for %s from the table', (role) => {
    const allowed = role === 'Administrator' || role === 'Knowledge Manager';
    const attempt = () => guardFor('workspace.manage').canActivate(contextFor(principal(role)));
    if (allowed) expect(attempt()).toBe(true);
    else expect(attempt).toThrow();
  });

  it.each(SYSTEM_ROLES)('decides question.ask for %s from the table', (role) => {
    const attempt = () => guardFor('question.ask').canActivate(contextFor(principal(role)));
    // Design §9.1 gives the Auditor a dash under "Ask a question": the read-only role of the
    // product may read the audit log and not the documents.
    if (role === 'Auditor') expect(attempt).toThrow();
    else expect(attempt()).toBe(true);
  });

  it('refuses with a code that is about a role, not about a tool', () => {
    try {
      guardFor('workspace.manage').canActivate(contextFor(principal('Member')));
      expect.unreachable('the guard should have refused');
    } catch (error) {
      expect((error as AppException).code).toBe('AUTHZ_ROLE_FORBIDDEN');
    }
  });

  it('names the action and the role it refused, so a client need not parse a sentence', () => {
    try {
      guardFor('backup.manage').canActivate(contextFor(principal('Auditor')));
      expect.unreachable('the guard should have refused');
    } catch (error) {
      expect((error as AppException).extensions).toEqual({
        action: 'backup.manage',
        role: 'Auditor',
      });
    }
  });

  it('refuses a role that is not one of the five at all', () => {
    expect(() => guardFor('question.ask').canActivate(contextFor(principal('Wizard')))).toThrow();
  });
});
