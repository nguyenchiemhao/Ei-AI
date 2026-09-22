import type { AuditService } from '../audit/audit.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import type { LoginAttemptsRepository } from './login-attempts.repository';
import type { PasswordService } from './password.service';
import type { UserRecord, UsersRepository } from './users.repository';

const ACTIVE_USER: UserRecord = {
  id: 'u-1',
  email: 'member@ei-ai.local',
  displayName: 'Member',
  passwordHash: '$argon2id$stored',
  systemRole: 'Member',
  status: 'active',
  lockedUntil: null,
};

const LIMITS = {
  LOGIN_RATE_LIMIT_MAX: 10,
  LOGIN_RATE_LIMIT_WINDOW_MS: 900000,
  LOCKOUT_THRESHOLD: 10,
  LOCKOUT_DURATION_MS: 900000,
} as Env;

function serviceFor(
  user: UserRecord | undefined,
  matched: boolean,
  { recentAttempts = 0, consecutiveFailures = 0 } = {},
) {
  const verifyWithConstantCost = vi.fn().mockResolvedValue(matched);
  const record = vi.fn().mockResolvedValue(undefined);
  const countSince = vi.fn().mockResolvedValue(recentAttempts);
  const countFailuresSinceLastSuccess = vi.fn().mockResolvedValue(consecutiveFailures);
  const setLockedUntil = vi.fn().mockResolvedValue(undefined);
  const users = {
    findByEmail: vi.fn().mockResolvedValue(user),
    setLockedUntil,
  } as unknown as UsersRepository;
  const passwords = { verifyWithConstantCost } as unknown as PasswordService;
  const attempts = {
    record,
    countSince,
    countFailuresSinceLastSuccess,
  } as unknown as LoginAttemptsRepository;
  return {
    service: new AuthService(users, passwords, attempts, auditDouble, LIMITS),
    verifyWithConstantCost,
    record,
    countSince,
    setLockedUntil,
  };
}

// Authentication is not transactional, so its events go through recordIndependently. The double
// collects them so a test can count what an auditor would see.
const auditedEvents: { action: string; detail?: Record<string, unknown> }[] = [];
const auditDouble = {
  recordIndependently: vi.fn((record: { action: string; detail?: Record<string, unknown> }) => {
    auditedEvents.push(record);
    return Promise.resolve();
  }),
} as unknown as AuditService;

beforeEach(() => {
  auditedEvents.length = 0;
  vi.mocked(auditDouble.recordIndependently).mockClear();
});

function login(service: AuthService, email = 'member@ei-ai.local', password = 'x') {
  return service.authenticate({ email, password, ip: '10.0.0.1', correlationId: 'c-1' });
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('authenticate resolved where it should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return error as AppException;
  }
}

