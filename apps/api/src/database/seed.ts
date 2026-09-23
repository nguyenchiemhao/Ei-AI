import { INTERNAL_TOOLS } from '@ei-ai/shared-types';
import { createReadStream, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { LocalFsAdapter } from '../adapters/storage/local-fs.adapter';
import { loadConfig } from '../config/configuration';
import { PasswordService } from '../modules/identity/password.service';

// Copied into dist by nest-cli.json, the way the migrations are.
const CORPUS_DIR = join(__dirname, 'corpus');

// Seeding is idempotent: every insert is ON CONFLICT DO NOTHING and every id is derived from
// a stable natural key, so running it twice leaves the same database rather than a doubled one.
const USERS = [
  { email: 'admin@ei-ai.local', name: 'Ei-AI Administrator', role: 'Administrator' },
  { email: 'km@ei-ai.local', name: 'Knowledge Manager', role: 'Knowledge Manager' },
  { email: 'approver@ei-ai.local', name: 'Approver', role: 'Approver' },
  { email: 'member@ei-ai.local', name: 'Member', role: 'Member' },
];

const ADMIN_EMAIL = 'admin@ei-ai.local';
const MEMBER_EMAIL = 'member@ei-ai.local';

// A recognisable placeholder, not a usable credential: the seed never invents a real password.
const PLACEHOLDER_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1wbGFjZWhvbGRlcg$c2VlZA';

// Hashing goes through the application's own PasswordService so the seed cannot drift from the
// parameters and the policy the running system applies. Written as its own statement rather than
// folded into the upsert, so a later run without the variable leaves a good hash alone instead of
// resetting it to the placeholder. The password itself is never written to stdout.
async function setPasswordsIfAsked(client: Client): Promise<number> {
  const config = loadConfig();
  const wanted: [string, string | undefined][] = [
    [ADMIN_EMAIL, config.SEED_ADMIN_PASSWORD],
    [MEMBER_EMAIL, config.SEED_MEMBER_PASSWORD],
  ];
  let set = 0;
  for (const [email, password] of wanted) {
    if (!password) continue;
    const hash = await new PasswordService(config).hash(password);
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
    set += 1;
  }
  return set;
}

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

function corpusFilenames(): string[] {
  return readdirSync(CORPUS_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
}

// The first heading if the document has one, so the list reads like documents rather than files.
function titleOf(path: string, filename: string): string {
  return /^#\s+(.+)$/m.exec(readFileSync(path, 'utf8'))?.[1]?.trim() ?? filename;
}

// Documents stop at 'uploaded': the ingestion pipeline is WP-3.4's, and a seed that pretended to
// index them would make the pipeline's own tests pass against fiction. The bytes, however, are
// real and go through the same StoragePort an upload uses — a version whose storage_key points at
// nothing is a corpus the pipeline cannot run on, which is what the first twenty rows were.
async function seedDocuments(
  client: Client,
  workspaceId: string,
  uploaderId: string,
): Promise<number> {
  const storage = new LocalFsAdapter(loadConfig());
  const filenames = corpusFilenames();
  for (const filename of filenames) {
    const path = join(CORPUS_DIR, filename);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO documents (workspace_id, title, source_filename, content_type, created_by)
       SELECT $1, $2, $3, 'text/markdown', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM documents WHERE workspace_id = $1 AND source_filename = $3
       )
       RETURNING id`,
      [workspaceId, titleOf(path, filename), filename, uploaderId],
    );
    if (rows.length === 0) continue;

    const stored = await storage.put(createReadStream(path));
    const version = await client.query<{ id: string }>(
      `INSERT INTO document_versions
         (document_id, version_no, storage_key, byte_size, sha256, uploaded_by, status)
       VALUES ($1, 1, $2, $3, $4, $5, 'uploaded')
       RETURNING id`,
      [rows[0]!.id, stored.storageKey, stored.byteSize, stored.sha256, uploaderId],
    );
    await client.query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [
      version.rows[0]!.id,
      rows[0]!.id,
    ]);
  }
  return filenames.length;
}

// The three internal tools of ADR-10; only `search_documents` is enabled in Phase 1. Internal tools
// carry no mcp_server_id, so the UNIQUE (mcp_server_id, name) constraint does not apply to them and
// a WHERE NOT EXISTS does the work.
async function seedInternalTools(client: Client): Promise<void> {
  for (const tool of INTERNAL_TOOLS) {
    await client.query(
      `INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
       SELECT $1, $2, $3::jsonb, $4::tool_classification, $5, $6
       WHERE NOT EXISTS (
         SELECT 1 FROM tools WHERE name = $1 AND mcp_server_id IS NULL
       )`,
      [
        tool.name,
        tool.description,
        JSON.stringify(tool.inputSchema),
        tool.classification,
        tool.enabledInPhase1,
        tool.minSystemRole,
      ],
    );
  }
}

// One destination, recorded but not enabled. T-5.2-01 generates allowlist.conf from this table;
// until then the row documents intent and the file is the thing Squid actually reads.
async function seedAllowlistEntry(client: Client, adminId: string): Promise<void> {
  await client.query(
    `INSERT INTO allowlist_entries (host, port, protocol, purpose, enabled, created_by)
     VALUES ('api.anthropic.com', 443, 'https', 'Model provider, Phase 2B onward', FALSE, $1)
     ON CONFLICT (host, port, protocol) DO NOTHING`,
    [adminId],
  );
}

export async function seed(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const users = await seedUsers(client);
    const adminId = users.get(ADMIN_EMAIL)!;
    const credentialsSet = await setPasswordsIfAsked(client);
    const workspaceIds = await seedWorkspaces(client, adminId);
    await seedMemberships(client, workspaceIds, users);
    const documentCount = await seedDocuments(client, workspaceIds[0]!, adminId);
    await seedInternalTools(client);
    await seedAllowlistEntry(client, adminId);
    await client.query('COMMIT');
    process.stdout.write(
      `seeded ${USERS.length} users, ${workspaceIds.length} workspaces, ` +
        `${documentCount} documents, ${INTERNAL_TOOLS.length} tools, 1 allowlist entry; ` +
        `${String(credentialsSet)} seeded password(s) set from the environment\n`,
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
