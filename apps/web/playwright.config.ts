import { defineConfig } from '@playwright/test';

// Drives the running dev server over the internal network, the same way a person's browser reaches
// it through nginx: nothing is mocked, and a screen that needs the API gets the real refusal.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://web:5173',
    trace: 'retain-on-failure',
  },
});
