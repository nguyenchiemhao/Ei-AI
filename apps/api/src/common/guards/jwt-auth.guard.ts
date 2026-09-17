import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { RevocationService } from '../../modules/identity/revocation.service';
import { TokenService } from '../../modules/identity/token.service';
import { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../http.types';

const BEARER = /^Bearer (.+)$/;

function bearerTokenOf(request: AuthenticatedRequest): string {
  const raw = request.headers['authorization'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const matched = header ? BEARER.exec(header.trim()) : null;
  if (!matched?.[1]) {
    throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
  }
  return matched[1];
}

// Design §5.4 puts authentication in the API gateway — common/ — and lets it depend on Identity.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly revocations: RevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = await this.tokens.verifyAccessToken(bearerTokenOf(request));

    if (await this.revocations.isRevoked(principal)) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Session has been revoked');
    }
    request.principal = principal;
    return true;
  }
}
