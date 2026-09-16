import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie';

const envWith = (overrides: Partial<Env>): Env =>
  ({ NODE_ENV: 'development', REFRESH_TOKEN_TTL: '8h', ...overrides }) as Env;

describe('refreshCookieOptions', () => {
  it('keeps the cookie away from scripts and from other sites', () => {
    const options = refreshCookieOptions(envWith({}));

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('strict');
  });

  it('scopes the cookie to the endpoints that consume it', () => {
    expect(refreshCookieOptions(envWith({})).path).toBe('/auth');
    expect(REFRESH_COOKIE).toBe('ei_refresh');
  });

  it('matches the cookie lifetime to the configured token lifetime', () => {
    expect(refreshCookieOptions(envWith({ REFRESH_TOKEN_TTL: '8h' })).maxAge).toBe(28_800_000);
    expect(refreshCookieOptions(envWith({ REFRESH_TOKEN_TTL: '30m' })).maxAge).toBe(1_800_000);
  });

  // A Secure cookie is dropped over plain http, so development would never receive one.
  it('requires https in production and not in development', () => {
    expect(refreshCookieOptions(envWith({ NODE_ENV: 'production' })).secure).toBe(true);
    expect(refreshCookieOptions(envWith({ NODE_ENV: 'development' })).secure).toBe(false);
  });
});
