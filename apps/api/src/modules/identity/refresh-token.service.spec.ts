import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env.schema';
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from './refresh-token.repository';
import type { RevocationService } from './revocation.service';
import { RefreshTokenService } from './refresh-token.service';

const TTL = { REFRESH_TOKEN_TTL: '8h' } as Env;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function repositoryWith(found?: Partial<RefreshTokenRecord>) {
  const inserted: NewRefreshToken[] = [];
  const insert = vi.fn(async (token: NewRefreshToken): Promise<RefreshTokenRecord> => {
    inserted.push(token);
    return {
      id: `rt-${inserted.length}`,
      userId: token.userId,
      familyId: token.familyId,
      expiresAt: token.expiresAt,
      usedAt: null,
      revokedAt: null,
    };
  });
  const findByHash = vi.fn().mockResolvedValue(
    found === undefined
      ? undefined
      : {
          id: 'rt-old',
          userId: 'u-1',
          familyId: 'fam-1',
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
          revokedAt: null,
          ...found,
        },
  );
  const markRotated = vi.fn().mockResolvedValue(undefined);
  const revokeFamily = vi.fn().mockResolvedValue(1);
  const revokeUser = vi.fn().mockResolvedValue(undefined);
  const repository = {
    insert,
    findByHash,
    markRotated,
    revokeFamily,
  } as unknown as RefreshTokenRepository;
  const revocations = { revokeUser } as unknown as RevocationService;
  return {
    service: new RefreshTokenService(repository, revocations, TTL),
    inserted,
    markRotated,
    findByHash,
    revokeFamily,
    revokeUser,
  };
}

async function refusalOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('the service accepted a token it should have refused');
  } catch (error) {
    return error as AppException;
  }
}

describe('RefreshTokenService', () => {
  it('stores only the SHA-256 of the token it hands back', async () => {
    const { service, inserted } = repositoryWith();

    const issued = await service.issueForUser('u-1');

    expect(inserted[0]?.tokenHash).toBe(sha256(issued.refreshToken));
    expect(inserted[0]?.tokenHash).not.toBe(issued.refreshToken);
    expect(JSON.stringify(inserted)).not.toContain(issued.refreshToken);
  });

  it('starts a new family for every login', async () => {
    const { service } = repositoryWith();

    const first = await service.issueForUser('u-1');
    const second = await service.issueForUser('u-1');

    expect(first.familyId).not.toBe(second.familyId);
    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it('takes the lifetime from configuration rather than a constant', async () => {
    const { service } = repositoryWith();
    const before = Date.now();

    const issued = await service.issueForUser('u-1');

    expect(issued.expiresAt.getTime() - before).toBeGreaterThanOrEqual(8 * 3600 * 1000 - 1000);
    expect(issued.expiresAt.getTime() - before).toBeLessThan(8 * 3600 * 1000 + 5000);
  });

  it('rotates into a new token that stays in the same family', async () => {
    const { service, inserted } = repositoryWith({});

    const rotated = await service.rotate('presented-token');

    expect(rotated.familyId).toBe('fam-1');
    expect(rotated.userId).toBe('u-1');
    expect(inserted[0]?.familyId).toBe('fam-1');
    expect(rotated.refreshToken).not.toBe('presented-token');
  });

  it('marks the presented token rotated and points it at its replacement', async () => {
    const { service, markRotated } = repositoryWith({});

    await service.rotate('presented-token');

    expect(markRotated).toHaveBeenCalledWith('rt-old', 'rt-1');
  });

  it('looks the token up by its hash, never by the token itself', async () => {
    const { service, findByHash } = repositoryWith({});

    await service.rotate('presented-token');

    expect(findByHash).toHaveBeenCalledWith(sha256('presented-token'));
  });

  // Rotation writes used_at *and* revoked_at, so this is the shape a replayed token really has.
  // A fixture that set only used_at let a defect through: revoked_at was tested first and the
  // replay read as an ordinary invalid token, which would have left reuse detection dead.
  it('refuses a rotated token as reuse, not as merely invalid', async () => {
    const { service } = repositoryWith({
      usedAt: new Date(),
      revokedAt: new Date(),
    });

    expect((await refusalOf(service.rotate('presented-token'))).code).toBe('AUTH_TOKEN_REUSE');
  });

  it('refuses a revoked-but-never-used token without calling it reuse', async () => {
    const { service } = repositoryWith({ revokedAt: new Date(), usedAt: null });

    expect((await refusalOf(service.rotate('presented-token'))).code).toBe(
      'AUTH_INVALID_CREDENTIALS',
    );
  });

  it('refuses an expired token', async () => {
    const { service } = repositoryWith({ expiresAt: new Date(Date.now() - 1000) });

    expect((await refusalOf(service.rotate('presented-token'))).code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('refuses a token that is not in the table at all', async () => {
    const { service } = repositoryWith();

    expect((await refusalOf(service.rotate('never-issued'))).code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // "Replaying token 1 after rotating to token 2 kills both": the family carries token 2, and
  // the user entry carries every access token already handed out.
  it("kills the whole family and the user's live access tokens on a replay", async () => {
    const { service, revokeFamily, revokeUser } = repositoryWith({
      usedAt: new Date(),
      revokedAt: new Date(),
    });

    await refusalOf(service.rotate('presented-token'));

    expect(revokeFamily).toHaveBeenCalledWith('fam-1', 'reuse_detected');
    expect(revokeUser).toHaveBeenCalledWith('u-1');
  });

  it('leaves the family alone when the token was simply revoked, never used', async () => {
    const { service, revokeFamily, revokeUser } = repositoryWith({
      revokedAt: new Date(),
      usedAt: null,
    });

    await refusalOf(service.rotate('presented-token'));

    expect(revokeFamily).not.toHaveBeenCalled();
    expect(revokeUser).not.toHaveBeenCalled();
  });

  it('revokes nothing on an ordinary rotation', async () => {
    const { service, revokeFamily, revokeUser } = repositoryWith({});

    await service.rotate('presented-token');

    expect(revokeFamily).not.toHaveBeenCalled();
    expect(revokeUser).not.toHaveBeenCalled();
  });

  it('revokes the whole family on logout, not just the token presented', async () => {
    const { service, revokeFamily } = repositoryWith({});

    await service.revokeSession('presented-token', 'u-1');

    expect(revokeFamily).toHaveBeenCalledWith('fam-1', 'logout');
  });

  // The cookie says nothing about who is asking; the bearer token does. Without the check, a
  // request carrying one user's access token and another's cookie ends the other's session.
  it('ignores a cookie belonging to somebody else', async () => {
    const { service, revokeFamily } = repositoryWith({});

    await service.revokeSession('presented-token', 'a-different-user');

    expect(revokeFamily).not.toHaveBeenCalled();
  });

  it('logs out quietly when the cookie is already gone', async () => {
    const { service, revokeFamily, findByHash } = repositoryWith({});

    await expect(service.revokeSession(undefined, 'u-1')).resolves.toBeUndefined();

    expect(findByHash).not.toHaveBeenCalled();
    expect(revokeFamily).not.toHaveBeenCalled();
  });

  it('logs out quietly when the cookie names a token that is not there', async () => {
    const { service, revokeFamily } = repositoryWith();

    await expect(service.revokeSession('never-issued', 'u-1')).resolves.toBeUndefined();

    expect(revokeFamily).not.toHaveBeenCalled();
  });
});
