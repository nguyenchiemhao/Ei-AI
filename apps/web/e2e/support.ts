import { type Browser, type BrowserContext, type Page, expect } from '@playwright/test';

export const ADMIN = { email: 'admin@ei-ai.local', password: process.env.SEED_ADMIN_PASSWORD ?? '' };
export const MEMBER = {
  email: 'member@ei-ai.local',
  password: process.env.SEED_MEMBER_PASSWORD ?? '',
};

// Chromium logs every failed request as a console error, and two of those are this product working
// as designed: a `ComingSoon` panel calls its endpoint on purpose, and the server answers 501 when
// the feature is unbuilt or 403 when the caller's role may not have it. Those two are the screen's
// subject, asserted in authorisation.spec.ts; counting them here would make the Done when
// unsatisfiable by a correct build. Every other status, and every uncaught exception, still counts.
const DELIBERATE = /Failed to load resource: the server responded with a status of (403|501)\b/;

// Collected per test rather than asserted here: "every route renders with no console error" is the
// Done when, and a helper that swallowed them would make it unprovable.
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !DELIBERATE.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// One sign-in per spec file, in one context that lives for the whole file. Signing in per test
// costs ten attempts in fifteen minutes and the account locks — the product's own FR-65 defence,
// firing on the suite that was meant to exercise it. The context keeps the rotating refresh
// cookie, so each navigation exchanges the current one rather than replaying a spent token.
export async function signedInContext(
  browser: Browser,
  who = ADMIN,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page, `could not sign in as ${who.email}`).toHaveURL(/\/search/);
  return { context, page };
}
