import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../database/db';
import { HybridSearchRepository } from './hybrid-search.repository';

// The predicate is asserted against rows this suite creates and owns. Borrowing whatever the seed
// happens to hold would make a green result depend on data no test controls.
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';

let client: Client;
let db: Database;
let repository: HybridSearchRepository;

interface World {
  insider: string;
  outsider: string;
  granted: string;
  activeWorkspace: string;
  archivedWorkspace: string;
  openVersion: string;
  restrictedVersion: string;
  unindexedVersion: string;
  archivedVersion: string;
  openChunk: string;
  decoyChunk: string;
  partNumberChunk: string;
  restrictedChunk: string;
}

// Constant vectors, because what these tests are about is text and permissions, not embeddings.
// Driving them through infinity would make them fail when it is down, for reasons the permission
// predicate has nothing to do with. NEAR sits on the question's own vector and FAR points away, so
// the dense order is fixed and known: the decoy outranks the answer until the lexical branch speaks.
const VECTOR = Array.from({ length: 1024 }, (_, i) => (i % 7) / 7);
const NEAR = VECTOR;
const FAR = VECTOR.map((value) => 1 - value);

let world: World;

async function newUser(label: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash, auth_source)
     VALUES ($1, $2, 'x', 'local') RETURNING id`,
    [`ret-${label}-${randomUUID()}@ei-ai.local`, label],
  );
  return rows[0]!.id;
}

async function newWorkspace(status: string, owner: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO workspaces (name, status, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [`ret-${randomUUID()}`, status, owner],
  );
  return rows[0]!.id;
}

async function addMember(workspace: string, user: string, owner: string): Promise<void> {
  await client.query(
    `INSERT INTO workspace_members (workspace_id, user_id, workspace_role, added_by)
     VALUES ($1, $2, 'Reader', $3)`,
    [workspace, user, owner],
  );
}

async function newVersion(
  workspace: string,
  owner: string,
  options: { restricted?: boolean; status?: string } = {},
): Promise<string> {
  const { restricted = false, status = 'indexed' } = options;
  const { rows: documents } = await client.query<{ id: string }>(
    `INSERT INTO documents (workspace_id, title, source_filename, content_type, restricted, created_by)
     VALUES ($1, 'Hợp đồng', $2, 'text/markdown', $3, $4) RETURNING id`,
    [workspace, `ret-${randomUUID()}.md`, restricted, owner],
  );
  const document = documents[0]!.id;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO document_versions
       (document_id, version_no, storage_key, byte_size, sha256, uploaded_by, status)
     VALUES ($1, 1, $2, 10, $3, $4, $5) RETURNING id`,
    [
      document,
      `ret/${randomUUID()}`,
      randomUUID().replace(/-/g, '').padEnd(64, '0'),
      owner,
      status,
    ],
  );
  return rows[0]!.id;
}

let chunkNo = 0;