describe('AuthService.authenticate', () => {
  it('returns the user when the password matches', async () => {
    const { service } = serviceFor(ACTIVE_USER, true);

    await expect(login(service)).resolves.toBe(ACTIVE_USER);
  });

  it('answers an unknown email and a wrong password with the identical failure', async () => {
    const unknown = await rejectionOf(
      login(serviceFor(undefined, false).service, 'nobody@ei-ai.local'),
    );
    const wrong = await rejectionOf(login(serviceFor(ACTIVE_USER, false).service));

    expect(unknown.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknown.code).toBe(wrong.code);
    expect(unknown.detail).toBe(wrong.detail);
  });

  it('still verifies when the account does not exist, so the two paths cost the same', async () => {
    const { service, verifyWithConstantCost } = serviceFor(undefined, false);

    await rejectionOf(login(service, 'nobody@ei-ai.local'));

    expect(verifyWithConstantCost).toHaveBeenCalledWith(null, 'x');
  });

  it('refuses a disabled account without saying that is why', async () => {
    const { service } = serviceFor({ ...ACTIVE_USER, status: 'disabled' }, true);

    expect((await rejectionOf(login(service))).code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('records the outcome of every attempt it evaluates', async () => {
    const { service, record } = serviceFor(ACTIVE_USER, true);

    await login(service);

    expect(record).toHaveBeenCalledWith({
      email: 'member@ei-ai.local',
      userId: 'u-1',
      succeeded: true,
      ip: '10.0.0.1',
    });
  });

  it('records a failed attempt against an unknown email, not only against known accounts', async () => {
    const { service, record } = serviceFor(undefined, false);

    await rejectionOf(login(service, 'nobody@ei-ai.local'));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'nobody@ei-ai.local', userId: null, succeeded: false }),
    );
  });

  it('lets the tenth attempt through and refuses the eleventh', async () => {
    await expect(login(serviceFor(ACTIVE_USER, true, { recentAttempts: 9 }).service)).resolves.toBe(
      ACTIVE_USER,
    );

    const refusal = await rejectionOf(
      login(serviceFor(ACTIVE_USER, true, { recentAttempts: 10 }).service),
    );

    expect(refusal.code).toBe('RATE_LIMITED');
    expect(refusal.getStatus()).toBe(429);
  });

  // The "Done when": rate-limited *before the password is even checked*.
  it('refuses a rate-limited attempt without verifying the password or recording it', async () => {
    const { service, verifyWithConstantCost, record } = serviceFor(ACTIVE_USER, true, {
      recentAttempts: 10,
    });

    await rejectionOf(login(service));

    expect(verifyWithConstantCost).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('counts the window from configuration rather than a constant', async () => {
    const { service, countSince } = serviceFor(ACTIVE_USER, true);
    const before = Date.now();

    await login(service);

    // The service reads its own clock between these two, so the window is bracketed rather than
    // compared to one side of it: a millisecond ticking mid-call made this fail on CI.
    const after = Date.now();
    const [email, since] = countSince.mock.calls[0] as [string, Date];
    expect(email).toBe('member@ei-ai.local');
    expect(after - since.getTime()).toBeGreaterThanOrEqual(900000);
    expect(before - since.getTime()).toBeLessThanOrEqual(900000);
  });

  it('locks the account once the failures reach the threshold', async () => {
    const { service, setLockedUntil } = serviceFor(ACTIVE_USER, false, {
      consecutiveFailures: 10,
    });
    const before = Date.now();

    await rejectionOf(login(service));

    const [id, until] = setLockedUntil.mock.calls[0] as [string, Date];
    expect(id).toBe('u-1');
    expect(until.getTime() - before).toBeGreaterThanOrEqual(900000 - 1000);
  });

  it('does not lock while the failures are still below the threshold', async () => {
    const { service, setLockedUntil } = serviceFor(ACTIVE_USER, false, {
      consecutiveFailures: 9,
    });

    await rejectionOf(login(service));

    expect(setLockedUntil).not.toHaveBeenCalled();
  });

  it('refuses a locked account with 423 and never checks the password', async () => {
    const locked = { ...ACTIVE_USER, lockedUntil: new Date(Date.now() + 60_000) };
    const { service, verifyWithConstantCost, record } = serviceFor(locked, true);

    const refusal = await rejectionOf(login(service));

    expect(refusal.code).toBe('AUTH_ACCOUNT_LOCKED');
    expect(refusal.getStatus()).toBe(423);
    expect(verifyWithConstantCost).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  // Ten consecutive failures trip the rate limit and the lockout at the same moment; Detail
  // gives that attempt to AUTH_ACCOUNT_LOCKED, so the lockout has to be tested first.
  it('answers 423 rather than 429 when both thresholds are reached', async () => {
    const locked = { ...ACTIVE_USER, lockedUntil: new Date(Date.now() + 60_000) };
    const { service } = serviceFor(locked, true, { recentAttempts: 10 });

    expect((await rejectionOf(login(service))).code).toBe('AUTH_ACCOUNT_LOCKED');
  });

  it('treats an expired lock as no lock at all', async () => {
    const wasLocked = { ...ACTIVE_USER, lockedUntil: new Date(Date.now() - 1000) };
    const { service } = serviceFor(wasLocked, true);

    await expect(login(service)).resolves.toBe(wasLocked);
  });

  it('clears the lock when a password finally matches', async () => {
    const wasLocked = { ...ACTIVE_USER, lockedUntil: new Date(Date.now() - 1000) };
    const { service, setLockedUntil } = serviceFor(wasLocked, true);

    await login(service);

    expect(setLockedUntil).toHaveBeenCalledWith('u-1', null);
  });
});

// The refresh path's only look at `users`. Written after a coverage report showed the method
// had no unit test at all: the integration suite exercises it, and that never reaches stage 3.
describe('AuthService.activeUser', () => {
  function serviceForId(user: UserRecord | undefined) {
    const users = { findById: vi.fn().mockResolvedValue(user) } as unknown as UsersRepository;
    return new AuthService(
      users,
      {} as unknown as PasswordService,
      {} as unknown as LoginAttemptsRepository,
      auditDouble,
      LIMITS,
    );
  }

  it('returns an active user', async () => {
    await expect(serviceForId(ACTIVE_USER).activeUser('u-1')).resolves.toBe(ACTIVE_USER);
  });

  it('refuses an account that has since been disabled', async () => {
    const rejection = await rejectionOf(
      serviceForId({ ...ACTIVE_USER, status: 'disabled' }).activeUser('u-1'),
    );

    expect(rejection.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('refuses an account that has since been deleted', async () => {
    const rejection = await rejectionOf(serviceForId(undefined).activeUser('u-1'));

    expect(rejection.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('what authentication records', () => {
  it('records one event for a successful login', async () => {
    const { service } = serviceFor(ACTIVE_USER, true);
    await login(service);
    expect(auditedEvents.map((e) => e.action)).toEqual(['auth.login.succeeded']);
  });

  it('records a failure with the reason, and never the password', async () => {
    const { service } = serviceFor(ACTIVE_USER, false);
    await expect(login(service, 'member@ei-ai.local', 'wrong-password')).rejects.toThrow();
    expect(auditedEvents).toHaveLength(1);
    expect(auditedEvents[0]).toMatchObject({
      action: 'auth.login.failed',
      detail: { reason: 'bad_password', email: 'member@ei-ai.local' },
    });
    expect(JSON.stringify(auditedEvents)).not.toContain('wrong-password');
  });

  it('tells an unknown email from a bad password, which an auditor needs', async () => {
    const { service } = serviceFor(undefined, false);
    await expect(login(service, 'nobody@ei-ai.local')).rejects.toThrow();
    expect(auditedEvents[0]).toMatchObject({ detail: { reason: 'unknown_email' } });
  });

  it('records the lockout as its own event beside the failure that caused it', async () => {
    const { service } = serviceFor(ACTIVE_USER, false, { consecutiveFailures: 10 });
    await expect(login(service)).rejects.toThrow();
    expect(auditedEvents.map((e) => e.action)).toEqual([
      'auth.account.locked',
      'auth.login.failed',
    ]);
  });

  it('records the refusal when an already locked account tries again', async () => {
    const locked = { ...ACTIVE_USER, lockedUntil: new Date(Date.now() + 60_000) };
    const { service } = serviceFor(locked, true);
    await expect(login(service)).rejects.toThrow();
    expect(auditedEvents[0]).toMatchObject({
      action: 'auth.login.failed',
      detail: { reason: 'account_locked' },
    });
  });

  it('records the refusal when the rate limit is what stopped it', async () => {
    const { service } = serviceFor(ACTIVE_USER, true, { recentAttempts: 10 });
    await expect(login(service)).rejects.toThrow();
    expect(auditedEvents[0]).toMatchObject({
      action: 'auth.login.failed',
      detail: { reason: 'rate_limited' },
    });
  });

  it('carries the address and the correlation id of the attempt', async () => {
    const { service } = serviceFor(ACTIVE_USER, true);
    await login(service);
    expect(auditedEvents[0]).toMatchObject({ actorIp: '10.0.0.1', correlationId: 'c-1' });
  });
});
