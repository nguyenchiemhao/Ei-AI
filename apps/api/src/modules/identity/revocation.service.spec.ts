import { describe, expect, it, vi } from 'vitest';
import type { Principal } from '../../common/http.types';
import type { Env } from '../../config/env.schema';
import { RevocationService, type RevocationStore } from './revocation.service';

const TTL = { ACCESS_TOKEN_TTL: '15m' } as Env;

const PRINCIPAL: Principal = {
  userId: 'u-1',
  systemRole: 'Member',
  tokenId: 'jti-1',
  issuedAt: new Date(Date.now() - 60_000),
  expiresAt: new Date(Date.now() + 600_000),
};

function serviceWith({ tokenListed = 0, userRevokedAt = null as string | null } = {}) {
  const store = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(userRevokedAt),
    exists: vi.fn().mockResolvedValue(tokenListed),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as RevocationStore;
  return { service: new RevocationService(store, TTL), store };
}

describe('RevocationService', () => {
  it('lists one token under its id, expiring when that token would have', async () => {
    const { service, store } = serviceWith();

    await service.revokeToken(PRINCIPAL);

    const [key, value, mode, seconds] = vi.mocked(store.set).mock.calls[0] as [
      string,
      string,
      string,
      number,
    ];
    expect(key).toBe('revoked:jti:jti-1');
    expect(value).toBe('1');
    expect(mode).toBe('EX');
    expect(seconds).toBeGreaterThan(595);
    expect(seconds).toBeLessThanOrEqual(600);
  });

  it('does not list a token that has already expired', async () => {
    const { service, store } = serviceWith();

    await service.revokeToken({ ...PRINCIPAL, expiresAt: new Date(Date.now() - 1000) });

    expect(store.set).not.toHaveBeenCalled();
  });

  // Nothing stores live access tokens, so a disabled account is listed by user instead.
  it('records the moment a user was revoked, for one access-token lifetime', async () => {
    const { service, store } = serviceWith();
    const before = Date.now();

    await service.revokeUser('u-1');

    const [key, value, mode, seconds] = vi.mocked(store.set).mock.calls[0] as [
      string,
      string,
      string,
      number,
    ];
    expect(key).toBe('revoked:user:u-1');
    expect(Number(value)).toBeGreaterThanOrEqual(before);
    expect([mode, seconds]).toEqual(['EX', 900]);
  });

  it('refuses a token listed by its own id', async () => {
    await expect(serviceWith({ tokenListed: 1 }).service.isRevoked(PRINCIPAL)).resolves.toBe(true);
  });

  it('refuses a token issued before its user was revoked', async () => {
    const service = serviceWith({ userRevokedAt: String(Date.now()) }).service;

    await expect(service.isRevoked(PRINCIPAL)).resolves.toBe(true);
  });

  // Storing a plain flag would refuse the next login too, locking the victim of a stolen token
  // out of their own account until the entry expired.
  it('admits a token issued after its user was revoked', async () => {
    const service = serviceWith({ userRevokedAt: String(Date.now() - 120_000) }).service;

    await expect(service.isRevoked(PRINCIPAL)).resolves.toBe(false);
  });

  it('admits a token when nothing is listed at all', async () => {
    await expect(serviceWith().service.isRevoked(PRINCIPAL)).resolves.toBe(false);
  });

  it('removes the user entry when the account is restored', async () => {
    const { service, store } = serviceWith();

    await service.restoreUser('u-1');

    expect(store.del).toHaveBeenCalledWith('revoked:user:u-1');
  });
});
