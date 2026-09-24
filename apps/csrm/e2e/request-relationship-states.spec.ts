import { expect, test, type Page } from '@playwright/test';

/*
 * The related-record states on a request detail, proved in the browser.
 *
 * These are the states unit coverage cannot reach and the ones most worth
 * proving: an assessment the actor may not open must leave no trace at all,
 * because its existence is itself protected, while an absent questionnaire must
 * say plainly that nothing is linked rather than read as an empty account.
 *
 * Records are reached by navigating and clicking, never by a hardcoded
 * identifier: the harness seeds its own database and Strapi generates fresh
 * document ids each time, so only the request numbers are stable.
 */

// Titles, because a list opens a record from its title and only the seeded
// numbers and titles are stable — document ids are generated per seed.
const requestWithNoAssessment = 'Customer portal questionnaire draft request';
const releasedRequest = 'Canonical released assessment request';
const releasedAssessmentNumber = 'ASM-2026-33SAEN';

const relationshipSection = 'Request relationships';
const tileLabel = 'Contextual Risks by residual rating';

async function signIn(page: Page, role: 'Requestor' | 'Security Analyst'): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) {
    throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  }

  await page.getByRole('button', { name: `Continue as ${role}` }).click();
  await expect(page, 'RELATIONSHIP_STATES_SHELL_URL').toHaveURL(/\/app$/);
  await expect(page.getByRole('main'), 'RELATIONSHIP_STATES_SHELL_MAIN').toBeVisible();
  await expect(
    page.getByRole('banner').getByText(role, { exact: true }),
    'RELATIONSHIP_STATES_SHELL_ROLE',
  ).toBeVisible();
}

/** Opens a request from the list by its title, which is how a record opens. */
async function openRequest(page: Page, listPath: string, title: string): Promise<void> {
  await page.goto(listPath);
  const link = page.getByRole('link', { name: title }).first();
  await expect(link, `RELATIONSHIP_OPEN_${title}`).toBeVisible();
  await link.click();
  await expect(page, `RELATIONSHIP_OPENED_${title}`).toHaveURL(/\/requests\/(?!new$)[^/]+$/);
}

async function expectNoHorizontalOverflow(page: Page, baseline: string): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, baseline).toBe(true);
}

