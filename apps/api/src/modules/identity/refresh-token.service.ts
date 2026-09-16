import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { toSeconds } from '../../common/duration';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { RefreshTokenRepository, type RefreshTokenRecord } from './refresh-token.repository';
import { RevocationService } from './revocation.service';

const TOKEN_BYTES = 32;

export interface IssuedRefreshToken {
  refreshToken: string;
  familyId: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

// The token is random rather than a JWT: it carries no claims, it is checked by lookup, and a
// stolen one is useless the moment it is rotated. Only its SHA-256 reaches the database, so a
// dump of `refresh_tokens` hands nobody a usable token.
function newSecret(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashOf(token) };
}

function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly tokens: RefreshTokenRepository,
    private readonly revocations: RevocationService,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  // A login starts a new family. Every token rotated out of it stays in the same family, so
  // reuse anywhere in the chain can revoke the whole login rather than one link of it.
  async issueForUser(userId: string): Promise<IssuedRefreshToken> {
    return this.issueInFamily(userId, randomUUID());
  }

  async rotate(presented: string): Promise<RotatedRefreshToken> {
    const existing = await this.tokens.findByHash(hashOf(presented));
    await this.detectReuse(existing);
    this.refuseUnusable(existing);

    const issued = await this.issueInFamily(existing.userId, existing.familyId);
    await this.tokens.markRotated(existing.id, issued.id);
    return {
      refreshToken: issued.refreshToken,
      familyId: issued.familyId,
      expiresAt: issued.expiresAt,
      userId: existing.userId,
    };
  }

  private async issueInFamily(
    userId: string,
    familyId: string,
  ): Promise<IssuedRefreshToken & { id: string }> {
    const { token, hash } = newSecret();
    const expiresAt = new Date(Date.now() + toSeconds(this.config.REFRESH_TOKEN_TTL) * 1000);
    const record = await this.tokens.insert({ userId, familyId, tokenHash: hash, expiresAt });
    return { refreshToken: token, familyId, expiresAt, id: record.id };
  }

  // FR-64. A token presented twice means one of its two holders is not the user, and nothing
  // says which — so the whole login dies: every token of the family, and every access token
  // already issued to that user. Access tokens carry no family, so the user is the only reach
  // there is; tokens minted by the next login are newer than the revocation and survive it.
  // Tested before `refuseUnusable` because rotation sets `used_at` and `revoked_at` together,
  // and a replay would otherwise read as an ordinary invalid token.
  private async detectReuse(token: RefreshTokenRecord | undefined): Promise<void> {
    if (!token || token.usedAt === null) {
      return;
    }
    await this.tokens.revokeFamily(token.familyId, 'reuse_detected');
    await this.revocations.revokeUser(token.userId);
    throw new AppException('AUTH_TOKEN_REUSE', 'Refresh token đã được dùng; phiên đã bị thu hồi');
  }

  private refuseUnusable(
    token: RefreshTokenRecord | undefined,
  ): asserts token is RefreshTokenRecord {
    if (!token) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Refresh token không hợp lệ');
    }
    if (token.revokedAt !== null) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Refresh token không hợp lệ');
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new AppException('AUTH_TOKEN_EXPIRED', 'Refresh token đã hết hạn');
    }
  }

  // Logout kills the login rather than the one token presented: the family is what a session is.
  // A missing cookie is not an error — the access token is revoked either way, and refusing to
  // log someone out because their cookie is already gone helps nobody.
  async revokeSession(presented: string | undefined, userId: string): Promise<void> {
    if (!presented) {
      return;
    }
    const existing = await this.tokens.findByHash(hashOf(presented));
    // The cookie is not proof of who is asking — the bearer token is. Without this check a
    // request carrying one user's access token and another's cookie would end the other's
    // session, an authenticated endpoint acting on a credential it never verified.
    if (existing && existing.userId === userId) {
      await this.tokens.revokeFamily(existing.familyId, 'logout');
    }
  }
}
