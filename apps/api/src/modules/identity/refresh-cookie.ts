import { toSeconds } from '../../common/duration';
import type { CookieOptions } from '../../common/http.types';
import type { Env } from '../../config/env.schema';

export const REFRESH_COOKIE = 'ei_refresh';

// FR-64. HttpOnly so no script can read it, SameSite=Strict so no other site can cause it to be
// sent, and Path=/auth so it travels only to the two endpoints that consume it. Secure is tied
// to the environment because a Secure cookie is silently dropped over plain http in development.
export function refreshCookieOptions(config: Env): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    path: '/auth',
    maxAge: toSeconds(config.REFRESH_TOKEN_TTL) * 1000,
  };
}
