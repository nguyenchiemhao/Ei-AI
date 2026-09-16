import { defineConfig } from 'vitest/config';

// The integration suite needs a migrated Postgres and a Redis, which stage 3 has neither of, so
// it lives behind its own config and its own CI job. No coverage gate: these tests exist to show
// two scenarios end to end, not to cover lines.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
