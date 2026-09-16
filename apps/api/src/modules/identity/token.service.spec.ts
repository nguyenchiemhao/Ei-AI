import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env.schema';
import { TokenService } from './token.service';
import type { UserRecord } from './users.repository';

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

function serviceWithTtl(ttl: string, secret = SECRET): TokenService {
  return new TokenService(new JwtService({ secret }), { ACCESS_TOKEN_TTL: ttl } as Env);
}

describe('TokenService', () => {
  it('issues a token that verifies back to the user and role', async () => {
    const service = serviceWithTtl('15m');

    const { accessToken, tokenId } = await service.issueAccessToken(USER);

    const principal = await service.verifyAccessToken(accessToken);

    expect(principal).toMatchObject({ userId: 'u-1', systemRole: 'Member', tokenId });
    // The guard needs the expiry so a revocation entry can live exactly as long as the token.
    expect(principal.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
  });

  it('gives every token its own id, so one can be revoked without the rest', async () => {
    const service = serviceWithTtl('15m');

    const first = await service.issueAccessToken(USER);
    const second = await service.issueAccessToken(USER);

    expect(first.tokenId).not.toBe(second.tokenId);
    expect(first.accessToken).not.toBe(second.accessToken);
  });

  it('takes its lifetime from configuration rather than a constant', async () => {
    const { accessToken } = await serviceWithTtl('15m').issueAccessToken(USER);
    const [, payload] = accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()) as {
      iat: number;
      exp: number;
    };

    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('answers an expired token with AUTH_TOKEN_EXPIRED, not with bad credentials', async () => {
    const service = serviceWithTtl('15m');
    const expired = new JwtService({ secret: SECRET }).sign({
      sub: USER.id,
      role: USER.systemRole,
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    await service.verifyAccessToken(expired).then(
      () => expect.unreachable('an expired token verified'),
      (error: AppException) => {
        expect(error.code).toBe('AUTH_TOKEN_EXPIRED');
        expect(error.getStatus()).toBe(401);
      },
    );
  });

  it('answers a token signed with another key as invalid rather than expired', async () => {
    const { accessToken } = await serviceWithTtl('15m', 'y'.repeat(48)).issueAccessToken(USER);

    await serviceWithTtl('15m')
      .verifyAccessToken(accessToken)
      .then(
        () => expect.unreachable('a forged token verified'),
        (error: AppException) => expect(error.code).toBe('AUTH_INVALID_CREDENTIALS'),
      );
  });

  it('answers a garbage string as invalid', async () => {
    await expect(serviceWithTtl('15m').verifyAccessToken('not-a-token')).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
