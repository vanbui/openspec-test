import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// The locked not-found copy (UI-SPEC section 9.3), shared by the root and the in-shell fallback.
const notFound = {
  heading: 'Page not found',
  lead: 'The page you asked for doesn’t exist or has moved.',
  action: 'Return to workspace',
  title: 'Page not found | IdamBox CSRM',
};

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

async function signInAsSecurityAnalyst(page: Page): Promise<void> {
  await page.goto('/sign-in?returnTo=/app');
  await page.getByRole('button', { name: 'Continue as Security Analyst' }).click();
  /*
   * Assert the shell, not the URL: '/sign-in?returnTo=/app' also ends in '/app',
   * so a URL check alone reports a click that never left sign-in as a success (D-15).
   */
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Security Analyst', { exact: true })).toBeVisible();
}

for (const viewport of viewports) {
  test(`keeps the authorised shell responsive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signInAsSecurityAnalyst(page);

    const mobileTrigger = page.getByRole('button', { name: 'Menu', exact: true });
    const isMobile = viewport.width < 1024;

    if (isMobile) {
      await expect(mobileTrigger).toBeVisible();
      await mobileTrigger.click();
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
    } else {
      await expect(mobileTrigger).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    }

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('returns keyboard focus to the menu trigger after closing the mobile sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsSecurityAnalyst(page);

  const trigger = page.getByRole('button', { name: 'Menu', exact: true });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

async function expectAccessibleWithoutOverflow(page: Page, surface: string): Promise<void> {
  const scan = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(scan.violations, `${surface} has no axe violations`).toEqual([]);
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message: `${surface} has no horizontal overflow` },
  ).toBe(true);
}

test('an unmatched URL renders the root not-found card, outside the shell, with a 404', async ({ page }) => {
  for (const width of [1440, 375] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    const response = await page.goto('/app/this-route-does-not-exist');
    expect(response?.status(), `the unmatched URL answers 404 at ${width}px`).toBe(404);

    const card = page.locator('main.sign-in > section.sign-in-card');
    await expect(card.getByRole('heading', { level: 1, name: notFound.heading, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }), `one level-one heading at ${width}px`).toHaveCount(1);
    await expect(card.getByText(notFound.lead, { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: notFound.action, exact: true })).toHaveAttribute('href', '/app');
    await expect(page).toHaveTitle(notFound.title);
    // The root fallback renders in the root layout: no banner, sidebar or navigation.
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.locator('.sidebar, .header')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expectAccessibleWithoutOverflow(page, `the root not-found at ${width}px`);
  }
});

test('a notFound() inside the shell renders the same copy in the shell', async ({ page }) => {
  await signInAsSecurityAnalyst(page);

  for (const width of [1440, 375] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    // An unknown Administration collection raises notFound() in the page and its metadata.
    await page.goto('/app/admin/not-a-collection');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: notFound.heading, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }), `one level-one heading at ${width}px`).toHaveCount(1);
    await expect(main.getByText(notFound.lead, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: notFound.action, exact: true })).toHaveAttribute('href', '/app');
    await expect(page).toHaveTitle(notFound.title);
    // The shell stays: the banner names the role, and the framework's default 404 is gone.
    await expect(page.getByRole('banner').getByText('Security Analyst', { exact: true })).toBeVisible();
    await expect(page.getByText(/could not be found/i)).toHaveCount(0);
    await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"], [role="status"][aria-label^="Loading"]')).toHaveCount(0);
    await expectAccessibleWithoutOverflow(page, `the in-shell not-found at ${width}px`);
  }
});
