import { expect, test, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';
import { signInAs, type SignInRole } from './helpers/navigation';

/*
 * Home and navigation (UX-08, D-16, D-17, D-24; UI-SPEC §5.1). Every actor signs in to one Home at
 * /app; the Security Analyst's Home is the review summary. These journeys only read, so the mobile
 * project runs them again at 375×812 against the same database (playwright.config.ts).
 */

function pageHeader(page: Page) {
  return page.getByRole('main').locator('.page-header');
}

async function expectStrapiHealthy(page: Page): Promise<void> {
  const health = await page.request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
}

/*
 * The Requestor Home's header carries New request at every width; below 768px the header stacks and
 * the action spans it (direction section 4 Page header; UI-SPEC §5.1).
 */
async function expectRequestorHome(page: Page, role: SignInRole): Promise<void> {
  const header = pageHeader(page);
  await expect(header.getByRole('heading', { level: 1, name: 'Home', exact: true }), `HOME_HEADING:${role}`).toBeVisible();
  await expect(header.getByText('What needs your action, and where your work stands.', { exact: true })).toBeVisible();
  const newRequest = header.getByRole('link', { name: 'New request', exact: true });
  await expect(newRequest, `HOME_NEW_REQUEST:${role}`).toBeVisible();
  await expect(newRequest).toHaveAttribute('href', '/app/requests/new');
  await expect(page).toHaveTitle('Home | IdamBox CSRM');
  // The analyst Home is never rendered for a Requestor (D-16).
  await expect(page.getByRole('region', { name: 'Needs action', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-slot="kpi-tile"]')).toHaveCount(0);

  const width = page.viewportSize()?.width ?? 0;
  if (width < 768) {
    const [headerBox, actionBox] = await Promise.all([header.boundingBox(), newRequest.boundingBox()]);
    expect(headerBox, 'the Home header has a box').not.toBeNull();
    expect(actionBox, 'New request has a box').not.toBeNull();
    expect(Math.abs(actionBox!.width - headerBox!.width), `New request spans the header at ${width}px`).toBeLessThanOrEqual(1);
  }
}

test.describe('Home and navigation @journey', () => {
  test('the Requestor signs in to Home with New request in its header', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Requestor');
    await expectRequestorHome(page, 'Requestor');
  });

  test('the Secondary Requestor signs in to the same Home', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Secondary Requestor');
    await expectRequestorHome(page, 'Secondary Requestor');
  });

  test('the Security Analyst signs in to the review summary at Home, with no header action', async ({ page }) => {
    await expectStrapiHealthy(page);
    await signInAs(page, 'Security Analyst');
    const header = pageHeader(page);
    await expect(header.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
    await expect(header.getByText('What needs your action, and where your work stands.', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Home | IdamBox CSRM');
    // The tiles are the analyst's entry points, so the header carries no action (D-24).
    await expect(header.locator('a, button')).toHaveCount(0);
    const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
    await expect(needsAction.getByRole('heading', { level: 2, name: 'Needs action', exact: true })).toBeAttached();
    await expect(needsAction.locator('[data-slot="kpi-tile"]'), 'the four Needs action tiles').toHaveCount(4);
    await expect(page.getByRole('region', { name: 'Review queue', exact: true }), 'the Review queue widget').toBeVisible();
  });

  /*
   * D-17: the analyst dashboard's old address is a temporary redirect to Home from next.config.ts. It
   * answers before the proxy, so even a request with no session gets the 307 and not the sign-in
   * redirect, and the query is kept. A bookmark lands every actor on their own Home; the review queues
   * under /app/review/ are unaffected.
   */
  test('UX08_REVIEW_REDIRECTS_TO_HOME: /app/review answers 307 to Home with its query, for every actor', async ({ page }) => {
    await expectStrapiHealthy(page);
    const redirect = await page.request.get('/app/review?from=bookmark', { maxRedirects: 0 });
    expect(redirect.status(), 'UX08_REVIEW_REDIRECTS_TO_HOME: a temporary redirect').toBe(307);
    expect(redirect.headers().location, 'UX08_REVIEW_REDIRECTS_TO_HOME: to Home, query kept').toMatch(/\/app\?from=bookmark$/);

    for (const role of ['Security Analyst', 'Requestor'] as const) {
      await signInAs(page, role);
      await page.goto('/app/review');
      await expect.poll(() => new URL(page.url()).pathname, { message: `${role} lands on Home` }).toBe('/app');
      await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true }), `UX08_REVIEW_REDIRECTS_TO_HOME:${role}`).toBeVisible();
      await expect(page.getByRole('banner').getByText(role, { exact: true })).toBeVisible();
    }

    await signInAs(page, 'Security Analyst');
    await page.goto('/app/review/requests');
    await expect.poll(() => new URL(page.url()).pathname, { message: 'a review queue is not redirected' }).toBe('/app/review/requests');
    await expect(page.getByRole('heading', { level: 1, name: 'Assessment request review', exact: true })).toBeVisible();
  });
});
