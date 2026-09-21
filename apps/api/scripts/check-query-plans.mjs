// T-2.3-03 and T-2.3-11. The seeded corpus is 123 chunks and the planner sequentially scans it,
// correctly — an index is not cheaper than reading a tiny table. So this grows a throwaway corpus
// until the indexes are the planner's own choice, records both branches' plans, and removes it.
//   docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
//     api apps/api/scripts/check-query-plans.mjs [rows]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const ROWS = Number(process.argv[2] ?? 10000);
const MARKER = 'plan-probe';

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function build() {
  const { rows: users } = await client.query(`SELECT id FROM users ORDER BY email LIMIT 1`);
  const owner = users[0].id;
  const { rows: workspaces } = await client.query(
    `INSERT INTO workspaces (name, status, created_by) VALUES ($1, 'active', $2) RETURNING id`,
    [`${MARKER}-${Date.now()}`, owner],
  );
  const workspace = workspaces[0].id;
  await client.query(
    `INSERT INTO workspace_members (workspace_id, user_id, workspace_role, added_by)
     VALUES ($1, $2, 'Owner', $2)`,
    [workspace, owner],
  );
  const { rows: documents } = await client.query(
    `INSERT INTO documents (workspace_id, title, source_filename, content_type, created_by)
     VALUES ($1, $2, $3, 'text/markdown', $4) RETURNING id`,
    [workspace, MARKER, `${MARKER}.md`, owner],
  );
  const { rows: versions } = await client.query(
    `INSERT INTO document_versions
       (document_id, version_no, storage_key, byte_size, sha256, uploaded_by, status)
     VALUES ($1, 1, $2, 10, repeat('a', 64), $3, 'indexed') RETURNING id`,
    [documents[0].id, `${MARKER}/x`, owner],
  );
  const version = versions[0].id;

  process.stdout.write(`building ${ROWS} chunks... `);
  const started = Date.now();
  // Twelve terms drawn from a vocabulary of five hundred, so a query matches a small fraction of
  // the corpus. Repeating one sentence across every chunk would make every term match every row,
  // and a GIN index is worth nothing against a predicate that selects everything — the planner
  // would sequentially scan, and it would be right to.
  await client.query(
    `INSERT INTO chunks (document_version_id, chunk_no, text, token_count,
                         page_from, page_to, char_start, char_end, heading_path, embedding)
     SELECT $1, g,
            (SELECT string_agg('tu' || ((g * 7919 + s * 104729) % 500), ' ')
             FROM generate_series(1, 12) AS s),
            200, 1, 1, 0, 100, 'Điều ' || g,
            ('[' || array_to_string(ARRAY(SELECT random() FROM generate_series(1, 1024)), ',') || ']')::halfvec
     FROM generate_series(1, $2) AS g`,
    [version, ROWS],
  );
  // VACUUM as well as ANALYZE: this script builds and drops a corpus in the same table on every
  // run, and the dead tuples left behind are enough to flip the lexical branch between a bitmap
  // index scan and a sequential one. Measuring the planner means removing that variable first.
  await client.query('VACUUM ANALYZE chunks');
  process.stdout.write(`${Date.now() - started} ms\n`);
  return { owner, workspace };
}

async function explain(label, sqlText, params) {
  const { rows } = await client.query(`EXPLAIN (ANALYZE, COSTS OFF) ${sqlText}`, params);
  const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
  const scan = /Index Scan|Index Only Scan|Bitmap Index Scan/.test(plan) ? 'INDEX' : 'SEQ';
  console.log(`\n--- ${label}: ${scan} ---\n${plan}`);
  return scan;
}

async function cleanUp() {
  const mine = `SELECT id FROM workspaces WHERE name LIKE '${MARKER}-%'`;
  await client.query(
    `UPDATE documents SET current_version_id = NULL WHERE workspace_id IN (${mine})`,
  );
  await client.query(`DELETE FROM documents WHERE workspace_id IN (${mine})`);
  await client.query(`DELETE FROM workspace_members WHERE workspace_id IN (${mine})`);
  await client.query(`DELETE FROM workspaces WHERE name LIKE '${MARKER}-%'`);
}

try {
  await cleanUp();
  await build();
  const vector = `[${Array.from({ length: 1024 }, () => Math.random()).join(',')}]`;
  const dense = await explain(
    'dense branch (HNSW over halfvec)',
    `SELECT c.id FROM chunks c ORDER BY c.embedding <=> $1::halfvec LIMIT 60`,
    [vector],
  );
  const TSQUERY = `to_tsquery('simple', COALESCE(NULLIF(array_to_string(ARRAY(
      SELECT quote_literal(lexeme)
      FROM unnest(tsvector_to_array(to_tsvector('simple', immutable_unaccent($1)))) AS lexeme
    ), ' | '), ''), '''zzzznomatchzzzz'''))`;

  const asFromItem = await explain(
    'lexical, tsquery as a FROM item',
    `SELECT c.id FROM chunks c, ${TSQUERY} q
     WHERE c.text_search @@ q
     ORDER BY ts_rank_cd(c.text_search, q) DESC LIMIT 60`,
    ['tu17 tu233 tu401'],
  );

  const lexical = await explain(
    'lexical, tsquery as a scalar subquery',
    `WITH terms AS (SELECT ${TSQUERY} AS q)
     SELECT c.id FROM chunks c
     WHERE c.text_search @@ (SELECT q FROM terms)
     ORDER BY ts_rank_cd(c.text_search, (SELECT q FROM terms)) DESC LIMIT 60`,
    ['tu17 tu233 tu401'],
  );
  console.log(`\nlexical as a FROM item: ${asFromItem}`);
  console.log(`\nrows ${ROWS} · dense ${dense} · lexical ${lexical}`);
  process.exitCode = dense === 'INDEX' && lexical === 'INDEX' ? 0 : 1;
} finally {
  await cleanUp();
  await client.end();
}
