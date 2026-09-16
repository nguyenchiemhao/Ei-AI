import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';

export interface NewLoginAttempt {
  email: string;
  userId: string | null;
  succeeded: boolean;
  ip: string | null;
}

@Injectable()
export class LoginAttemptsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(attempt: NewLoginAttempt): Promise<void> {
    await this.db
      .insertInto('login_attempts')
      .values({
        email: attempt.email,
        user_id: attempt.userId,
        succeeded: attempt.succeeded,
        ip: attempt.ip,
      })
      .execute();
  }

  // FR-65 counts by email rather than by user id, so attempts against an address that has no
  // account are counted too — otherwise the rate limit answers "this email is unknown".
  async countSince(email: string, since: Date): Promise<number> {
    const row = await this.db
      .selectFrom('login_attempts')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('email', '=', email)
      .where('attempted_at', '>=', since)
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }

  // Consecutive failures, which is not the same as failures in a window: one success clears it.
  async countFailuresSinceLastSuccess(email: string): Promise<number> {
    const lastSuccess = await this.db
      .selectFrom('login_attempts')
      .select('attempted_at')
      .where('email', '=', email)
      .where('succeeded', '=', true)
      .orderBy('attempted_at', 'desc')
      .executeTakeFirst();

    let query = this.db
      .selectFrom('login_attempts')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('email', '=', email)
      .where('succeeded', '=', false);

    if (lastSuccess) {
      query = query.where('attempted_at', '>', lastSuccess.attempted_at);
    }
    const row = await query.executeTakeFirstOrThrow();
    return Number(row.total);
  }
}
