import { describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../database/db';
import { HybridSearchRepository } from './hybrid-search.repository';

// The query is compiled, never run: a result set can be right by accident, and what this suite
// defends is that the restriction is *in the SQL*. `pg` opens no connection until a query executes,
// so this needs no database and belongs in stage 3 with the rest of the unit tests.
const db: Database = createDatabase('postgresql://unused@unused:5432/unused');
const repository = new HybridSearchRepository(db);

function compiled(workspaceIds?: readonly string[]) {
  return repository
    .compile({
      userId: 'u-1',
      workspaceIds,
      queryEmbedding: [0.1, 0.2],
      queryText: 'phương thức thanh toán',
      candidateLimit: 60,
    })
    .compile(db);
}

const flattened = (): string => compiled().sql.replace(/\s+/g, ' ');

describe('the compiled hybrid query', () => {
  it('declares the permitted CTE', () => {
    expect(flattened()).toContain('permitted AS (');
  });

  it('joins workspace_members, which is what membership means', () => {
    expect(flattened()).toContain('JOIN workspace_members wm ON wm.workspace_id = w.id');
  });

  it('binds the membership to the asker rather than to a literal', () => {
    expect(flattened()).toMatch(/wm\.user_id = \$\d+/);
    expect(compiled().parameters).toContain('u-1');
  });

  it('admits only indexed versions of active workspaces', () => {
    expect(flattened()).toContain("dv.status = 'indexed'");
    expect(flattened()).toContain("w.status = 'active'");
  });

  it('admits a restricted document only through an explicit grant', () => {
    expect(flattened()).toContain('d.restricted = FALSE');
    expect(flattened()).toContain('FROM document_grants g');
  });

  // Three reads of `chunks` and each one carries the predicate. A branch that forgot it would
  // return rows the asker may not see, and the fused result would launder them.
  it('joins permitted in the dense branch', () => {
    expect(flattened()).toMatch(
      /dense AS \(.*JOIN permitted p ON p\.document_version_id = c\.document_version_id/,
    );
  });

  it('joins permitted in the lexical branch', () => {
    expect(flattened()).toMatch(
      /lexical AS \(.*JOIN permitted p ON p\.document_version_id = c\.document_version_id/,
    );
  });

  it('joins permitted again when it reads the passage back out', () => {
    expect(flattened().slice(flattened().indexOf('FROM fused f'))).toContain('JOIN permitted p');
  });

  it('reads chunks exactly three times, so no branch has been added without the predicate', () => {
    const reads = flattened().match(/(FROM|JOIN) chunks\b/g) ?? [];
    const joins = flattened().match(/JOIN permitted p\b/g) ?? [];
    expect(reads).toHaveLength(3);
    expect(joins).toHaveLength(3);
  });

  it('normalises the question with the same function the index was built with', () => {
    // `unaccent` and `immutable_unaccent` agree today; only one of them is in `text_search`.
    expect(flattened()).toContain("to_tsvector('simple', immutable_unaccent(");
    // Bare `unaccent(`, not the `immutable_` one that contains it as a substring.
    expect(flattened()).not.toMatch(/(?<!immutable_)unaccent\(/);
  });

  it('joins the questionterms with OR, so a whole question is not an impossible AND', () => {
    expect(flattened()).toContain("' | '");
    expect(flattened()).not.toContain('plainto_tsquery');
  });

  it('leaves the workspace filter unbound when none is given, rather than inventing one', () => {
    expect(compiled().parameters.filter((value) => value === null)).toHaveLength(2);
  });

  it('binds the workspaces it was given', () => {
    expect(compiled(['w-1']).parameters).toContainEqual(['w-1']);
  });
});
