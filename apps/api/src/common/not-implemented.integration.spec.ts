import { PLANNED_FEATURES } from '@ei-ai/shared-types';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../config/env.schema';
import { PasswordService } from '../modules/identity/password.service';

// The contract the 501 stubs answer with. T-5.5-01 covers every stub route; this covers the shape,
// because the WP-3.6 proving command depends on it — a stub answering 404, or answering 501 before
// the guard has spoken, would both satisfy "the route exists" and neither is what §7.1 asks for.
const ORIGIN = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';
const PASSWORD = 'correct horse battery staple';

const ADMIN_ONLY = ['/admin/users', '/admin/restore', '/admin/connectors', '/tools', '/audit'];

let db: Client;
const created: string[] = [];
const tokens = new Map<string, string>();

async function userWithRole(systemRole: string): Promise<string> {
  const email = `stub-${randomUUID()}@ei-ai.local`;
  const hash = await new PasswordService({ PASSWORD_MIN_LENGTH: 12 } as Env).hash(PASSWORD);
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, auth_source, system_role)
     VALUES ($1, 'Stub contract', $2, 'local', $3)`,
    [email, hash, systemRole],
  );
  created.push(email);
  return email;
}

async function get(email: string, path: string): Promise<{ status: number; body: Response }> {
  let token = tokens.get(email);
  if (token === undefined) {
    const login = await fetch(`${ORIGIN}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    token = ((await login.json()) as { accessToken: string }).accessToken;
    expect(token, `could not log in as ${email}`).toBeTruthy();
    tokens.set(email, token);
  }
  const response = await fetch(`${ORIGIN}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: response.status, body: response };
}

let administrator: string;
let member: string;

beforeAll(async () => {
  db = new Client({ connectionString: CONNECTION });
  await db.connect();
  administrator = await userWithRole('Administrator');
  member = await userWithRole('Member');
});

afterAll(async () => {
  await db.query(`UPDATE users SET status = 'disabled' WHERE email = ANY($1)`, [created]);
  await db.query(`DELETE FROM login_attempts WHERE email = ANY($1)`, [created]);
  await db.end();
});

describe('the 501 stubs of Detail §7.1', () => {
  it.each(ADMIN_ONLY)('answers %s with a body naming the feature and its phase', async (path) => {
    const { status, body } = await get(administrator, path);
    const problem = (await body.json()) as { code: string; feature: string; plannedPhase: string };

    expect(status).toBe(501);
    expect(problem.code).toBe('NOT_IMPLEMENTED');
    expect(Object.keys(PLANNED_FEATURES)).toContain(problem.feature);
    expect(problem.plannedPhase).toBe(
      PLANNED_FEATURES[problem.feature as keyof typeof PLANNED_FEATURES].plannedPhase,
    );
  });

  // The guard runs before the handler, so a Member never learns the feature exists. Without this
  // the stubs would be routes that answer 501 to everyone, which is a different thing entirely.
  it.each(ADMIN_ONLY)('refuses a Member at %s before the stub runs', async (path) => {
    const { status, body } = await get(member, path);
    const problem = (await body.json()) as { code: string; feature?: string };

    expect(status).toBe(403);
    expect(problem.code).toBe('AUTHZ_ROLE_FORBIDDEN');
    expect(problem.feature, 'a refused caller learnt what the route is for').toBeUndefined();
  });

  // A route that does not exist is a 404, and §7.1 is explicit that an unbuilt module must not be
  // one. This is the near miss that says the assertions above are about these routes.
  it('still answers 404 for a path no module claims', async () => {
    const { status } = await get(administrator, '/admin/nothing-here');
    expect(status).toBe(404);
  });
});
