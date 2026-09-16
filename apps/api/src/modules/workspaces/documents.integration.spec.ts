import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { Algorithm, hash as argon2Hash } from '@node-rs/argon2';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES } from './upload-limits';

// Drives the built application over HTTP, like the identity suite and for the same reason:
// vitest transpiles with esbuild, which emits no decorator metadata, so a Nest booted inside
// the suite would have no dependency injection at all.
const ORIGIN = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const PASSWORD = 'correct horse battery staple';
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);

let db: Client;
let token: string;
let workspaceId: string;
const createdUsers: string[] = [];
const createdWorkspaces: string[] = [];

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function upload(filename: string, contents: Buffer | string): Promise<Response> {
  const form = new FormData();
  form.append('file', new Blob([contents]), filename);
  return fetch(`${ORIGIN}/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
}

function declareOversizedUpload(): Promise<{ status: number; body: Record<string, unknown> }> {
  const origin = new URL(ORIGIN);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: origin.hostname,
        port: origin.port,
        method: 'POST',
        path: `/workspaces/${workspaceId}/documents`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'multipart/form-data; boundary=X',
          'content-length': String(MAX_UPLOAD_BYTES + 1),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(raw) as Record<string, unknown>,
          }),
        );
      },
    );
    req.on('error', reject);
    req.write('--X\r\n');
  });
}

const codeOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { code?: string }).code ?? '';

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const email = `it-docs-${randomUUID()}@ei-ai.local`;
  // Hashed with the library directly, not through identity's PasswordService: architecture
  // rule 3 forbids a module reaching into another module's service, and this fixture needs a
  // hash rather than that service. The rule caught the import; the fixture was the thing wrong.
  const hash = await argon2Hash(PASSWORD, { algorithm: Algorithm.Argon2id });
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, auth_source)
     VALUES ($1, 'Integration', $2, 'local')`,
    [email, hash],
  );
  createdUsers.push(email);

  const login = await post('/auth/login', { email, password: PASSWORD });
  token = ((await login.json()) as { accessToken: string }).accessToken;

  const workspace = await post(
    '/workspaces',
    { name: `Integration ${randomUUID()}` },
    { authorization: `Bearer ${token}` },
  );
  workspaceId = ((await workspace.json()) as { id: string }).id;
  createdWorkspaces.push(workspaceId);
});

afterAll(async () => {
  // One statement per call: a parameterised query in node-postgres is a prepared statement, and
  // a prepared statement holds exactly one command.
  for (const id of createdWorkspaces) {
    await db.query('UPDATE documents SET current_version_id = NULL WHERE workspace_id = $1', [id]);
    await db.query(
      `DELETE FROM document_versions
       WHERE document_id IN (SELECT id FROM documents WHERE workspace_id = $1)`,
      [id],
    );
    await db.query('DELETE FROM documents WHERE workspace_id = $1', [id]);
    await db.query('DELETE FROM workspaces WHERE id = $1', [id]);
  }
  if (createdUsers.length > 0) {
    await db.query('DELETE FROM login_attempts WHERE email = ANY($1)', [createdUsers]);
    await db.query('DELETE FROM users WHERE email = ANY($1)', [createdUsers]);
  }
  await db.end();
});

// The four T-3.3-09 names, each the case a task was written for.
describe('documents, end to end', () => {
  it('refuses an ELF binary wearing a .pdf extension', async () => {
    const response = await upload('payload.pdf', ELF);

    expect(response.status).toBe(415);
    expect(await codeOf(response)).toBe('DOC_CONTENT_MISMATCH');
  });

  it('refuses a format outside the ten, and names the ten', async () => {
    const response = await upload('payload.exe', 'anything');

    expect(response.status).toBe(415);
    const body = (await response.json()) as { code: string; detail: string };
    expect(body.code).toBe('DOC_UNSUPPORTED_FORMAT');
    expect(body.detail).toContain('PDF');
    expect(body.detail).toContain('TIFF');
  });

  // The declared length is refused before any body is read. It goes through node:http rather
  // than fetch because undici refuses to send a body that does not match Content-Length — the
  // client will not tell the lie this test is about. The other half of the limit, a request
  // that declares nothing and streams past it, is covered by upload.service.spec.ts.
  it('refuses an upload that declares more than the limit, stating the limit', async () => {
    const { status, body } = await declareOversizedUpload();

    expect(status).toBe(413);
    expect(body.code).toBe('DOC_TOO_LARGE');
    expect(body.limitBytes).toBe(MAX_UPLOAD_BYTES);
  });

  it('refuses a second version whose bytes have not changed', async () => {
    const name = `notes-${randomUUID()}.md`;

    const first = await upload(name, 'phiên bản một\n');
    expect(first.status).toBe(201);

    const repeat = await upload(name, 'phiên bản một\n');
    expect(repeat.status).toBe(409);
    expect(await codeOf(repeat)).toBe('DOC_DUPLICATE_CONTENT');

    const changed = await upload(name, 'phiên bản hai\n');
    expect(changed.status).toBe(201);
    expect(((await changed.json()) as { versionNo: number }).versionNo).toBe(2);
  });
});
