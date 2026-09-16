import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';

export type RevokedReason = 'rotated' | 'reuse_detected' | 'logout' | 'account_disabled';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

const COLUMNS = ['id', 'user_id', 'family_id', 'expires_at', 'used_at', 'revoked_at'] as const;

interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
}

function toRecord(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
  };
}

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async insert(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    const row = await this.db
      .insertInto('refresh_tokens')
      .values({
        user_id: token.userId,
        family_id: token.familyId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toRecord(row as RefreshTokenRow);
  }

  // Only the hash is ever stored, so this is the one way back from a presented token to a row.
  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.db
      .selectFrom('refresh_tokens')
      .select(COLUMNS)
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row ? toRecord(row as RefreshTokenRow) : undefined;
  }

  async markRotated(id: string, replacedBy: string): Promise<void> {
    await this.db
      .updateTable('refresh_tokens')
      .set({
        used_at: new Date(),
        revoked_at: new Date(),
        revoked_reason: 'rotated',
        replaced_by: replacedBy,
      })
      .where('id', '=', id)
      .execute();
  }

  // Revoking whole families rather than single tokens is what FR-64's reuse detection needs:
  // one replayed token invalidates every descendant of the login it came from.
  async revokeFamily(familyId: string, reason: RevokedReason): Promise<number> {
    const result = await this.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('family_id', '=', familyId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }
}
