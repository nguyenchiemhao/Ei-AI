import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/app-exception';
import { toSeconds } from '../../common/duration';
import type { Principal } from '../../common/http.types';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { UserRecord } from './users.repository';

export interface AccessTokenClaims {
  sub: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedAccessToken {
  accessToken: string;
  tokenId: string;
}

const EXPIRED = 'TokenExpiredError';
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  // `jti` is carried from the first token rather than added later: T-3.1-10's revocation list
  // needs a per-token identity, and a claim added after tokens are in the wild is a migration.
  async issueAccessToken(user: UserRecord): Promise<IssuedAccessToken> {
    const tokenId = randomUUID();
    const claims = { sub: user.id, role: user.systemRole, jti: tokenId };
    return {
      accessToken: await this.jwt.signAsync(claims, {
        expiresIn: toSeconds(this.config.ACCESS_TOKEN_TTL),
      }),
      tokenId,
    };
  }

  // An expired token and a forged one are both 401, and a client must tell them apart: one says
  // refresh, the other says send the user back to the login screen.
  async verifyAccessToken(token: string): Promise<Principal> {
    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
      return {
        userId: claims.sub,
        systemRole: claims.role,
        tokenId: claims.jti,
        issuedAt: new Date(claims.iat * 1000),
        expiresAt: new Date(claims.exp * 1000),
      };
    } catch (error) {
      throw new AppException(
        error instanceof Error && error.name === EXPIRED
          ? 'AUTH_TOKEN_EXPIRED'
          : 'AUTH_INVALID_CREDENTIALS',
        'Access token không hợp lệ',
      );
    }
  }
}
