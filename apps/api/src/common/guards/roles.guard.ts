import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mayUseSystemAction, type SystemAction } from '@ei-ai/shared-types';
import { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../http.types';
import { SYSTEM_ACTION } from './roles.decorator';

// Design §9.1's system roles, enforced from the table rather than from anything written here.
// A route with no `@Roles()` is not silently allowed: `T-3.2-06` requires every implemented route
// to carry an explicit decision, and a missing one is a fault rather than a default.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<SystemAction | undefined>(SYSTEM_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (action === undefined) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
    }
    if (!mayUseSystemAction(principal.systemRole, action)) {
      throw new AppException(
        'AUTHZ_ROLE_FORBIDDEN',
        `Role ${principal.systemRole} may not ${action}`,
        { action, role: principal.systemRole },
      );
    }
    return true;
  }
}
