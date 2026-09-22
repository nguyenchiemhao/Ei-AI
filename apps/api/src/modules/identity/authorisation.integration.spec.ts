import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { PasswordService } from './password.service';

// Drives the built application over HTTP, like the other integration suites: what T-3.2-06 and
// T-3.2-07 are about is what a real request receives, and a guard is a piece of the framework
// rather than a function a unit test can stand in front of.
const ORIGIN = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const PASSWORD = 'correct horse battery staple';
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';

let db: Client;
let workspaceId: string;
const created: string[] = [];
const tokens = new Map<string, string>();

async function newUser(systemRole: string): Promise<string> {
  const email = `authz-${randomUUID()}@ei-ai.local`;
  const hash = await new PasswordService({ PASSWORD_MIN_LENGTH: 12 } as Env).hash(PASSWORD);
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, auth_source, system_role)
     VALUES ($1, 'Authorisation', $2, 'local', $3)`,
    [email, hash, systemRole],
  );
  created.push(email);
  return email;
}

async function tokenFor(email: string): Promise<string> {
  const cached = tokens.get(email);
  if (cached) return cached;
  const response = await fetch(`${ORIGIN}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = (await response.json()) as { accessToken?: string };
  expect(body.accessToken, `could not log in as ${email}`).toBeTruthy();
  tokens.set(email, body.accessToken!);
  return body.accessToken!;
}

async function as(
  email: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; code?: string }> {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await tokenFor(email)}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status >= 400) {
    const problem = (await response.json()) as { code?: string };
    return { status: response.status, code: problem.code };
  }
  return { status: response.status };
}

let administrator: string;
let knowledgeManager: string;
let member: string;
let auditor: string;
let memberEditor: string;

beforeAll(async () => {
  db = new Client({ connectionString: CONNECTION });
  await db.connect();
  administrator = await newUser('Administrator');
  knowledgeManager = await newUser('Knowledge Manager');
  member = await newUser('Member');
  auditor = await newUser('Auditor');
  memberEditor = await newUser('Member');

  const created = await fetch(`${ORIGIN}/workspaces`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await tokenFor(administrator)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: `authz-${randomUUID()}` }),
  });
  workspaceId = ((await created.json()) as { id: string }).id;

  // A Member who is an Editor of this workspace: the case where the two dimensions disagree.
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    memberEditor,
  ]);
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, workspace_role, added_by)
     SELECT $1, $2, 'Editor', id FROM users WHERE email = $3`,
    [workspaceId, rows[0]!.id, administrator],
  );
});

afterAll(async () => {
  await db.query(`UPDATE users SET status = 'disabled' WHERE email = ANY($1)`, [created]);
  await db.query(`DELETE FROM login_attempts WHERE email = ANY($1)`, [created]);
  await db.query(`UPDATE workspaces SET status = 'archived' WHERE id = $1`, [workspaceId]);
  await db.end();
});

describe('system roles, through the routes that enforce them', () => {
  it('lets an Administrator create a workspace', async () => {
    const response = await as(administrator, 'POST', '/workspaces', { name: `a-${randomUUID()}` });
    expect(response.status).toBe(201);
  });

  it('lets a Knowledge Manager create a workspace', async () => {
    const response = await as(knowledgeManager, 'POST', '/workspaces', {
      name: `k-${randomUUID()}`,
    });
    expect(response.status).toBe(201);
  });

  it('refuses a Member, with a code about the role', async () => {
    const response = await as(member, 'POST', '/workspaces', { name: `m-${randomUUID()}` });
    expect(response).toMatchObject({ status: 403, code: 'AUTHZ_ROLE_FORBIDDEN' });
  });

  it('refuses an Auditor', async () => {
    const response = await as(auditor, 'POST', '/workspaces', { name: `x-${randomUUID()}` });
    expect(response.status).toBe(403);
  });

  // Design §9.1 gives the Auditor a dash under "Ask a question". The product's read-only role may
  // read the audit log and may not read the documents.
  // Only the refusal: a successful search embeds the question through infinity, and an
  // authorisation test that goes red because that service is down is a test failing outside its
  // subject. That a Member can search is WP-2.3's suite and the package's proving run.
  it('refuses an Auditor asking a question', async () => {
    const response = await as(auditor, 'POST', '/search', { question: 'hợp đồng' });
    expect(response).toMatchObject({ status: 403, code: 'AUTHZ_ROLE_FORBIDDEN' });
  });
});

describe('workspace roles, through the routes that enforce them', () => {
  it('refuses someone who is not a member at all', async () => {
    const response = await as(member, 'GET', `/workspaces/${workspaceId}`);
    expect(response).toMatchObject({ status: 403, code: 'AUTHZ_WORKSPACE_FORBIDDEN' });
  });

  it('lets the Owner read it', async () => {
    expect((await as(administrator, 'GET', `/workspaces/${workspaceId}`)).status).toBe(200);
  });

  it('lets an Editor read it', async () => {
    expect((await as(memberEditor, 'GET', `/workspaces/${workspaceId}`)).status).toBe(200);
  });

  // T-3.2-07's second name: an Editor manages documents, not membership.
  it('refuses an Editor changing membership', async () => {
    const response = await as(memberEditor, 'GET', `/workspaces/${workspaceId}/members`);
    expect(response).toMatchObject({ status: 403, code: 'AUTHZ_WORKSPACE_FORBIDDEN' });
  });

  it('lets the Owner change membership', async () => {
    expect((await as(administrator, 'GET', `/workspaces/${workspaceId}/members`)).status).toBe(200);
  });

  // The two dimensions are layered, so both have to admit the caller. §9.1 gives "upload and
  // delete documents" to Administrator and Knowledge Manager alone, which a Member does not reach
  // however high their workspace role.
  it('refuses a Member who is an Editor from uploading, on the system role', async () => {
    const response = await as(memberEditor, 'POST', `/workspaces/${workspaceId}/documents`);
    expect(response).toMatchObject({ status: 403, code: 'AUTHZ_ROLE_FORBIDDEN' });
  });
});

describe('what a refused request leaves behind', () => {
  it('writes no audit row, because the guard refuses before the action runs', async () => {
    const before = await db.query<{ count: string }>(
      `SELECT count(*) AS count FROM audit_events WHERE action = 'workspace.created'`,
    );
    await as(member, 'POST', '/workspaces', { name: `nope-${randomUUID()}` });
    const after = await db.query<{ count: string }>(
      `SELECT count(*) AS count FROM audit_events WHERE action = 'workspace.created'`,
    );
    expect(after.rows[0]!.count).toBe(before.rows[0]!.count);
  });
});
