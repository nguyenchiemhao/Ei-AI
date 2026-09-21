import parser from '@ei-ai/eslint-config/parser.js';

// Rule 1 of WP-2.5 — only modules/retrieval/hybrid-search.repository.ts may *read* `chunks`.
// dependency-cruiser cannot express this: a table name is source text, not a dependency edge.
//
// Narrowed to reads at WP-3.4, by decision: what the rule defends is T-02, a leak through the rows
// a query returns, and an insert returns no rows to leak. As written for writes it also forbade the
// ingestion pipeline from storing a chunk at all, which is the work WP-3.4 exists to do.
const PERMITTED = 'src/modules/retrieval/hybrid-search.repository.ts';

const MESSAGE =
  'Only modules/retrieval/hybrid-search.repository.ts may read `chunks`. The permission ' +
  'predicate is reliable only while there is exactly one query (WP-2.5 rule 1).';

// Three shapes read the table: the Kysely builder, raw SQL in a string, raw SQL in a template.
const CHUNKS_QUERY = [
  {
    selector:
      'CallExpression[callee.property.name=/^(selectFrom)$/]' + ' > Literal[value=/^chunks\\b/]',
    message: MESSAGE,
  },
  {
    selector: 'Literal[value=/\\b(from|join)\\s+chunks\\b/i]',
    message: MESSAGE,
  },
  {
    selector: 'TemplateElement[value.raw=/\\b(from|join)\\s+chunks\\b/i]',
    message: MESSAGE,
  },
];

export default [
  {
    files: ['src/**/*.ts'],
    ignores: [PERMITTED],
    languageOptions: { parser },
    rules: { 'no-restricted-syntax': ['error', ...CHUNKS_QUERY] },
  },
];
