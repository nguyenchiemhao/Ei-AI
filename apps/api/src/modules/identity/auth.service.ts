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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly attempts: LoginAttemptsRepository,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  // FR-58, FR-65. Lockout is tested before the rate limit because ten consecutive failures trip
  // both at once, and Detail gives that eleventh attempt to AUTH_ACCOUNT_LOCKED. The rate limit
  // still has work: ten noisy attempts that include a success never lock, but are still too many.
  async authenticate(attempt: LoginAttemptContext): Promise<UserRecord> {
    const email = attempt.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    this.refuseIfLocked(user);
    await this.refuseIfRateLimited(email);

    const matched = await this.passwords.verifyWithConstantCost(
      user?.passwordHash ?? null,
      attempt.password,
    );
    const succeeded = matched && user !== undefined && user.status === ACTIVE;

    await this.attempts.record({ email, userId: user?.id ?? null, succeeded, ip: attempt.ip });

    if (!succeeded || !user) {
      await this.lockIfExhausted(email, user);
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    await this.clearLock(user);
    return user;
  }

  private refuseIfLocked(user: UserRecord | undefined): void {
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException('AUTH_ACCOUNT_LOCKED', 'Tài khoản đã bị khoá, hãy thử lại sau');
    }
  }

  // The limit is checked before the password, so a client past it costs one indexed count
  // rather than an Argon2id verification. A refused attempt is not recorded: the window counts
  // attempts that were actually evaluated, or hammering would extend the block for ever.
  private async refuseIfRateLimited(email: string): Promise<void> {
    const since = new Date(Date.now() - this.config.LOGIN_RATE_LIMIT_WINDOW_MS);
    const recent = await this.attempts.countSince(email, since);
    if (recent >= this.config.LOGIN_RATE_LIMIT_MAX) {
      throw new AppException('RATE_LIMITED', 'Quá nhiều lần đăng nhập, hãy thử lại sau');
    }
  }

  // Counted since the last success rather than over a window: one correct password clears it,
  // which is what "a correct password after 9 failures clears the count" asks for.
  private async lockIfExhausted(email: string, user: UserRecord | undefined): Promise<void> {
    if (!user) {
      return;
    }
    const failures = await this.attempts.countFailuresSinceLastSuccess(email);
    if (failures >= this.config.LOCKOUT_THRESHOLD) {
      await this.users.setLockedUntil(
        user.id,
        new Date(Date.now() + this.config.LOCKOUT_DURATION_MS),
      );
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
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Tài khoản không khả dụng');
    }
    return user;
  }
}
