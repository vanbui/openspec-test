import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** The development identities the attested E2E runtime offers on `/sign-in`. */
export type SignInRole = 'Requestor' | 'Secondary Requestor' | 'Security Analyst' | 'Second Security Analyst';

/*
 * Signs in through the development sign-in and proves the application shell (D-15): the level-one
 * Home heading and the role in the banner. Never the URL: '/sign-in?returnTo=/app' also ends in
 * '/app', so a URL match passes on a click that never left sign-in. The role proves the session is the
 * one asked for, since every actor's Home carries the same heading.
 */
export async function signInAs(page: Page, role: SignInRole): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);

  /*
   * The pointer is parked first. It stays where the last action left it across navigations, and a Button lifts 1px on
   * hover: a pointer resting on a sign-in button's bottom edge lifts it off the pointer and drops it back without end,
   * so the button never holds still for the click (the Phase 14 stage B regression run, questionnaire governance).
   */
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true }), `SIGN_IN_SHELL:${role}`).toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), `SIGN_IN_ROLE:${role}`).toBeVisible();
}

/*
 * The Primary navigation the current width shows: the sidebar's from 1024px, otherwise the Menu sheet's,
 * which this opens. Below 1024px the sidebar is hidden, so its landmark has no accessible role.
 */
export async function showPrimaryNavigation(page: Page): Promise<Locator> {
  const sidebar = page.getByRole('navigation', { name: 'Primary navigation' });
  if (await sidebar.first().isVisible()) return sidebar.first();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const sheetNavigation = page.getByRole('dialog', { name: 'Navigation' }).getByRole('navigation', { name: 'Primary navigation' });
  await expect(sheetNavigation).toBeVisible();
  return sheetNavigation;
}

/*
 * Opens a navigation item the way the current width offers it: the sidebar link while the sidebar is
 * shown (1024px and wider), otherwise through the Menu sheet, where the sidebar's items live below
 * 1024px. A link inside a collapsed section (the analyst's My own requests, UI-SPEC §1.4) is not
 * rendered until its section opens, so the section named by `section`, or else each collapsed section in
 * turn, is expanded until the link shows. A link whose item holds work carries its count in its name
 * ("Requests, 9 waiting for pick-up", 13 D-14), so pass an anchored pattern such as /^Requests\b/ to name it; `exact`
 * applies to a string name only. A collapsed section's button carries its items' count too, so `section` is
 * matched as the start of its name.
 */
export async function openFromNavigation(page: Page, name: string | RegExp, exact = false, section?: string): Promise<void> {
  const navigation = await showPrimaryNavigation(page);
  const link = navigation.getByRole('link', typeof name === 'string' ? { name, exact } : { name }).first();
  const collapsed = section
    ? navigation.getByRole('button', { name: navigationText(section), expanded: false })
    : navigation.getByRole('button', { expanded: false });
  for (let attempt = 0; attempt < 3 && !(await link.isVisible()) && (await collapsed.count()) > 0; attempt += 1) {
    await collapsed.first().click();
  }
  if (!(await link.isVisible())) throw new Error(`OPEN_FROM_NAVIGATION_SECTION_DID_NOT_OPEN:${section ?? String(name)}`);
  await link.click();
}

/*
 * A navigation entry whose item holds work carries a count in its name and text (D-10, UI-SPEC §1.3):
 * the label, a visually hidden ", ", the visible count, then the visually hidden meaning, as in
 * "My requests, 3 need your action". A zero, an unknown or a failed figure shows no count, so the text is
 * the label alone.
 */

/** A navigation entry's label: its text without the count, when it has one. */
export function navigationLabel(text: string): string {
  return text.trim().replace(/, [\d,]+ [^,]+$/, '');
}

/** Matches a navigation entry's text or name: exactly `label`, with or without its count. */
export function navigationText(label: string): RegExp {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(, [\\d,]+ .+)?$`);
}

/*
 * The width a journey runs at, from its Playwright project (D-14): 1440×900 in `desktop`, 375×812 in
 * `mobile`. A journey starts here and returns here after each deliberate sweep of other widths.
 */
export function primaryViewport(testInfo: TestInfo): { width: number; height: number } {
  const viewport = testInfo.project.use.viewport;
  return viewport ? { width: viewport.width, height: viewport.height } : { width: 1440, height: 900 };
}
