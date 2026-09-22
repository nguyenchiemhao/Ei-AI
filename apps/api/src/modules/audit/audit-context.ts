import { AppException } from '../../common/app-exception';
import { correlationIdOf } from '../../common/correlation-id.middleware';
import type { AuthenticatedRequest } from '../../common/http.types';

// Who did it, from where, and under which request. Carried into a service rather than reconstructed
// there: a service has no request, and an audit row that invents its own correlation id links to
// nothing. `actorUserId` is nullable because a failed login has no verified actor to name.
export interface AuditContext {
  actorUserId: string | null;
  actorIp: string | null;
  correlationId: string;
}

// The same thing on a route that has already authenticated, where the actor is known. Services
// behind `JwtAuthGuard` take this, so the caller's id and the audit actor cannot diverge — they
// are one field rather than two arguments that have to agree.
export interface ActorContext extends AuditContext {
  actorUserId: string;
}

export function actorOf(request: AuthenticatedRequest): ActorContext {
  if (!request.principal) {
    throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
  }
  return {
    actorUserId: request.principal.userId,
    actorIp: request.ip ?? null,
    correlationId: correlationIdOf(request),
  };
}

// For events raised before anyone is authenticated — a login that failed, an account locked out.
export function anonymousContext(
  request: AuthenticatedRequest,
  actorUserId?: string,
): AuditContext {
  return {
    actorUserId: actorUserId ?? null,
    actorIp: request.ip ?? null,
    correlationId: correlationIdOf(request),
  };
}
