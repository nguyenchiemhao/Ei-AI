// §4.5 number 4 — HMR latency. Nobody measured it: WP-1.1 closed without recording it and no
// WP-4.1 task names it, so this is scope no task describes, built as small as it can be.
//
// The threshold is "over 3 seconds → the source is on the wrong filesystem", which is a question
// about WSL2 watching a bind mount. So the clock starts at the write on the host side of that mount
// and stops when the browser says it applied the update — the whole path a developer waits on, not
// the half the dev server can see.
//
//   docker compose --profile e2e run --rm -v "$PWD/spike":/workspace/apps/web/spike \
//       e2e node /workspace/apps/web/spike/hmr_bench.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const TARGET = '/workspace/apps/web/src/screens/search.tsx';
const BASE = process.env.WEB_BASE_URL ?? 'http://web:5173';
const ROUNDS = Number(process.env.ROUNDS ?? 8);

const original = readFileSync(TARGET, 'utf8');
const digest = (text) => createHash('sha256').update(text).digest('hex');
const originalDigest = digest(original);

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

// Vite's client announces an applied update on the console. Waiting on the websocket frame instead
// would stop the clock when the message arrived, not when the module was swapped.
function nextUpdate() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no hot update within 15s')), 15_000);
    const listener = (message) => {
      if (/hot updated|hmr update/i.test(message.text())) {
        clearTimeout(timer);
        page.off('console', listener);
        resolve(performance.now());
      }
    };
    page.on('console', listener);
  });
}

await page.goto(`${BASE}/login`);
await page.waitForTimeout(2000);

const samples = [];
try {
  for (let round = 1; round <= ROUNDS; round += 1) {
    const waiting = nextUpdate();
    const started = performance.now();
    writeFileSync(TARGET, `${original}// hmr probe ${String(round)}\n`, 'utf8');
    const applied = await waiting;
    samples.push(applied - started);

    // Restore between rounds, and let that update settle, so the next round measures one change
    // rather than a queue of two.
    const settling = nextUpdate();
    writeFileSync(TARGET, original, 'utf8');
    await settling;
    await page.waitForTimeout(500);
  }
} finally {
  writeFileSync(TARGET, original, 'utf8');
  await browser.close();
}

const restored = digest(readFileSync(TARGET, 'utf8'));
if (restored !== originalDigest) {
  console.error(`the probe did not restore ${TARGET} — sha256 ${restored} vs ${originalDigest}`);
  process.exit(1);
}

samples.sort((a, b) => a - b);
const at = (q) => samples[Math.max(0, Math.ceil(samples.length * q) - 1)];
console.log(
  JSON.stringify(
    {
      file: TARGET,
      rounds: samples.length,
      median_ms: Math.round(at(0.5)),
      p95_ms: Math.round(at(0.95)),
      min_ms: Math.round(samples[0]),
      max_ms: Math.round(samples[samples.length - 1]),
      restored_unchanged: true,
    },
    null,
    2,
  ),
);
