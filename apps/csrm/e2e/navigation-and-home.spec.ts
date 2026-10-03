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
});
