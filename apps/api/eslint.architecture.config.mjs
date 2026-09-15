import parser from '@ei-ai/eslint-config/parser.js';

// Rule 1 of WP-2.5 — only modules/retrieval/hybrid-search.repository.ts may query `chunks`.
// dependency-cruiser cannot express this: a table name is source text, not a dependency edge.
const PERMITTED = 'src/modules/retrieval/hybrid-search.repository.ts';

const MESSAGE =
  'Only modules/retrieval/hybrid-search.repository.ts may query `chunks`. The permission ' +
  'predicate is reliable only while there is exactly one query (WP-2.5 rule 1).';

// Three shapes reach the table: the Kysely builder, raw SQL in a string, raw SQL in a template.
const CHUNKS_QUERY = [
  {
    selector:
      'CallExpression[callee.property.name=/^(selectFrom|insertInto|updateTable|deleteFrom|replaceInto)$/]' +
      ' > Literal[value=/^chunks\\b/]',
    message: MESSAGE,
  },
  {
    selector: 'Literal[value=/\\b(from|join|into|update)\\s+chunks\\b/i]',
    message: MESSAGE,
  },
  {
    selector: 'TemplateElement[value.raw=/\\b(from|join|into|update)\\s+chunks\\b/i]',
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
