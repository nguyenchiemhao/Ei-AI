import { randomUUID } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';

const ARGON2ID = { algorithm: Algorithm.Argon2id } as const;

// FR-58. Argon2id with a per-hash salt, and a policy whose numbers live in the environment
// rather than in this file, because a customer changes them and a customer cannot rebuild.
@Injectable()
export class PasswordService {
  private decoy: Promise<string> | undefined;

  constructor(@Inject(CONFIG) private readonly config: Env) {}

  assertMeetsPolicy(password: string): void {
    const minimum = this.config.PASSWORD_MIN_LENGTH;
    if (password.length < minimum) {
      throw new AppException(
        'VALIDATION_FAILED',
        `Password must be at least ${minimum} characters`,
        {
          errors: [{ path: 'password', message: `minimum length is ${minimum}` }],
        },
      );
    }
  }

  async hash(password: string): Promise<string> {
    this.assertMeetsPolicy(password);
    return hash(password, ARGON2ID);
  }

  // A stored hash that argon2 cannot parse is a failed verification, not a server error: the
  // seed writes a deliberately unusable placeholder, and logging in against it must read as
  // wrong credentials rather than as a 500.
  async verify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }

  // FR-65. An account that does not exist still costs one verification, so response time does
  // not say which emails are registered. The decoy is hashed here rather than pasted in as a
  // constant: only a hash made with these parameters costs what a real one costs.
  async verifyWithConstantCost(storedHash: string | null, password: string): Promise<boolean> {
    const matched = await this.verify(storedHash ?? (await this.decoyHash()), password);
    return storedHash !== null && matched;
  }

  private decoyHash(): Promise<string> {
    this.decoy ??= hash(randomUUID(), ARGON2ID);
    return this.decoy;
  }
}
