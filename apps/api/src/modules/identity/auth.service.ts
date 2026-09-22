import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import { AuditService } from '../audit/audit.service';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { LoginAttemptsRepository } from './login-attempts.repository';
import { PasswordService } from './password.service';
import { UsersRepository, type UserRecord } from './users.repository';

const ACTIVE = 'active';

export interface LoginAttemptContext {
  email: string;
  password: string;
  ip: string | null;
  correlationId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly attempts: LoginAttemptsRepository,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  // FR-58, FR-65. Lockout is tested before the rate limit because ten consecutive failures trip
  // both at once, and Detail gives that eleventh attempt to AUTH_ACCOUNT_LOCKED. The rate limit
  // still has work: ten noisy attempts that include a success never lock, but are still too many.
  async authenticate(attempt: LoginAttemptContext): Promise<UserRecord> {
    const email = attempt.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    await this.refuseIfLocked(email, user, attempt);
    await this.refuseIfRateLimited(email, user, attempt);

    const matched = await this.passwords.verifyWithConstantCost(
      user?.passwordHash ?? null,
      attempt.password,
    );
    const succeeded = matched && user !== undefined && user.status === ACTIVE;

    await this.attempts.record({ email, userId: user?.id ?? null, succeeded, ip: attempt.ip });

    if (!succeeded || !user) {
      await this.lockIfExhausted(email, user, attempt);
      await this.recordAttempt(attempt, user, AUDIT_ACTIONS.AUTH_LOGIN_FAILED, {
        reason: user === undefined ? 'unknown_email' : 'bad_password',
      });
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    await this.clearLock(user);
    await this.recordAttempt(attempt, user, AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED, {});
    return user;
  }

  // The email is recorded, never the password, and never a hash of it either: a hash of a guessed
  // password is still a guess at a password, written down where an auditor can read it.
  private recordAttempt(
    attempt: LoginAttemptContext,
    user: UserRecord | undefined,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    detail: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.recordIndependently({
      action,
      objectKind: AUDIT_OBJECTS.USER,
      objectId: user?.id ?? null,
      actorUserId: user?.id ?? null,
      actorIp: attempt.ip,
      correlationId: attempt.correlationId,
      detail: { ...detail, email: attempt.email.trim().toLowerCase() },
    });
  }

  private async refuseIfLocked(
    email: string,
    user: UserRecord | undefined,
    attempt: LoginAttemptContext,
  ): Promise<void> {
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.recordAttempt(attempt, user, AUDIT_ACTIONS.AUTH_LOGIN_FAILED, {
        reason: 'account_locked',
      });
      throw new AppException('AUTH_ACCOUNT_LOCKED', 'Account is locked; try again later');
    }
  }

  // The limit is checked before the password, so a client past it costs one indexed count
  // rather than an Argon2id verification. A refused attempt is not recorded: the window counts
  // attempts that were actually evaluated, or hammering would extend the block for ever.
  private async refuseIfRateLimited(
    email: string,
    user: UserRecord | undefined,
    attempt: LoginAttemptContext,
  ): Promise<void> {
    const since = new Date(Date.now() - this.config.LOGIN_RATE_LIMIT_WINDOW_MS);
    const recent = await this.attempts.countSince(email, since);
    if (recent >= this.config.LOGIN_RATE_LIMIT_MAX) {
      await this.recordAttempt(attempt, user, AUDIT_ACTIONS.AUTH_LOGIN_FAILED, {
        reason: 'rate_limited',
      });
      throw new AppException('RATE_LIMITED', 'Too many login attempts; try again later');
    }
  }

  // Counted since the last success rather than over a window: one correct password clears it,
  // which is what "a correct password after 9 failures clears the count" asks for.
  private async lockIfExhausted(
    email: string,
    user: UserRecord | undefined,
    attempt: LoginAttemptContext,
  ): Promise<void> {
    if (!user) {
      return;
    }
    const failures = await this.attempts.countFailuresSinceLastSuccess(email);
    if (failures >= this.config.LOCKOUT_THRESHOLD) {
      await this.users.setLockedUntil(
        user.id,
        new Date(Date.now() + this.config.LOCKOUT_DURATION_MS),
      );
      await this.recordAttempt(attempt, user, AUDIT_ACTIONS.AUTH_ACCOUNT_LOCKED, { failures });
    }
  }

  private async clearLock(user: UserRecord): Promise<void> {
    if (user.lockedUntil !== null) {
      await this.users.setLockedUntil(user.id, null);
    }
  }

  // A refresh must not resurrect an account that has since been disabled: the refresh token
  // outlives the access token by hours, and nothing else on that path consults `users`.
  async activeUser(userId: string): Promise<UserRecord> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== ACTIVE) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Account is not available');
    }
    // Q-16. A refresh token outlives the access token by hours, so without this a holder of one
    // kept minting access tokens straight through a lockout — the eleventh failed login closed the
    // front door and left the side one open.
    if (user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException('AUTH_ACCOUNT_LOCKED', 'Account is locked; try again later');
    }
    return user;
  }
}
