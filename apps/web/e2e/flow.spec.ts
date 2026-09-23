import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { collectConsoleErrors, signedInContext } from './support';

// Detail §11's one end-to-end flow: log in → workspace → upload → indexed → search → passages.
// The document is Vietnamese, filename included: for this product the ASCII case is the rare one,
// and a boundary that mangles diacritics looks correct until something real goes through it.
//
// Every run uploads different bytes. `dv_content_unique` refuses a second copy of the same content,
// so a fixed body makes the suite pass once and report DOC_DUPLICATE ever after — which is the
// constraint working and the test lying.
const RUN = randomUUID().slice(0, 8);
const FILENAME = `hợp đồng thử nghiệm ${RUN}.md`;
const MARKER = `Điều khoản thanh toán cho hợp đồng thử nghiệm số ${RUN}.`;
const BODY = `# Hợp đồng thử nghiệm ${RUN}\n\n## Thanh toán\n\n${MARKER}\n\nBên A thanh toán trong vòng 30 ngày kể từ ngày nhận đủ chứng từ hợp lệ.\n`;

test('upload a Vietnamese document, reach indexed, and find it again', async ({ browser }) => {
  test.setTimeout(240_000);
  const { context, page } = await signedInContext(browser);
  const errors = collectConsoleErrors(page);

  await page.goto('/workspaces');
  await page.getByRole('link', { name: 'Legal' }).click();
  await page.getByRole('link', { name: 'Upload' }).click();

  await page.getByLabel('Choose files').setInputFiles({
    name: FILENAME,
    mimeType: 'text/markdown',
    buffer: Buffer.from(BODY, 'utf8'),
  });
  await expect(page.getByText(/Stored ·/)).toBeVisible();
  // The filename survived the multipart boundary with its diacritics intact.
  await expect(page.getByText(FILENAME)).toBeVisible();

  // The pipeline is a worker and a queue, so this polls the screen the person would be watching
  // rather than the database behind it.
  await page.getByRole('link', { name: 'Back to documents' }).click();
  const row = page.getByRole('row').filter({ hasText: FILENAME });
  await expect(row).toContainText('indexed', { timeout: 180_000 });

  await page.goto('/search');
  await page.getByLabel('Question').fill(`điều khoản thanh toán hợp đồng thử nghiệm ${RUN}`);
  await page.getByRole('button', { name: 'Search' }).click();

  const passages = page.getByTestId('passages');
  await expect(passages).toContainText(MARKER);
  // "with file name and position" — the G3 gate line is about what a reader can check.
  await expect(passages).toContainText(FILENAME);
  await expect(passages).toContainText(/characters \d+–\d+/);

  expect(errors).toEqual([]);
  await context.close();
});
