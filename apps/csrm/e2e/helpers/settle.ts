import { expect, type Locator, type Page } from '@playwright/test';

import { settleWidthInBrowser } from '../../src/lib/testing/settle-width';

/** What a settled destination looks like: its URL, its exact document title and its level-one heading. */
export type SettledExpectation = {
  url: RegExp;
  title: string | RegExp;
  heading: string;
};

/*
 * A scan or an assertion must measure the destination, not the navigation into
 * it. Straight after a link click the previous route's title and heading are
 * still on screen, so waiting for "a title" and "a heading" can pass against
 * the page being left; a moment later the destination's loading skeleton
 * renders with no heading at all. Settled means all four hold at once: the
 * destination URL, that route's exact document title, its level-one heading
 * visible by name, and nothing still loading (no skeleton, no busy region).
 */
export async function expectSettled(page: Page, expected: SettledExpectation, surface = 'the page'): Promise<void> {
  await expect(page, `${surface} reaches its destination`).toHaveURL(expected.url);
  await expect(page, `${surface} carries its document title`).toHaveTitle(expected.title);
  await expect(
    page.getByRole('heading', { level: 1, name: expected.heading, exact: true }),
    `${surface} shows its level-one heading`,
  ).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"]'), `${surface} has nothing still loading`).toHaveCount(0);
}

/*
 * Waits until an element's scroll and client widths hold for three consecutive animation frames.
 * Right after a viewport change the layout can still be settling, so a single early reading can see
 * the previous width's layout and expect an overflow the settled page no longer has.
 */
export async function settleElementWidth(element: Locator): Promise<void> {
  await element.evaluate(settleWidthInBrowser, { label: String(element), frameLimit: 120 });
}