async function newChunk(
  versionId: string,
  text: string,
  embedding: readonly number[],
): Promise<string> {
  chunkNo += 1;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO chunks
       (document_version_id, chunk_no, text, token_count, page_from, page_to,
        char_start, char_end, heading_path, embedding)
     VALUES ($1, $2, $3, 200, 1, 1, 0, $4, 'Điều 2', $5::halfvec) RETURNING id`,
    [versionId, chunkNo, text, text.length, `[${embedding.join(',')}]`],
  );
  return rows[0]!.id;
}

async function grant(versionId: string, user: string, by: string): Promise<void> {
  await client.query(
    `INSERT INTO document_grants (document_id, user_id, granted_by)
     SELECT document_id, $2, $3 FROM document_versions WHERE id = $1`,
    [versionId, user, by],
  );
}

beforeAll(async () => {
  client = new Client({ connectionString: CONNECTION });
  await client.connect();
  db = createDatabase(CONNECTION);
  repository = new HybridSearchRepository(db);

  const owner = await newUser('owner');
  const insider = await newUser('insider');
  const outsider = await newUser('outsider');
  const granted = await newUser('granted');
  const activeWorkspace = await newWorkspace('active', owner);
  const archivedWorkspace = await newWorkspace('archived', owner);
  for (const user of [insider, granted]) {
    await addMember(activeWorkspace, user, owner);
    await addMember(archivedWorkspace, user, owner);
  }
  const restrictedVersion = await newVersion(activeWorkspace, owner, { restricted: true });
  await grant(restrictedVersion, granted, owner);

  const openVersion = await newVersion(activeWorkspace, owner);
  world = {
    insider,
    outsider,
    granted,
    activeWorkspace,
    archivedWorkspace,
    openVersion,
    restrictedVersion,
    unindexedVersion: await newVersion(activeWorkspace, owner, { status: 'uploaded' }),
    archivedVersion: await newVersion(archivedWorkspace, owner),
    openChunk: await newChunk(openVersion, 'Phương thức thanh toán của hợp đồng thuê kho bãi', FAR),
    decoyChunk: await newChunk(openVersion, 'Điều khoản bảo mật và bàn giao mặt bằng', NEAR),
    partNumberChunk: await newChunk(
      openVersion,
      'Mã linh kiện XYZ-4471 dùng cho máy nén khí trục vít, bảo hành 12 tháng',
      FAR,
    ),
    restrictedChunk: await newChunk(
      restrictedVersion,
      'Phương thức thanh toán bí mật của bên A',
      FAR,
    ),
  };
});

afterAll(async () => {
  // In dependency order: documents restrict their workspace's deletion, and workspaces and
  // documents both point at the users who made them.
  const mine = `SELECT id FROM workspaces WHERE name LIKE 'ret-%'`;
  await client.query(
    `UPDATE documents SET current_version_id = NULL WHERE workspace_id IN (${mine})`,
  );
  await client.query(`DELETE FROM documents WHERE workspace_id IN (${mine})`);
  await client.query(`DELETE FROM workspace_members WHERE workspace_id IN (${mine})`);
  await client.query(`DELETE FROM workspaces WHERE name LIKE 'ret-%'`);
  await client.query(`DELETE FROM users WHERE email LIKE 'ret-%@ei-ai.local'`);
  await db.destroy();
  await client.end();
});

describe('the permitted predicate', () => {
  it('gives a member the indexed versions of their active workspaces', async () => {
    const permitted = await repository.permittedVersionIds(world.insider);
    expect(permitted).toContain(world.openVersion);
  });

  it('gives someone with no membership nothing at all', async () => {
    const permitted = await repository.permittedVersionIds(world.outsider, [world.activeWorkspace]);
    expect(permitted).toEqual([]);
  });

  it('withholds a restricted document from a member without a grant', async () => {
    const permitted = await repository.permittedVersionIds(world.insider);
    expect(permitted).not.toContain(world.restrictedVersion);
  });

  it('releases that same document to the member who was granted it', async () => {
    const permitted = await repository.permittedVersionIds(world.granted);
    expect(permitted).toContain(world.restrictedVersion);
  });

  it('withholds a version that is not indexed yet', async () => {
    const permitted = await repository.permittedVersionIds(world.insider);
    expect(permitted).not.toContain(world.unindexedVersion);
  });

  it('withholds everything in an archived workspace, retained though it is', async () => {
    const permitted = await repository.permittedVersionIds(world.insider);
    expect(permitted).not.toContain(world.archivedVersion);
  });

  it('narrows to the workspaces it is given', async () => {
    const scoped = await repository.permittedVersionIds(world.insider, [world.archivedWorkspace]);
    expect(scoped).toEqual([]);
  });

  it('cannot be widened by naming a workspace the caller is not in', async () => {
    const scoped = await repository.permittedVersionIds(world.outsider, [
      world.activeWorkspace,
      world.archivedWorkspace,
    ]);
    expect(scoped).toEqual([]);
  });
});

const search = (userId: string, queryText: string) =>
  repository.search({ userId, queryEmbedding: VECTOR, queryText, candidateLimit: 60 });

describe('the lexical branch', () => {
  it('finds a passage whose question is written without diacritics', async () => {
    const found = await search(world.insider, 'phuong thuc thanh toan');
    expect(found.map((candidate) => candidate.chunkId)).toContain(world.openChunk);
  });

  it('finds the same passage whatever the case', async () => {
    const found = await search(world.insider, 'PHƯƠNG THỨC THANH TOÁN');
    expect(found.map((candidate) => candidate.chunkId)).toContain(world.openChunk);
  });

  it('ranks the same whether the question carries its diacritics or not', async () => {
    // The embedding is held constant, so any difference between these two comes from the lexical
    // branch alone — which is the branch under test.
    const withMarks = await search(world.insider, 'phương thức thanh toán');
    const without = await search(world.insider, 'phuong thuc thanh toan');
    expect(without.map((c) => c.chunkId)).toEqual(withMarks.map((c) => c.chunkId));
  });

  it('lifts the passage the words match above the one the vector prefers', async () => {
    // The decoy sits exactly on the question's vector, so it wins the dense branch outright. Only
    // the lexical branch can put the answer first, which is what makes this a test of that branch.
    const found = await search(world.insider, 'phương thức thanh toán');
    expect(found[0]!.chunkId).toBe(world.openChunk);
  });

  it('leaves the decoy on top for a question that matches no text, which is the control', async () => {
    const found = await search(world.insider, 'zzz khong khop gi ca');
    expect(found[0]!.chunkId).toBe(world.decoyChunk);
  });
});

describe('what a candidate carries', () => {
  it('names the file and the span, so a passage can be resolved back to its source', async () => {
    const [candidate] = await search(world.insider, 'phương thức thanh toán');
    expect(candidate).toMatchObject({
      sourceFilename: expect.stringMatching(/\.md$/),
      chunkNo: 1,
      charStart: 0,
      headingPath: 'Điều 2',
    });
    expect(candidate!.charEnd).toBeGreaterThan(candidate!.charStart);
  });
});

describe('leakage', () => {
  it('withholds a restricted chunk from a member who was not granted it', async () => {
    const found = await search(world.insider, 'phương thức thanh toán');
    expect(found.map((candidate) => candidate.chunkId)).not.toContain(world.restrictedChunk);
  });

  it('releases that chunk to the member who was granted it, so the test can fail', async () => {
    const found = await search(world.granted, 'phương thức thanh toán');
    expect(found.map((candidate) => candidate.chunkId)).toContain(world.restrictedChunk);
  });

  it('gives an outsider nothing at all', async () => {
    expect(await search(world.outsider, 'phương thức thanh toán')).toEqual([]);
  });
});

describe('a part number worded differently', () => {
  // The chunk's vector points away from the question's, and the decoy sits on it. Nothing but the
  // lexical branch can bring this passage back, which is what FR-10 is about.
  it('is found when the question drops the hyphen and the diacritics', async () => {
    const found = await search(world.insider, 'linh kien XYZ 4471');
    expect(found[0]!.chunkId).toBe(world.partNumberChunk);
  });

  it('is found when the question carries only the number', async () => {
    const found = await search(world.insider, 'XYZ4471 máy nén khí');
    expect(found.map((candidate) => candidate.chunkId)).toContain(world.partNumberChunk);
  });

  it('is not found by a question about something else, which is the control', async () => {
    const found = await search(world.insider, 'zzzz khong lien quan gi');
    expect(found[0]!.chunkId).not.toBe(world.partNumberChunk);
  });
});

describe('what reaches a log', () => {
  it('never writes a withheld chunk id anywhere, not even while ranking', async () => {
    const written: string[] = [];
    const streams = [process.stdout, process.stderr] as const;
    const originals = streams.map((stream) => stream.write.bind(stream));
    streams.forEach((stream) => {
      stream.write = ((chunk: string | Uint8Array): boolean => {
        written.push(String(chunk));
        return true;
      }) as typeof stream.write;
    });
    try {
      await search(world.insider, 'phương thức thanh toán bí mật của bên A');
    } finally {
      streams.forEach((stream, index) => (stream.write = originals[index]!));
    }
    expect(written.join('')).not.toContain(world.restrictedChunk);
  });
});
