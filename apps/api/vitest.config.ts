import { defineConfig } from 'vitest/config';

// The gate is declared now and scoped to the directories that will hold domain logic.
// They are empty in Phase 1, so the stage is green because nothing is uncovered — not
// because the threshold was lowered. Detail §11 names what lands here: RRF fusion, chunk
// boundary maths, token counting, content sniffing, password policy.
const DOMAIN = ['src/modules/**/*.ts', 'src/adapters/**/*.ts', 'src/ports/**/*.ts'];

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // The integration suite needs a database and a Redis; stage 3 has neither.
    exclude: ['src/**/*.integration.spec.ts'],
    coverage: {
      provider: 'v8',
      include: DOMAIN,
      // Controllers are the HTTP edge, not domain logic: detail §11 covers them with contract
      // and end-to-end tests, and counting them here would measure the wrong thing.
      // Repositories are the same argument one layer down. Every line is a query builder whose
      // meaning is the SQL it produces against a real database, and a unit test of one asserts
      // that a mock was called. They are proved in the integration job instead — identity's in
      // `6c` (T-3.1-12), retrieval's by the compiled-SQL and leakage specs (T-2.3-08, T-2.3-09).
      exclude: [
        '**/*.spec.ts',
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/*.repository.ts',
        '**/index.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
