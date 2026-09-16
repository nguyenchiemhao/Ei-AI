import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { PasswordService } from './password.service';

// The suite drives the built application over HTTP rather than booting Nest inside vitest:
// vitest transpiles with esbuild, which emits no `design:paramtypes`, so a Nest built here has
// no dependency injection at all. Running against `dist/main.js` also tests what ships.
const ORIGIN = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const PASSWORD = 'correct horse battery staple';

let db: Client;
const created: string[] = [];

async function newUser(): Promise<string> {
  const email = `it-${randomUUID()}@ei-ai.local`;
  const hash = await new PasswordService({ PASSWORD_MIN_LENGTH: 12 } as Env).hash(PASSWORD);
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, auth_source)
     VALUES ($1, 'Integration', $2, 'local')`,
    [email, hash],
  );
  created.push(email);
  return email;
}

function refreshCookieOf(response: Response): string {
  const cookie = response.headers.get('set-cookie')?.match(/ei_refresh=([^;]*)/)?.[1];
  expect(cookie, 'the response carried no refresh cookie').toBeTruthy();
  return cookie as string;
}

const login = (email: string, password = PASSWORD): Promise<Response> =>
  fetch(`${ORIGIN}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

const refresh = (cookie: string): Promise<Response> =>
  fetch(`${ORIGIN}/auth/refresh`, { method: 'POST', headers: { cookie: `ei_refresh=${cookie}` } });

const codeOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { code?: string }).code ?? '';

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
});

afterAll(async () => {
  if (created.length > 0) {
    // login_attempts survives its user — the foreign key is ON DELETE SET NULL — so a suite that
    // deleted only the users would leave eleven rows per run in a table the rate limit queries.
    await db.query('DELETE FROM login_attempts WHERE email = ANY($1)', [created]);
    await db.query('DELETE FROM users WHERE email = ANY($1)', [created]);
  }
  await db.end();
});

// The two scenarios Detail names as this package's proving command. Each builds its own user:
// the seed writes a hash nobody can log in with, and borrowing rows is how a green test ends up
// proving nothing.
describe('identity, end to end', () => {
  it('replaying a rotated refresh token kills the whole family', async () => {
    const email = await newUser();

    const first = await login(email);
    expect(first.status).toBe(200);
    const tokenOne = refreshCookieOf(first);

    const rotated = await refresh(tokenOne);
    expect(rotated.status).toBe(200);
    const tokenTwo = refreshCookieOf(rotated);
    expect(tokenTwo).not.toBe(tokenOne);

    const replay = await refresh(tokenOne);
    expect(replay.status).toBe(401);
    expect(await codeOf(replay)).toBe('AUTH_TOKEN_REUSE');

    const descendant = await refresh(tokenTwo);
    expect(descendant.status).toBe(401);
  });

  it('the eleventh failed login is locked out, not merely refused', async () => {
    const email = await newUser();

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await login(email, 'wrong password entirely');
      expect(response.status, `attempt ${attempt}`).toBe(401);
      expect(await codeOf(response)).toBe('AUTH_INVALID_CREDENTIALS');
    }

    const eleventh = await login(email, 'wrong password entirely');
    expect(eleventh.status).toBe(423);
    expect(await codeOf(eleventh)).toBe('AUTH_ACCOUNT_LOCKED');

    const withTheRightPassword = await login(email);
    expect(withTheRightPassword.status).toBe(423);
  });
});
