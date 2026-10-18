/** Dedicated real-session gate; the ordinary development fixture suite never executes it. */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const live = process.env.IAM_SCIM_REFUSAL_LIVE === 'true';
const description = 'Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator.';
const heading = 'You don’t have access to this area';
function screenshotDirectory() {
  const value = process.env.IAM_SCIM_REFUSAL_SCREENSHOT_DIR;
  if (!value) throw new Error('Refusal screenshot staging is unavailable.');
  const directory = path.resolve(value);
  const run = path.dirname(directory);
  if (path.basename(directory) !== 'browser-refusal' || !/^iam-refusal-[a-f0-9-]{36}$/.test(path.basename(run))
    || path.dirname(run) !== path.resolve(__dirname, '../.tmp')) throw new Error('Refusal screenshot staging is invalid.');
  return directory;
}
async function control(request: APIRequestContext, operation: string, data?: object) {
  const origin = process.env.IAM_SCIM_REFUSAL_CONTROL;
  const token = process.env.IAM_SCIM_REFUSAL_CONTROL_TOKEN;
  if (!origin || !token || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Refusal control is unavailable.');
  const response = await request.post(`${origin}/${operation}`, { headers: { Authorization: `Bearer ${token}` }, data, timeout: 180000 });
  expect(response.status(), 'isolated gate control completes').toBe(200);
  return response.json() as Promise<{ username: string; password: string; detail: string; held?: boolean }>;
}
async function refusal(page: Page) {
  const alert = page.getByRole('alert').filter({ hasText: description });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(alert.getByText(description, { exact: true })).toBeVisible();
  const cta = alert.getByRole('link', { name: 'Return to sign in', exact: true });
  await expect(cta).toHaveAttribute('href', '/sign-in');
  await expect(cta).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk register', exact: true })).toHaveCount(0);
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save|submit|create request/i })).toHaveCount(0);
  // Reach the CTA through actual keyboard navigation, then inspect its visible focus treatment.
  for (let index = 0; index < 40 && !await cta.evaluate(element => element === document.activeElement); index++) await page.keyboard.press('Tab');
  await expect(cta).toBeFocused();
  expect(await cta.evaluate(element => { const style = getComputedStyle(element); return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'; })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const element of [alert.getByRole('heading'), alert.getByText(description, { exact: true }), cta]) {
    expect(await element.evaluate(node => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return box.left >= 0 && box.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1 && style.textOverflow !== 'ellipsis'; })).toBe(true);
  }
}

test.describe('same OIDC session after SCIM deactivation', () => {
  test.skip(!live, 'Opt-in isolated live gate only; run refusal-scim.mjs --run.');
  for (const method of ['PUT', 'PATCH'] as const) for (const width of [1440, 375]) {
    test(`${method} refusal at ${width}px before Keycloak recovery`, async ({ page, request }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      const person = await control(request, 'setup', { method, width });
      await page.goto('/sign-in?returnTo=%2Fapp%2Frisks');
      await page.getByRole('button', { name: 'Continue to IdamBox sign-in', exact: true }).click();
      await page.locator('#username').fill(person.username);
      await page.locator('#password').fill(person.password);
      await page.locator('#kc-login').click();
      await expect(page).toHaveURL(/\/app\/risks$/);
      await expect(page.getByRole('heading', { name: 'Risk register', exact: true })).toBeVisible();
      await page.goto(person.detail);
      await expect(page.locator('[data-state-kind="permission"]')).toHaveCount(0);
      await expect(page.getByRole('main')).toContainText('Owner request');
      const session = (await page.context().cookies()).filter(cookie => cookie.name.includes('session-token'));
      expect(session.length > 0).toBe(true);
      await control(request, 'deactivate');
      try {
        await page.reload();
        await refusal(page);
        // A fresh document in the same context receives no protected content while Strapi access is held.
        await control(request, 'hold');
        const fresh = await page.context().newPage();
        // While access is held the server may not have committed any document yet, so a locator would only wait
        // for navigation. Record whether the document arrived; if it did (a streamed shell), inspect what it shows.
        let committed = false;
        fresh.on('response', response => { if (response.request().isNavigationRequest() && new URL(response.url()).pathname === '/app/risks') committed = true; });
        const navigation = fresh.goto('/app/risks');
        try {
          await expect.poll(async () => (await control(request, 'held')).held).toBe(true);
          await fresh.waitForTimeout(1000);
          if (committed) {
            const shown = await fresh.evaluate(() => ({ text: document.body?.innerText ?? '', tables: document.querySelectorAll('table').length }));
            expect(shown.text).not.toContain('Risk register');
            expect(shown.tables).toBe(0);
          }
        } finally { await control(request, 'release'); }
        await navigation;
        await refusal(fresh);
        await fresh.close();
        await page.goto(person.detail);
        await refusal(page);
        const current = (await page.context().cookies()).filter(cookie => cookie.name.includes('session-token'));
        expect(current.length === session.length && current.every((cookie, index) => cookie.value === session[index]?.value)).toBe(true);
        const output = screenshotDirectory();
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: path.join(output, `${method.toLowerCase()}-${width}.png`), fullPage: true });
        // The control's refusal stage already performed actual current-token data/detail/write 403 checks.
        await control(request, 'browser-done');
      } finally { await control(request, 'release'); }
    });
  }
});
