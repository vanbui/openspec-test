import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

type PrivateInput = { username: string; actionUrl: string };
type AccessInput = { sessionKey: string; detail: string; list: string; restricted: string; administration: string; foreign: string };
type BrowserProof = { passed: true; sessionKey?: string; restrictedRoutesRefused?: true; foreignRecordRefused?: true;
  sameBrowserSession?: true; browserListRefused?: true; browserDetailRefused?: true; freshSignInRefused?: true;
  screenshot?: { name: string; png: string } };
async function control<T = PrivateInput>(request: APIRequestContext, stage: string, method: 'GET' | 'POST', proof: BrowserProof = { passed: true }) {
  const origin = process.env.IAM_JOURNEY_CONTROL_URL;
  const token = process.env.IAM_JOURNEY_CONTROL_TOKEN;
  if (!origin || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin) || !token) throw Error('JOURNEY_CONTROL_INVALID');
  const end = Date.now() + 180000;
  for (;;) {
    const response = await request.fetch(`${origin}/${method === 'GET' ? 'input/' : ''}${stage}`, {
      method, headers: { Authorization: `Bearer ${token}` }, ...(method === 'POST' ? { data: proof } : {}), timeout: 10000,
    });
    if (response.status() === 200) return method === 'GET' ? response.json() as Promise<T> : undefined;
    if (method !== 'GET' || response.status() !== 409 || Date.now() >= end) throw Error('JOURNEY_CONTROL_FAILED');
    await response.dispose();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
async function keyboardSubmit(page: Page, name: RegExp) {
  const button = page.getByRole('button', { name });
  for (let index = 0; index < 30 && !await button.evaluate(node => node === document.activeElement); index++) await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  expect(await button.evaluate(node => { const style = getComputedStyle(node); return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'; })).toBe(true);
  await page.keyboard.press('Enter');
}
async function readable(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const error of [...await page.getByRole('alert').all(), ...await page.locator('#input-error').all()]) {
    // Screen-reader-only live regions (such as the framework's 1px route announcer) cannot overflow visibly.
    if (await error.isVisible()) expect(await error.evaluate(node => { const box = node.getBoundingClientRect(); return (box.width <= 1 && box.height <= 1)
      || (box.left >= 0 && box.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1); })).toBe(true);
  }
}

function validateAccessInput(input: AccessInput | undefined): asserts input is AccessInput {
  if (!input || !/^[a-f0-9]{64}$/.test(input.sessionKey) || input.list !== '/app/requests'
    || !/^\/app\/requests\/[a-z0-9]{24}$/.test(input.detail) || !/^\/app\/requests\/[a-z0-9]{24}$/.test(input.foreign)
    || input.foreign === input.detail || input.restricted !== '/app/review/requests' || input.administration !== '/app/admin/risk-types') throw Error('JOURNEY_INPUT_INVALID');
}
async function sessionCookies(page: Page) {
  const cookies = (await page.context().cookies()).filter(cookie => cookie.name.includes('session-token'));
  expect(cookies.length > 0).toBe(true);
  return cookies.map(({ name, value }) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
}
async function sameSession(page: Page, original: Awaited<ReturnType<typeof sessionCookies>>) {
  // Compare privately; failures expose no cookie values through assertion diagnostics.
  expect(JSON.stringify(await sessionCookies(page)) === JSON.stringify(original)).toBe(true);
}
async function allowedRequest(page: Page, input: AccessInput) {
  await page.goto(`http://localhost:3000${input.list}`);
  await expect(page.getByRole('heading', { name: 'My requests', exact: true })).toBeVisible();
  // The primary navigation repeats the action; the page's own control is the one under test.
  const create = page.getByRole('main').getByRole('link', { name: 'New request', exact: true });
  for (let index = 0; index < 40 && !await create.evaluate(node => node === document.activeElement); index++) await page.keyboard.press('Tab');
  await expect(create).toBeFocused();
  expect(await create.evaluate(node => { const style = getComputedStyle(node); return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'; })).toBe(true);
  await readable(page);
  await page.goto(`http://localhost:3000${input.detail}`);
  await expect(page.getByRole('heading', { name: 'Journey owner request', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Request actions' })).toBeVisible();
  await readable(page);
}
async function refusal(page: Page) {
  const alert = page.getByRole('alert').filter({ hasText: 'Your access is unavailable.' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('heading', { name: 'You don’t have access to this area', exact: true })).toBeVisible();
  await expect(alert.getByText('Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Journey owner request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Request actions' })).toHaveCount(0);
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save|submit|create request/i })).toHaveCount(0);
  const cta = alert.getByRole('link', { name: 'Return to sign in', exact: true });
  await expect(cta).toHaveAttribute('href', '/sign-in');
  for (let index = 0; index < 40 && !await cta.evaluate(node => node === document.activeElement); index++) await page.keyboard.press('Tab');
  await expect(cta).toBeFocused();
  expect(await cta.evaluate(node => { const style = getComputedStyle(node); return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'; })).toBe(true);
  await readable(page);
}
async function safeScreenshot(page: Page, width: number, kind: 'requestor' | 'refusal') {
  if (!/^http:\/\/localhost:3000\/app\/requests\/[a-z0-9]{24}$/.test(page.url()) || ![1440, 375].includes(width) || !['requestor', 'refusal'].includes(kind)) throw Error('JOURNEY_SCREENSHOT_INVALID');
  // Only this CSRM viewport enters private memory; no login/setup page or full-page capture.
  return { name: `screenshots/csrm-${width}-${kind}.png`, png: (await page.screenshot({ fullPage: false })).toString('base64') };
}

test.describe('private Requestor lifecycle', () => {
  for (const width of [1440, 375]) test(`password setup, mover continuity and leaver refusal at ${width}`, async ({ browser, request }, info) => {
    // The ordinary harness can inherit the opt-in variable without obtaining private input.
    test.skip(process.env.IAM_JOURNEY_LIVE !== 'true' || info.project.name !== 'iam-journey', 'Dedicated disposable journey only.');
    const viewport = { width, height: width === 375 ? 812 : 900 };
    const input = await control(request, `password-setup-${width}`, 'GET');
    if (!input || !/^journey\.[a-f0-9]{12}\.[01]$/.test(input.username)) throw Error('JOURNEY_INPUT_INVALID');
    const url = new URL(input.actionUrl);
    if (url.origin !== 'http://localhost:8080' || url.pathname !== '/realms/idambox/login-actions/action-token' || url.username || url.password || url.hash || url.searchParams.getAll('key').length !== 1 || !url.searchParams.get('key')) throw Error('JOURNEY_INPUT_INVALID');
    const password = `Jr!${randomBytes(24).toString('base64url')}7a`;
    const setup = await browser.newContext({ viewport });
    try {
      const page = await setup.newPage();
      await page.goto(url.href);
      // Keycloak first shows the pending actions with a single proceed link.
      const proceed = page.getByRole('link', { name: /click here to proceed/i });
      if (await proceed.count() === 1) { await proceed.focus(); await page.keyboard.press('Enter'); }
      await page.getByLabel('New Password', { exact: true }).fill(password);
      await page.getByLabel('Confirm password', { exact: true }).fill(password);
      await readable(page);
      await keyboardSubmit(page, /submit/i);
      await expect(page.getByLabel('New Password', { exact: true })).toHaveCount(0);
      await expect(page.locator('#kc-info-message')).toBeVisible();
      await control(request, `password-setup-${width}`, 'POST');
    } finally { await setup.close(); }
    // No setup cookies or storage enter this independent Auth.js flow.
    const session = await browser.newContext({ viewport });
    try {
      await control(request, `requestor-sign-in-${width}`, 'GET');
      const page = await session.newPage();
      // A Requestor lands on their own requests; the Risk register needs risk:manage.
      await page.goto('http://localhost:3000/sign-in?returnTo=%2Fapp%2Frequests');
      await keyboardSubmit(page, /Continue to IdamBox sign-in/);
      await page.getByLabel('Username or email', { exact: true }).fill(input.username);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await readable(page);
      await keyboardSubmit(page, /sign in/i);
      await expect(page).toHaveURL('http://localhost:3000/app/requests');
      await expect(page.getByRole('heading', { name: 'My requests', exact: true })).toBeVisible();
      await readable(page);
      await control(request, `requestor-sign-in-${width}`, 'POST');
      const access = await control<AccessInput>(request, `requestor-access-${width}`, 'GET');
      validateAccessInput(access);
      const cookies = await sessionCookies(page);
      for (const route of [access.restricted, access.administration]) {
        await page.goto(`http://localhost:3000${route}`);
        await expect(page.locator('[data-state-kind="permission"]')).toBeVisible();
        await expect(page.locator('table')).toHaveCount(0);
        await readable(page);
      }
      await page.goto(`http://localhost:3000${access.foreign}`);
      await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
      await expect(page.getByText('Journey foreign request', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Request actions' })).toHaveCount(0);
      await allowedRequest(page, access);
      await sameSession(page, cookies);
      await control(request, `requestor-access-${width}`, 'POST', { passed: true, sessionKey: access.sessionKey,
        restrictedRoutesRefused: true, foreignRecordRefused: true, sameBrowserSession: true,
        screenshot: await safeScreenshot(page, width, 'requestor') });

      const moved = await control<AccessInput>(request, `csv-mover-${width}`, 'GET');
      validateAccessInput(moved);
      expect(moved.sessionKey === access.sessionKey && moved.detail === access.detail).toBe(true);
      await allowedRequest(page, moved);
      await sameSession(page, cookies);
      await control(request, `csv-mover-${width}`, 'POST', { passed: true, sessionKey: access.sessionKey, sameBrowserSession: true });

      const inactive = await control<AccessInput>(request, `immediate-refusal-${width}`, 'GET');
      validateAccessInput(inactive);
      expect(inactive.sessionKey === access.sessionKey && inactive.detail === access.detail).toBe(true);
      // Reload the previously readable detail, then both routes in the original context.
      await page.reload();
      await refusal(page);
      for (const route of [access.list, access.detail]) {
        await page.goto(`http://localhost:3000${route}`);
        await refusal(page);
      }
      await sameSession(page, cookies);
      await control(request, `immediate-refusal-${width}`, 'POST', { passed: true, sessionKey: access.sessionKey,
        sameBrowserSession: true, browserListRefused: true, browserDetailRefused: true,
        screenshot: await safeScreenshot(page, width, 'refusal') });

      await control(request, `remote-completion-${width}`, 'GET');
      const fresh = await browser.newContext({ viewport });
      try {
        const denied = await fresh.newPage();
        await denied.goto('http://localhost:3000/sign-in?returnTo=%2Fapp%2Frequests');
        await keyboardSubmit(denied, /Continue to IdamBox sign-in/);
        await denied.getByLabel('Username or email', { exact: true }).fill(input.username);
        await denied.getByLabel('Password', { exact: true }).fill(password);
        await keyboardSubmit(denied, /sign in/i);
        // Keycloak reports a disabled account as page-level feedback, distinct from a wrong password.
        await expect(denied.locator('.kc-feedback-text')).toHaveText('Account is disabled, contact your administrator.');
        expect(new URL(denied.url()).origin).toBe('http://localhost:8080');
        await readable(denied);
        expect((await fresh.cookies()).some(cookie => cookie.name.includes('session-token'))).toBe(false);
        await control(request, `remote-completion-${width}`, 'POST', { passed: true, freshSignInRefused: true });
      } finally { await fresh.close(); }
    } finally { await session.close(); }
  });
});
