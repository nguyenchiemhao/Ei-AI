// Control for hmr_bench.mjs: with no write, no update may arrive. Without this the benchmark's
// numbers could be the listener catching something the page says on its own.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const seen = [];
page.on('console', (m) => {
  if (/hot updated|hmr update/i.test(m.text())) seen.push(m.text());
});
await page.goto(`${process.env.WEB_BASE_URL ?? 'http://web:5173'}/login`);
await page.waitForTimeout(8000);
await browser.close();
console.log(JSON.stringify({ waited_ms: 8000, wrote_nothing: true, hmr_messages: seen.length }));
process.exit(seen.length === 0 ? 0 : 1);
