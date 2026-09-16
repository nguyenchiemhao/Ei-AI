import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env.schema';
import { PasswordService } from './password.service';

// The exact string the seed writes, which argon2 cannot parse: logging in as a seeded user
// must read as wrong credentials rather than as a server error.
const SEED_PLACEHOLDER = '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1wbGFjZWhvbGRlcg$c2VlZA';

function serviceWithMinimum(minimum: number): PasswordService {
  return new PasswordService({ PASSWORD_MIN_LENGTH: minimum } as Env);
}

describe('PasswordService', () => {
  it('refuses a password below the configured minimum', async () => {
    const service = serviceWithMinimum(12);

    await expect(service.hash('short')).rejects.toBeInstanceOf(AppException);
  });

  it('names the policy that refused, not a generic failure', async () => {
    const service = serviceWithMinimum(12);

    await service.hash('x'.repeat(11)).then(
      () => expect.unreachable('an 11-character password was accepted under a minimum of 12'),
      (error: AppException) => {
        expect(error.code).toBe('VALIDATION_FAILED');
        expect(error.detail).toContain('12');
      },
    );
  });

  it('follows the configured minimum rather than a constant', async () => {
    await expect(serviceWithMinimum(20).hash('x'.repeat(14))).rejects.toBeInstanceOf(AppException);
    await expect(serviceWithMinimum(8).hash('x'.repeat(14))).resolves.toBeTypeOf('string');
  });

  it('stores an Argon2id hash with a salt unique to each call', async () => {
    const service = serviceWithMinimum(12);

    const first = await service.hash('correct horse battery');
    const second = await service.hash('correct horse battery');

    expect(first).toMatch(/^\$argon2id\$/);
    expect(second).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
  });

  it('verifies the password it hashed and refuses another', async () => {
    const service = serviceWithMinimum(12);
    const stored = await service.hash('correct horse battery');

    await expect(service.verify(stored, 'correct horse battery')).resolves.toBe(true);
    await expect(service.verify(stored, 'wrong horse battery')).resolves.toBe(false);
  });

  // The placeholder is well formed enough for argon2 to parse, so it simply does not match and
  // no exception is involved. Naming that separately from the case below matters: a single test
  // over both would pass without the catch ever running.
  it('returns false for the seed placeholder, which parses but never matches', async () => {
    const service = serviceWithMinimum(12);

    await expect(service.verify(SEED_PLACEHOLDER, 'anything at all')).resolves.toBe(false);
  });

  it.each([
    ['an empty hash', ''],
    ['a string that is not a hash', 'hello'],
    ['a bcrypt hash', '$2b$12$abcdefghijklmnopqrstuv'],
    ['a truncated argon2 hash', '$argon2id$v=19$'],
  ])('turns %s into a failed verification rather than a thrown error', async (_name, stored) => {
    const service = serviceWithMinimum(12);

    await expect(service.verify(stored, 'anything at all')).resolves.toBe(false);
  });

  it('verifies against a freshly made decoy when there is no stored hash', async () => {
    const service = serviceWithMinimum(12);
    const verify = vi.spyOn(service, 'verify');

    await expect(service.verifyWithConstantCost(null, 'anything')).resolves.toBe(false);

    expect(verify).toHaveBeenCalledOnce();
    expect(verify.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/);
  });

  it('reuses one decoy rather than hashing a new one per attempt', async () => {
    const service = serviceWithMinimum(12);
    const verify = vi.spyOn(service, 'verify');

    await service.verifyWithConstantCost(null, 'a');
    await service.verifyWithConstantCost(null, 'b');

    expect(verify.mock.calls[0]?.[0]).toBe(verify.mock.calls[1]?.[0]);
  });

  it('refuses even a password that matches the stored hash when there is none', async () => {
    const service = serviceWithMinimum(12);
    const stored = await service.hash('correct horse battery');

    await expect(service.verifyWithConstantCost(stored, 'correct horse battery')).resolves.toBe(
      true,
    );
    await expect(service.verifyWithConstantCost(null, 'correct horse battery')).resolves.toBe(
      false,
    );
  });

  it('pays for a decoy even when the stored hash cannot be decoded at all', async () => {
    const service = serviceWithMinimum(12);
    const verify = vi.spyOn(service, 'verify');

    await expect(service.verifyWithConstantCost('not-a-hash', 'anything')).resolves.toBe(false);

    expect(verify).toHaveBeenCalledOnce();
  });
});
