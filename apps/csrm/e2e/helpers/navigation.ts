import { expect, type Page, type TestInfo } from '@playwright/test';

/** The development identities the attested E2E runtime offers on `/sign-in`. */
export type SignInRole = 'Requestor' | 'Secondary Requestor' | 'Security Analyst';

/*
 * Signs in through the development sign-in and proves the application shell (D-15): the level-one
 * Home heading and the role in the banner. Never the URL: '/sign-in?returnTo=/app' also ends in
 * '/app', so a URL match passes on a click that never left sign-in. The role proves the session is the
 * one asked for, since every actor's Home carries the same heading.
 */
export async function signInAs(page: Page, role: SignInRole): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);

  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true }), `SIGN_IN_SHELL:${role}`).toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), `SIGN_IN_ROLE:${role}`).toBeVisible();
}

/*
 * Opens a navigation item the way the current width offers it: the sidebar link while the sidebar is
 * shown (1024px and wider), otherwise through the Menu sheet, where the sidebar's items live below
 * 1024px.
 */
export async function openFromNavigation(page: Page, name: string, exact = false): Promise<void> {
  const sidebarLink = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name, exact });
  if (await sidebarLink.first().isVisible()) {
    await sidebarLink.first().click();
    return;
  }
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name, exact }).click();
}

/*
 * The width a journey runs at, from its Playwright project (D-14): 1440×900 in `desktop`, 375×812 in
 * `mobile`. A journey starts here and returns here after each deliberate sweep of other widths.
 */
export function primaryViewport(testInfo: TestInfo): { width: number; height: number } {
  const viewport = testInfo.project.use.viewport;
  return viewport ? { width: viewport.width, height: viewport.height } : { width: 1440, height: 900 };
}
