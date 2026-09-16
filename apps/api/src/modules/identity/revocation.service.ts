import { Inject, Injectable } from '@nestjs/common';
import { REDIS } from '../../adapters/cache/cache.module';
import { toSeconds } from '../../common/duration';
import type { Principal } from '../../common/http.types';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';

// Only what the guard needs, so a unit test does not have to stand up Redis.
export interface RevocationStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  exists(...keys: string[]): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

const tokenKey = (tokenId: string): string => `revoked:jti:${tokenId}`;
const userKey = (userId: string): string => `revoked:user:${userId}`;

function secondsUntil(moment: Date): number {
  return Math.ceil((moment.getTime() - Date.now()) / 1000);
}

// FR-64. Access tokens are self-contained, so the only way to kill one before it expires is a
// list the guard consults. Every key carries a TTL no longer than an access token's life: once
// no live token could still carry that id, the entry has nothing left to deny.
@Injectable()
export class RevocationService {
  constructor(
    @Inject(REDIS) private readonly store: RevocationStore,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  async revokeToken(principal: Principal): Promise<void> {
    const seconds = secondsUntil(principal.expiresAt);
    if (seconds > 0) {
      await this.store.set(tokenKey(principal.tokenId), '1', 'EX', seconds);
    }
  }

  // A user's live access tokens cannot be enumerated — nothing stores them — so the moment of
  // revocation is recorded instead and every token issued before it is refused. Storing a plain
  // flag would also refuse the tokens of the *next* login, locking the victim of a stolen token
  // out of their own account for a quarter of an hour.
  async revokeUser(userId: string): Promise<void> {
    const seconds = toSeconds(this.config.ACCESS_TOKEN_TTL);
    await this.store.set(userKey(userId), String(Date.now()), 'EX', seconds);
  }

  async restoreUser(userId: string): Promise<void> {
    await this.store.del(userKey(userId));
  }

  async isRevoked(principal: Principal): Promise<boolean> {
    if ((await this.store.exists(tokenKey(principal.tokenId))) > 0) {
      return true;
    }
    const revokedAt = await this.store.get(userKey(principal.userId));
    return revokedAt !== null && principal.issuedAt.getTime() < Number(revokedAt);
  }
}
