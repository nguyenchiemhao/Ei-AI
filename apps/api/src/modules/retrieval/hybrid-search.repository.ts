import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { RRF_K } from './rank-fusion';

// The only file permitted to read `chunks` (WP-2.5 rule 1, narrowed to reads at the WP-3.4 gate).
// The permission predicate lives inside the query and every read of the table joins it, so a chunk
// the asker may not see is never returned — it never reaches application memory, a log or a prompt.

export interface SearchQuery {
  userId: string;
  // Undefined means every workspace the caller belongs to. The membership join decides either way:
  // naming workspaces narrows the search, it can never widen it.
  workspaceIds?: readonly string[];
  queryEmbedding: readonly number[];
  queryText: string;
  candidateLimit: number;
}

export interface Candidate {
  chunkId: string;
  score: number;
  documentId: string;
  documentVersionId: string;
  title: string;
  sourceFilename: string;
  chunkNo: number;
  charStart: number;
  charEnd: number;
  pageFrom: number;
  pageTo: number;
  headingPath: string | null;
  text: string;
}

interface CandidateRow {
  chunk_id: string;
  score: string | number;
  document_id: string;
  document_version_id: string;
  title: string;
  source_filename: string;
  chunk_no: number;
  char_start: number;
  char_end: number;
  page_from: number;
  page_to: number;
  heading_path: string | null;
  text: string;
}

// Design §6.1, verbatim in shape: membership, an active workspace, an indexed version, and either
// an unrestricted document or an explicit grant. A NULL workspace filter means "do not narrow",
// which is what lets one fragment serve a scoped search and an unscoped one.
function permittedCte(userId: string, workspaceIds: readonly string[] | undefined) {
  const scope = workspaceIds === undefined ? null : [...workspaceIds];
  return sql`
    permitted AS (
      SELECT dv.id AS document_version_id
      FROM document_versions dv
      JOIN documents d          ON d.id = dv.document_id
      JOIN workspaces w         ON w.id = d.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ${userId}
      WHERE dv.status = 'indexed'
        AND w.status  = 'active'
        AND (${scope}::uuid[] IS NULL OR w.id = ANY(${scope}::uuid[]))
        AND (
              d.restricted = FALSE
              OR EXISTS (SELECT 1 FROM document_grants g
                         WHERE g.document_id = d.id AND g.user_id = ${userId})
            )
    )`;
}

@Injectable()
export class HybridSearchRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // The predicate on its own, so a test can assert that an outsider's candidate set is empty
  // before any ranking runs. Same fragment the hybrid query composes, never a second copy of it.
  async permittedVersionIds(userId: string, workspaceIds?: readonly string[]): Promise<string[]> {
    const { rows } = await sql<{ document_version_id: string }>`
      WITH ${permittedCte(userId, workspaceIds)}
      SELECT document_version_id FROM permitted ORDER BY document_version_id
    `.execute(this.db);
    return rows.map((row) => row.document_version_id);
  }

  async search(query: SearchQuery): Promise<Candidate[]> {
    const { rows } = await this.compile(query).execute(this.db);
    return rows.map(toCandidate);
  }

  // Returned rather than executed so `permission-predicate.spec.ts` can compile it and read the
  // SQL. Asserting on the text is the point: a result set can be right for the wrong reason.
  compile(query: SearchQuery) {
    const permitted = permittedCte(query.userId, query.workspaceIds);
    const embedding = sql`${toHalfvec(query.queryEmbedding)}::halfvec`;
    const limit = query.candidateLimit;
    return sql<CandidateRow>`
      WITH ${permitted},
      dense AS (
        SELECT c.id, ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${embedding}) AS rnk
        FROM chunks c
        JOIN permitted p ON p.document_version_id = c.document_version_id
        ORDER BY c.embedding <=> ${embedding}
        LIMIT ${limit}
      ),
      lexical AS (
        SELECT c.id,
               ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.text_search, query) DESC) AS rnk
        FROM chunks c
        JOIN permitted p ON p.document_version_id = c.document_version_id,
             ${anyTermQuery(query.queryText)} AS query
        WHERE c.text_search @@ query
        ORDER BY ts_rank_cd(c.text_search, query) DESC
        LIMIT ${limit}
      ),
      fused AS (
        SELECT COALESCE(d.id, l.id) AS chunk_id,
               COALESCE(1.0 / (${RRF_K} + d.rnk), 0) + COALESCE(1.0 / (${RRF_K} + l.rnk), 0) AS score
        FROM dense d
        FULL OUTER JOIN lexical l ON l.id = d.id
      )
      SELECT f.chunk_id, f.score,
             doc.id AS document_id, dv.id AS document_version_id,
             doc.title, doc.source_filename,
             c.chunk_no, c.char_start, c.char_end, c.page_from, c.page_to,
             c.heading_path, c.text
      FROM fused f
      JOIN chunks c            ON c.id = f.chunk_id
      JOIN permitted p         ON p.document_version_id = c.document_version_id
      JOIN document_versions dv ON dv.id = c.document_version_id
      JOIN documents doc        ON doc.id = dv.document_id
      ORDER BY f.score DESC, f.chunk_id
      LIMIT ${limit}
    `;
  }
}

// A question's terms joined by OR, not by AND. Design §6.1 writes `plainto_tsquery`, which ANDs
// every term: "Thời hạn thanh toán của hợp đồng là bao lâu?" becomes ten lexemes a chunk must all
// contain, and it matched none of the corpus while the keyword form matched 44. The lexical branch
// was returning nothing for every natural-language question, so hybrid search was dense-only and
// said nothing about it. OR-ing the terms lets `ts_rank_cd` do the discriminating, which is what it
// is for, and the branch's own LIMIT cuts the tail. The lexemes come from the same `to_tsvector`
// the index was built with, so the query cannot tokenise differently from the column it searches.
// `quote_literal` keeps a lexeme with punctuation from being read as tsquery syntax, and the
// sentinel keeps an empty question from being a syntax error rather than an empty result.
function anyTermQuery(question: string) {
  return sql`to_tsquery('simple', COALESCE(NULLIF(array_to_string(ARRAY(
    SELECT quote_literal(lexeme)
    FROM unnest(tsvector_to_array(to_tsvector('simple', immutable_unaccent(${question})))) AS lexeme
  ), ' | '), ''), '''zzzznomatchzzzz'''))`;
}

// pgvector reads a vector from its text form; the driver would send a JavaScript array as a
// Postgres array, which is a different type entirely.
function toHalfvec(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`;
}

function toCandidate(row: CandidateRow): Candidate {
  return {
    chunkId: row.chunk_id,
    score: Number(row.score),
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    title: row.title,
    sourceFilename: row.source_filename,
    chunkNo: row.chunk_no,
    charStart: row.char_start,
    charEnd: row.char_end,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    headingPath: row.heading_path,
    text: row.text,
  };
}

export { permittedCte, RRF_K };
export type { CandidateRow };
