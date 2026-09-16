import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import type { RevocationService } from '../../modules/identity/revocation.service';
import { TokenService } from '../../modules/identity/token.service';
import type { UserRecord } from '../../modules/identity/users.repository';
import type { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../http.types';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'x'.repeat(48);

const USER: UserRecord = {
  id: 'u-1',
  email: 'member@ei-ai.local',
  displayName: 'Member',
  passwordHash: '$argon2id$stored',
  systemRole: 'Member',
  status: 'active',
  lockedUntil: null,
};

function tokensWithTtl(ttl: string): TokenService {
  return new TokenService(new JwtService({ secret: SECRET }), { ACCESS_TOKEN_TTL: ttl } as Env);
}

function guardFor(tokens: TokenService, revoked = false): JwtAuthGuard {
  const revocations = {
    isRevoked: vi.fn().mockResolvedValue(revoked),
  } as unknown as RevocationService;
  return new JwtAuthGuard(tokens, revocations);
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function requestWith(authorization?: string): AuthenticatedRequest {
  return { url: '/protected', headers: authorization ? { authorization } : {} };
}

async function refusalOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('the guard admitted the request');
  } catch (error) {
    return error as AppException;
  }
}

describe('JwtAuthGuard', () => {
  it('admits a valid bearer token and leaves the principal on the request', async () => {
    const tokens = tokensWithTtl('15m');
    const { accessToken, tokenId } = await tokens.issueAccessToken(USER);
    const request = requestWith(`Bearer ${accessToken}`);

    await expect(guardFor(tokens).canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.principal).toMatchObject({ userId: 'u-1', systemRole: 'Member', tokenId });
    expect(request.principal?.expiresAt).toBeInstanceOf(Date);
  });

  it('refuses an expired token with the documented code', async () => {
    const tokens = tokensWithTtl('15m');
    const expired = new JwtService({ secret: SECRET }).sign({
      sub: USER.id,
      role: USER.systemRole,
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    const refusal = await refusalOf(
      guardFor(tokens).canActivate(contextFor(requestWith(`Bearer ${expired}`))),
    );

    expect(refusal.code).toBe('AUTH_TOKEN_EXPIRED');
    expect(refusal.getStatus()).toBe(401);
  });

  it('refuses a request with no Authorization header', async () => {
    const refusal = await refusalOf(
      guardFor(tokensWithTtl('15m')).canActivate(contextFor(requestWith())),
    );

    expect(refusal.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('refuses a header that is not a bearer scheme', async () => {
    const refusal = await refusalOf(
      guardFor(tokensWithTtl('15m')).canActivate(contextFor(requestWith('Basic abc123'))),
    );

    expect(refusal.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // An access token is self-contained, so the only thing that can kill it early is the list.
  it('refuses a token the revocation list names, however valid its signature', async () => {
    const tokens = tokensWithTtl('15m');
    const { accessToken } = await tokens.issueAccessToken(USER);
    const request = requestWith(`Bearer ${accessToken}`);

    const refusal = await refusalOf(guardFor(tokens, true).canActivate(contextFor(request)));

    expect(refusal.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(request.principal).toBeUndefined();
  });
});
