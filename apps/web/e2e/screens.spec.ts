import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { ROUTES } from '../src/routes';
import { collectConsoleErrors, signedInContext } from './support';

// A route with a parameter needs a value to be visited at all. The workspace is a real one, because
// that screen loads its documents; the turn, approval and document ids are nil uuids, because those
// screens are placeholders whose endpoints refuse before they read the id.
const NIL = '00000000-0000-0000-0000-000000000000';

let context: BrowserContext;
let page: Page;
let errors: string[];
let workspaceId = NIL;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await signedInContext(browser));
  errors = collectConsoleErrors(page);
  // Read from the screen rather than from the API: `page.request` carries the context's cookies and
  // not the access token, which this app keeps in memory — so asking the API here would answer 401
  // and hand the rest of the suite a nil id that every workspace route then refuses.
  await page.goto('/workspaces');
  const first = page.locator('a[href^="/workspaces/"]').first();
  await expect(first).toBeVisible();
  workspaceId = (await first.getAttribute('href'))!.split('/').pop()!;
});

test.afterAll(async () => {
  await context.close();
});

function concrete(path: string): string {
  return path
    .replace(':workspaceId', workspaceId)
    .replace(':turnId', NIL)
    .replace(':approvalId', NIL)
    .replace(':documentId', NIL);
}

test.describe('every screen in the inventory opens', () => {
  for (const route of ROUTES.filter((candidate) => candidate.path !== '/login')) {
    test(`${route.path} — ${route.title}`, async () => {
      const before = errors.length;
      const target = concrete(route.path);
      await page.goto(target);

      // The router resolved it rather than falling through to the catch-all, which sends
      // everything unknown to /search.
      await expect(page).toHaveURL(new RegExp(`${target.replace(/\//g, '\\/')}$`));

      if (route.feature === undefined) {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      } else {
        const panel = page.getByTestId('coming-soon');
        await expect(panel).toBeVisible();
        // Detail §WP-3.6: a described placeholder, naming what it will do and when it arrives.
        await expect(panel).toContainText(/Arrives in phase [2-5][A-D]/);
        await expect(panel).toContainText(route.summary!);
      }

      expect(errors.slice(before), `console errors on ${route.path}`).toEqual([]);
    });
  }
});

test('the login screen opens without a session', async ({ browser }) => {
  const fresh = await browser.newContext();
  const anonymous = await fresh.newPage();
  const consoleErrors = collectConsoleErrors(anonymous);
  await anonymous.goto('/login');
  await expect(anonymous.getByRole('heading', { name: 'Sign in to Ei-AI' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
  await fresh.close();
});
