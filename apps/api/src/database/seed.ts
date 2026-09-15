import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const SAMPLE_DOCUMENT_COUNT = 20;

// Seeding is idempotent: every insert is ON CONFLICT DO NOTHING and every id is derived from
// a stable natural key, so running it twice leaves the same database rather than a doubled one.
const USERS = [
  { email: 'admin@ei-ai.local', name: 'Ei-AI Administrator', role: 'Administrator' },
  { email: 'km@ei-ai.local', name: 'Knowledge Manager', role: 'Knowledge Manager' },
  { email: 'approver@ei-ai.local', name: 'Approver', role: 'Approver' },
  { email: 'member@ei-ai.local', name: 'Member', role: 'Member' },
];

// A recognisable placeholder, not a usable credential: the seed never invents a real password.
const PLACEHOLDER_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1wbGFjZWhvbGRlcg$c2VlZA';

async function seedUsers(client: Client): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const user of USERS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, display_name, password_hash, auth_source, system_role)
       VALUES ($1, $2, $3, 'local', $4)
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [user.email, user.name, PLACEHOLDER_HASH, user.role],
    );
    ids.set(user.email, rows[0]!.id);
  }
  return ids;
}

async function seedWorkspaces(client: Client, adminId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const name of ['Legal', 'Finance']) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO workspaces (name, description, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [name, `${name} sample workspace`, adminId],
    );
    ids.push(rows[0]!.id);
  }
  return ids;
}

async function seedMemberships(
  client: Client,
  workspaceIds: string[],
  users: Map<string, string>,
): Promise<void> {
  const roles: [string, string][] = [
    ['admin@ei-ai.local', 'Owner'],
    ['km@ei-ai.local', 'Editor'],
    ['member@ei-ai.local', 'Reader'],
  ];
  for (const workspaceId of workspaceIds) {
    for (const [email, role] of roles) {
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, workspace_role, added_by)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [workspaceId, users.get(email), role, users.get('admin@ei-ai.local')],
      );
    }
  }
}

// Documents stop at 'uploaded': the ingestion pipeline is WP-3.4's, and a seed that pretended
// to index them would make the pipeline's own tests pass against fiction.
async function seedDocuments(
  client: Client,
  workspaceId: string,
  uploaderId: string,
): Promise<void> {
  for (let i = 1; i <= SAMPLE_DOCUMENT_COUNT; i += 1) {
    const filename = `sample-${String(i).padStart(2, '0')}.md`;
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO documents (workspace_id, title, source_filename, content_type, created_by)
       SELECT $1, $2, $3, 'text/markdown', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM documents WHERE workspace_id = $1 AND source_filename = $3
       )
       RETURNING id`,
      [workspaceId, `Sample document ${i}`, filename, uploaderId],
    );
    if (rows.length === 0) continue;

    await client.query(
      `INSERT INTO document_versions
         (document_id, version_no, storage_key, byte_size, sha256, uploaded_by, status)
       VALUES ($1, 1, $2, 1024, $3, $4, 'uploaded')
       ON CONFLICT DO NOTHING`,
      [rows[0]!.id, `seed/${filename}`, randomUUID().replace(/-/g, ''), uploaderId],
    );
  }
}

// The one tool Phase 1 enables. Internal tools carry no mcp_server_id, so the UNIQUE
// (mcp_server_id, name) constraint does not apply to them and a WHERE NOT EXISTS does the work.
async function seedSearchTool(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
     SELECT 'search_documents',
            'Search indexed documents and return cited passages',
            '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'::jsonb,
            'read', TRUE, 'Member'
     WHERE NOT EXISTS (
       SELECT 1 FROM tools WHERE name = 'search_documents' AND mcp_server_id IS NULL
     )`,
  );
}

export async function seed(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const users = await seedUsers(client);
    const adminId = users.get('admin@ei-ai.local')!;
    const workspaceIds = await seedWorkspaces(client, adminId);
    await seedMemberships(client, workspaceIds, users);
    await seedDocuments(client, workspaceIds[0]!, adminId);
    await seedSearchTool(client);
    await client.query('COMMIT');
    process.stdout.write(
      `seeded ${USERS.length} users, ${workspaceIds.length} workspaces, ` +
        `${SAMPLE_DOCUMENT_COUNT} documents, 1 tool\n`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seed.ts')) {
  seed().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
