import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { ADMIN, MEMBER, signedInContext } from './support';

// Detail §WP-3.6: "a Member's direct navigation to an admin route yields a server 403". The point
// is which side refused — a blank page from the router would satisfy a person watching and prove
// nothing, so the assertion is on the response the browser actually received.
const ADMIN_ROUTES = ['/admin/users', '/admin/restore', '/admin/connectors', '/admin/evaluation'];

let context: BrowserContext;
let page: Page;
const refusals: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await signedInContext(browser, MEMBER));
  page.on('response', (response) => {
    if (response.status() === 403) refusals.push(new URL(response.url()).pathname);
  });
});

test.afterAll(async () => {
  await context.close();
});

test.describe('the web app makes no security decision', () => {
  for (const route of ADMIN_ROUTES) {
    test(`a Member typing ${route} is refused by the server`, async () => {
      const before = refusals.length;
      await page.goto(route);

      await expect(page.getByTestId('server-refusal')).toContainText('403 AUTHZ_ROLE_FORBIDDEN');
      expect(refusals.slice(before), 'the API was never asked').not.toEqual([]);
    });
  }
});

// The control, in its own context. Without it the assertions above would also pass against a build
// that refused every caller, which is the failure mode of a guard wired to the wrong role.
test('an Administrator reaches the same screens and sees the phase instead', async ({ browser }) => {
  const admin = await signedInContext(browser, ADMIN);
  await admin.page.goto('/admin/users');

  await expect(admin.page.getByTestId('coming-soon')).toContainText('Arrives in phase 4A');
  await expect(admin.page.getByTestId('server-refusal')).toHaveCount(0);
  await admin.context.close();
});