for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
  const label = viewport.toUpperCase();

  test(`a Requestor never sees an assessment identifier they cannot open at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await signIn(page, 'Requestor');

    /*
     * Asserted as an invariant over every request this actor owns rather than
     * against one fixture. Which request holds an unreleased assessment depends
     * on what the rest of the suite has generated and released by the time this
     * runs, so naming one made the result depend on spec order.
     *
     * The property does not: an assessment identifier may appear only inside a
     * link that opens it. An assessment this actor may not open contributes no
     * identifier at all, so a regression that rendered its number as plain text
     * or as a disabled label fails here.
     */
    await page.goto('/app/requests');
    // evaluateAll does not wait: the list streams in behind the DataTable skeleton, so wait for
    // a real request link at this width before collecting them.
    await expect(
      page.locator('main a[href^="/app/requests/"]:not([href="/app/requests/new"]):visible').first(),
      `RELATIONSHIP_${label}_LIST_RENDERED`,
    ).toBeVisible();
    const titles = await page.getByRole('link', { name: /\S/ }).evaluateAll(
      (links) => links
        // `/app/requests/new` is the create link, not a record.
        .filter((link) => /^\/app\/requests\/(?!new$)[^/]+$/.test(link.getAttribute('href') ?? ''))
        .map((link) => link.textContent?.trim() ?? '')
        .filter(Boolean),
    );
    expect(titles.length, `RELATIONSHIP_${label}_OWNED_REQUESTS_PRESENT`).toBeGreaterThan(0);

    for (const title of titles) {
      await openRequest(page, '/app/requests', title);
      const unlinkedAssessmentNumbers = await page.evaluate(() => {
        const pattern = /ASM-[A-Z0-9-]+/;
        return [...document.querySelectorAll('main *')]
          .filter((el) => el.children.length === 0 && pattern.test(el.textContent ?? ''))
          .filter((el) => !el.closest('a'))
          .map((el) => (el.textContent ?? '').trim());
      });
      expect(
        unlinkedAssessmentNumbers,
        `RELATIONSHIP_${label}_UNLINKED_ASSESSMENT_IDENTIFIER_ON_${title}`,
      ).toEqual([]);
      await expectNoHorizontalOverflow(page, `RELATIONSHIP_${label}_OVERFLOW_ON_${title}`);
    }
  });

  test(`a request with no assessment shows no tally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await signIn(page, 'Requestor');
    await openRequest(page, '/app/requests', requestWithNoAssessment);

    await expect(page.getByRole('heading', { name: relationshipSection }), `RELATIONSHIP_${label}_ABSENT_SECTION`).toBeVisible();
    await expect(page.getByText(tileLabel), `RELATIONSHIP_${label}_ABSENT_SHOWS_NO_TILE`).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `RELATIONSHIP_${label}_ABSENT_OVERFLOW`);
  });

  test(`an absent questionnaire is named and a released assessment is counted at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await signIn(page, 'Security Analyst');
    await openRequest(page, '/app/requests', releasedRequest);

    // Absence is stated, never left as blank space.
    await expect(
      page.getByText('No questionnaire is linked'),
      `RELATIONSHIP_${label}_ABSENT_QUESTIONNAIRE_IS_NAMED`,
    ).toBeVisible();

    // The tile names the rating it counts and renders every rating, zeros
    // included, so an all-zero tally stays readable and comparable.
    await expect(page.getByText(tileLabel), `RELATIONSHIP_${label}_TILE_NAMES_RESIDUAL`).toBeVisible();
    const tileLink = page.getByRole('link', { name: releasedAssessmentNumber });
    await expect(tileLink, `RELATIONSHIP_${label}_TILE_OPENS_FROM_IDENTIFIER`).toHaveCount(1);
    await expect(tileLink).toHaveAttribute('href', /^\/app\/assessments\/[^/]+$/);
    for (const rating of ['Low', 'Moderate', 'High', 'Critical'] as const) {
      await expect(
        page.getByLabel(new RegExp(`^${rating} residual contextual risks: \\d+$`)),
        `RELATIONSHIP_${label}_TILE_RATING_${rating.toUpperCase()}`,
      ).toHaveCount(1);
    }

    await expectNoHorizontalOverflow(page, `RELATIONSHIP_${label}_TILE_OVERFLOW`);
  });
}

/*
 * The hub itself: both actors get the same six summaries from one structure,
 * and the Analyst additionally learns where the questionnaire stands in
 * governance. Proved in the browser because the wording difference comes from
 * a server projection no unit test exercises end to end.
 */
const hubHeadings = ['Questionnaire', 'Assessment', 'Risks', 'Controls', 'Information systems', 'Information assets'];

for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
  const label = viewport.toUpperCase();

  test(`the request hub gives both actors the same six summaries at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    /*
     * Driven from a request the Requestor owns and whose questionnaire they may
     * open, so both the six summaries and the actor-scoped questionnaire wording
     * are exercised.
     */
    await signIn(page, 'Requestor');
    await openRequest(page, '/app/requests', requestWithNoAssessment);
    const requestorUrl = page.url();

    await expect(page.getByRole('heading', { name: 'Request summary' }), `HUB_${label}_SUMMARY`).toBeVisible();
    await expect(page.getByText(/^Next action: /), `HUB_${label}_NEXT_ACTION`).toBeVisible();
    const requestorHeadings = (await page.locator('main h3').allTextContents()).map((value) => value.trim());
    expect(requestorHeadings.filter((value) => hubHeadings.includes(value)), `HUB_${label}_REQUESTOR_HEADINGS`).toEqual(hubHeadings);
    await expect(page.getByText(/^Questionnaire state: /), `HUB_${label}_REQUESTOR_STATE_IS_PLAIN`).toBeVisible();
    await expect(page.getByText(/^Governance state: /), `HUB_${label}_REQUESTOR_SEES_NO_GOVERNANCE_STATE`).toHaveCount(0);

    // The business context a Requestor submitted stays readable on the record
    // they own; the hub summarises it, it does not replace it.
    await expect(page.getByRole('heading', { name: 'Request context' }), `HUB_${label}_REQUEST_CONTEXT_RETAINED`).toBeVisible();
    await expectNoHorizontalOverflow(page, `HUB_${label}_REQUESTOR_OVERFLOW`);

    /*
     * The Analyst opens the same record directly. Reaching it through a queue
     * would make this test depend on which bucket the fixture falls in, which
     * is a different property proved by its own test.
     */
    await signIn(page, 'Security Analyst');
    await page.goto(requestorUrl.replace('/app/requests/', '/app/review/requests/'));
    await expect(page.getByRole('heading', { name: 'Request summary' }), `HUB_${label}_ANALYST_SUMMARY`).toBeVisible();
    const analystHeadings = (await page.locator('main h3').allTextContents()).map((value) => value.trim());
    expect(analystHeadings.filter((value) => hubHeadings.includes(value)), `HUB_${label}_ANALYST_HEADINGS`).toEqual(hubHeadings);
    await expect(page.getByText(/^Governance state: /), `HUB_${label}_ANALYST_STATE_IS_GOVERNANCE`).toBeVisible();
    await expectNoHorizontalOverflow(page, `HUB_${label}_ANALYST_OVERFLOW`);
  });
}
