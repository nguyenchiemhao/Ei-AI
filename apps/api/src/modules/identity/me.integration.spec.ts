import { PLANNED_FEATURES } from '@ei-ai/shared-types';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { PasswordService } from './password.service';

// Drives the built application over HTTP: the Done when is about what `GET /me` reports on a clean
// install, and a re-transpiled controller with a mocked service would report whatever it was told.
const ORIGIN = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';
const PASSWORD = 'correct horse battery staple';

let db: Client;
let email: string;
let userId: string;
let workspaceId: string;
let token: string;

interface MeBody {
  user: { id: string; email: string; displayName: string; systemRole: string };
  memberships: { workspaceId: string; workspaceName: string; workspaceRole: string }[];
  operatingMode: string;
  toolGroups: { documents: string; web: string; erp: string };
  featureStatus: Record<string, { module: string; plannedPhase: string; status: string }>;
}

async function me(bearer?: string): Promise<{ status: number; body: MeBody }> {
  const response = await fetch(`${ORIGIN}/me`, {
    headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
  });
  return { status: response.status, body: (await response.json()) as MeBody };
}

beforeAll(async () => {
  db = new Client({ connectionString: CONNECTION });
  await db.connect();
  email = `me-${randomUUID()}@ei-ai.local`;
  const hash = await new PasswordService({ PASSWORD_MIN_LENGTH: 12 } as Env).hash(PASSWORD);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash, auth_source, system_role)
     VALUES ($1, 'Me Fixture', $2, 'local', 'Member') RETURNING id`,
    [email, hash],
  );
  userId = rows[0]!.id;

  // A membership of its own rather than a seeded one, so the assertion below is about this user.
  const workspace = await db.query<{ id: string }>(
    `INSERT INTO workspaces (name, description, created_by)
     VALUES ($1, 'me fixture', $2) RETURNING id`,
    [`me-${randomUUID()}`, userId],
  );
  workspaceId = workspace.rows[0]!.id;
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, workspace_role, added_by)
     VALUES ($1, $2, 'Editor', $2)`,
    [workspaceId, userId],
  );

  const login = await fetch(`${ORIGIN}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  token = ((await login.json()) as { accessToken: string }).accessToken;
  expect(token, 'could not log in as the fixture user').toBeTruthy();
});

afterAll(async () => {
  await db.query(`DELETE FROM workspace_members WHERE workspace_id = $1`, [workspaceId]);
  await db.query(`UPDATE workspaces SET status = 'archived' WHERE id = $1`, [workspaceId]);
  await db.query(`DELETE FROM login_attempts WHERE email = $1`, [email]);
  await db.query(`UPDATE users SET status = 'disabled' WHERE id = $1`, [userId]);
  await db.end();
});

describe('GET /me', () => {
  it('refuses a caller with no token', async () => {
    expect((await me()).status).toBe(401);
  });

  it('returns the caller and their system role', async () => {
    const { status, body } = await me(token);

    expect(status).toBe(200);
    expect(body.user).toMatchObject({ id: userId, email, systemRole: 'Member' });
  });

  it('returns the workspace membership with the role, not just the workspace', async () => {
    const { body } = await me(token);

    expect(body.memberships).toEqual([
      expect.objectContaining({ workspaceId, workspaceRole: 'Editor' }),
    ]);
  });

  // The package's proving command. `mcp_servers` is asserted empty rather than assumed: the mode
  // would read `document+web+erp` if a row had been left behind, and the reason must be visible.
  it('reports document-only on a clean install with mcp_servers empty', async () => {
    const { rows } = await db.query<{ count: string }>(`SELECT count(*) AS count FROM mcp_servers`);
    expect(rows[0]!.count, 'a registered MCP server would change the mode under test').toBe('0');

    const { body } = await me(token);

    expect(body.operatingMode).toBe('document-only');
  });

  // FR-78, the half of the Done when about not raising a false alarm.
  it('calls the ERP group not_configured rather than anything that reads as a fault', async () => {
    const { body } = await me(token);

    expect(body.toolGroups).toMatchObject({ documents: 'on', erp: 'not_configured' });
    expect(JSON.stringify(body.toolGroups)).not.toContain('unreachable');
  });

  it('carries a feature status entry for every unbuilt module, each with its phase', async () => {
    const { body } = await me(token);

    expect(Object.keys(body.featureStatus).sort()).toEqual(Object.keys(PLANNED_FEATURES).sort());
    for (const [key, value] of Object.entries(body.featureStatus)) {
      expect(value.plannedPhase, `${key} has no phase`).toMatch(/^[2-5][A-D]$/);
    }
  });

  // Reading yourself back is the one route whose whole job is to describe the caller, so a token
  // that outlived the account must not be the way to do it.
  it('refuses a token whose account has been disabled', async () => {
    await db.query(`UPDATE users SET status = 'disabled' WHERE id = $1`, [userId]);
    const after = await me(token);
    await db.query(`UPDATE users SET status = 'active' WHERE id = $1`, [userId]);

    expect(after.status).toBe(401);
  });
});
