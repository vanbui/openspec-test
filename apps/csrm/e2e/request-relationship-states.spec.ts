import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInAs } from './helpers/navigation';
import { createSubmittedRequest } from './helpers/requests';

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
const requestWithNoAssessment = 'Customer portal virtual assistant and live chat';
const releasedRequest = 'Customer portal public outage map without sign-in';
const releasedAssessmentNumber = 'ASM-2026-33SAEN';

const relationshipSection = 'Request relationships';
const tileLabel = 'Risks by residual rating';

/*
 * Opens a request from the list by its title, which is how a record opens. A seeded title is searched for
 * first: earlier journeys create requests of their own, so a seeded one need not be on the list's first page.
 * A link already read from the first page (`search` false) is opened from that page as it was read.
 */
async function openRequest(page: Page, listPath: string, title: string, search = true): Promise<void> {
  await page.goto(search ? `${listPath}?q=${encodeURIComponent(title)}` : listPath);
  const link = page.getByRole('link', { name: title }).first();
  await expect(link, `RELATIONSHIP_OPEN_${title}`).toBeVisible();
  await link.click();
  await expect(page, `RELATIONSHIP_OPENED_${title}`).toHaveURL(/\/requests\/(?!new$)[^/]+$/);
}

async function expectNoHorizontalOverflow(page: Page, baseline: string): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, baseline).toBe(true);
}

/*
 * Walk D13(b): the words of the stepper's steps that the browser draws across two lines, each with its step text. A
 * Range over one word returns one box per line it is drawn on, so a word broken inside itself has two line tops.
 */
async function wordsBrokenAcrossLines(steps: Locator): Promise<string[]> {
  return steps.evaluate((list) => {
    const broken: string[] = [];
    const walker = document.createTreeWalker(list, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      for (const match of text.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(text, match.index ?? 0);
        range.setEnd(text, (match.index ?? 0) + match[0].length);
        const lines = new Set([...range.getClientRects()].filter((box) => box.width > 0).map((box) => Math.round(box.top)));
        if (lines.size > 1) broken.push(`${match[0]} in “${text.data.trim()}”`);
      }
    }
    return broken;
  });
}

for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
  const label = viewport.toUpperCase();

  test(`a Requestor never sees an assessment identifier they cannot open at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await signInAs(page, 'Requestor');

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
      // Each link was read from the list's first page above, and some name a next step, not a title.
      await openRequest(page, '/app/requests', title, false);
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
    await signInAs(page, 'Requestor');
    await openRequest(page, '/app/requests', requestWithNoAssessment);

    await expect(page.getByRole('heading', { name: relationshipSection }), `RELATIONSHIP_${label}_ABSENT_SECTION`).toBeVisible();
    await expect(page.getByText(tileLabel), `RELATIONSHIP_${label}_ABSENT_SHOWS_NO_TILE`).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `RELATIONSHIP_${label}_ABSENT_OVERFLOW`);
  });

  test(`an absent questionnaire is named and a released assessment is counted at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await signInAs(page, 'Security Analyst');
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
        page.getByLabel(new RegExp(`^${rating} residual Risks: \\d+$`)),
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
    await signInAs(page, 'Requestor');
    await openRequest(page, '/app/requests', requestWithNoAssessment);
    const requestorUrl = page.url();

    await expect(page.getByRole('heading', { name: 'Request summary' }), `HUB_${label}_SUMMARY`).toBeVisible();
    /*
     * E18, UI-D23: both next-action lines are in the DOM and one is displayed per width, so the line is read
     * where that width shows it: the lifecycle section's compact block on a phone, the hub from 768px.
     */
    const nextActionSection = width === 375
      ? page.getByRole('region', { name: /^Current lifecycle state:/ })
      : page.getByRole('region', { name: 'Request summary' });
    await expect(nextActionSection.getByText(/^Next action: /), `HUB_${label}_NEXT_ACTION`).toBeVisible();
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
    await signInAs(page, 'Security Analyst');
    await page.goto(requestorUrl.replace('/app/requests/', '/app/review/requests/'));
    await expect(page.getByRole('heading', { name: 'Request summary' }), `HUB_${label}_ANALYST_SUMMARY`).toBeVisible();
    const analystHeadings = (await page.locator('main h3').allTextContents()).map((value) => value.trim());
    expect(analystHeadings.filter((value) => hubHeadings.includes(value)), `HUB_${label}_ANALYST_HEADINGS`).toEqual(hubHeadings);
    await expect(page.getByText(/^Governance state: /), `HUB_${label}_ANALYST_STATE_IS_GOVERNANCE`).toBeVisible();
    await expectNoHorizontalOverflow(page, `HUB_${label}_ANALYST_OVERFLOW`);
  });
}

/*
 * UX08_PHONE_STEPPER (UX-08 criterion 3, UAT-038, D-26, UI-SPEC §6.3). Eight stacked step cards took 880px on a
 * phone, so a request page's first screen said nothing about what happens next. Below 768px the stepper now reads
 * its heading, `Step {n} of {m}` and the next action, with the full list one tap away; from 768px the full stepper
 * shows and the hub carries the one next action (UI-D23).
 *
 * This file is not on the mobile project's list, so the test runs once, in the desktop project, and sets each
 * width it claims itself, as this file's other width checks do. It creates its own submitted request.
 */
async function expectWithinFirstScreen(locator: Locator, criterion: string): Promise<void> {
  await expect(locator, criterion).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${criterion}_HAS_BOX`).not.toBeNull();
  expect(box!.y + box!.height, criterion).toBeLessThanOrEqual(812);
}

test('UX08_PHONE_STEPPER: a request page reads its step and next action on the first phone screen', async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, 'Requestor');
  const { documentId } = await createSubmittedRequest(page, {
    title: `Phone lifecycle request ${Date.now()}`,
    assessmentType: 'Project',
    businessCriticality: 'Moderate',
    dueDate: null,
  });
  const requestPath = `/app/requests/${encodeURIComponent(documentId)}`;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(requestPath);
  const lifecycle = page.getByRole('region', { name: /^Current lifecycle state:/ });
  const compactNextAction = lifecycle.locator('p').filter({ hasText: /^Next action: / });
  await expectWithinFirstScreen(lifecycle.getByRole('heading', { name: 'Current lifecycle state: Submitted' }), 'UX08_PHONE_STEPPER_REQUESTOR_HEADING');
  await expectWithinFirstScreen(lifecycle.getByText('Step 2 of 8', { exact: true }), 'UX08_PHONE_STEPPER_REQUESTOR_STEP_LINE');
  await expect(compactNextAction, 'UX08_PHONE_STEPPER_REQUESTOR_NEXT_ACTION').toHaveText('Next action: Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.');
  await expect(compactNextAction.getByRole('link'), 'UX08_PHONE_STEPPER_REQUESTOR_NEXT_ACTION_IS_TEXT').toHaveCount(0);
  await expectWithinFirstScreen(compactNextAction, 'UX08_PHONE_STEPPER_REQUESTOR_NEXT_ACTION_IN_FIRST_SCREEN');
  // One next action per width: the hub's line is not displayed below 768px.
  await expect(page.getByRole('region', { name: 'Request summary' }).locator('p').filter({ hasText: /^Next action: / }), 'UX08_PHONE_STEPPER_REQUESTOR_HUB_LINE_HIDDEN').toBeHidden();

  // The full lifecycle is one tap away.
  const steps = page.getByRole('list', { name: 'Assessment request lifecycle' });
  await expect(steps, 'UX08_PHONE_STEPPER_LIST_COLLAPSED').toBeHidden();
  const disclosure = lifecycle.getByRole('button', { name: 'Show all steps' });
  await expect(disclosure, 'UX08_PHONE_STEPPER_DISCLOSURE_COLLAPSED').toHaveAttribute('aria-expanded', 'false');
  await disclosure.click();
  const hide = lifecycle.getByRole('button', { name: 'Hide all steps' });
  await expect(hide, 'UX08_PHONE_STEPPER_DISCLOSURE_EXPANDED').toHaveAttribute('aria-expanded', 'true');
  await expect(hide, 'UX08_PHONE_STEPPER_DISCLOSURE_KEEPS_FOCUS').toBeFocused();
  await expect(steps.getByRole('listitem'), 'UX08_PHONE_STEPPER_SHOWS_ALL_STEPS').toHaveCount(8);
  // Walk D13(b): the expanded phone list breaks no step label inside a word, down to 320px.
  for (const phoneWidth of [320, 375]) {
    await page.setViewportSize({ width: phoneWidth, height: 812 });
    expect.soft(await wordsBrokenAcrossLines(steps), `D13(b): no step label breaks inside a word at ${phoneWidth}px`).toEqual([]);
  }
  await expectNoHorizontalOverflow(page, 'UX08_PHONE_STEPPER_REQUESTOR_NO_OVERFLOW');

  // From 768px the full stepper shows, the compact lines do not, and the hub carries the next action.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(lifecycle.getByText('Step 2 of 8', { exact: true }), 'UX08_DESKTOP_STEPPER_NO_STEP_LINE').toBeHidden();
  await expect(compactNextAction, 'UX08_DESKTOP_STEPPER_NO_COMPACT_NEXT_ACTION').toBeHidden();
  await expect(steps.getByRole('listitem'), 'UX08_DESKTOP_STEPPER_FULL_LIST').toHaveCount(8);
  await expect(steps, 'UX08_DESKTOP_STEPPER_FULL_LIST_SHOWN').toBeVisible();
  await expect(page.getByRole('region', { name: 'Request summary' }).locator('p').filter({ hasText: /^Next action: / }), 'UX08_DESKTOP_HUB_NEXT_ACTION').toHaveText('Next action: Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.');

  /*
   * The Security Analyst opens the same request. It is submitted, so the page offers questionnaire generation and
   * the hub's own lifecycle keeps that action; the stepper reads that lifecycle (D-28), so the phone's compact line
   * names it, as a link, on the first screen. Walkthrough fix 4 withholds it only on a request that is not
   * submitted, which the unit cases prove.
   */
  await signInAs(page, 'Security Analyst');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/app/review/requests/${encodeURIComponent(documentId)}`);
  const analystLifecycle = page.getByRole('region', { name: /^Current lifecycle state:/ });
  const analystNextAction = analystLifecycle.locator('p').filter({ hasText: /^Next action: / });
  const analystHubLine = page.getByRole('region', { name: 'Request summary' }).locator('p').filter({ hasText: /^Next action: / });
  await expectWithinFirstScreen(analystLifecycle.getByRole('heading', { name: 'Current lifecycle state: Submitted' }), 'UX08_PHONE_STEPPER_ANALYST_HEADING');
  await expectWithinFirstScreen(analystLifecycle.getByText('Step 2 of 8', { exact: true }), 'UX08_PHONE_STEPPER_ANALYST_STEP_LINE');
  await expect(analystNextAction, 'UX08_PHONE_STEPPER_ANALYST_NEXT_ACTION').toHaveText('Next action: Generate the questionnaire.');
  await expectWithinFirstScreen(analystNextAction.getByRole('link', { name: 'Generate the questionnaire.' }), 'UX08_PHONE_STEPPER_ANALYST_NEXT_ACTION_LINK_IN_FIRST_SCREEN');
  await expect(analystHubLine, 'UX08_PHONE_STEPPER_ANALYST_HUB_LINE_HIDDEN').toBeHidden();
  await expectNoHorizontalOverflow(page, 'UX08_PHONE_STEPPER_ANALYST_NO_OVERFLOW');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(analystLifecycle.getByText('Step 2 of 8', { exact: true }), 'UX08_DESKTOP_ANALYST_STEPPER_NO_STEP_LINE').toBeHidden();
  await expect(analystNextAction, 'UX08_DESKTOP_ANALYST_STEPPER_NO_COMPACT_NEXT_ACTION').toBeHidden();
  await expect(analystHubLine, 'UX08_DESKTOP_ANALYST_HUB_NEXT_ACTION').toHaveText('Next action: Generate the questionnaire.');
  await expect(analystHubLine.getByRole('link', { name: 'Generate the questionnaire.' }), 'UX08_DESKTOP_ANALYST_HUB_NEXT_ACTION_LINK').toBeVisible();

  // Walk D13(b): the hub's full stepper, drawn from 768px, breaks no step label inside a word at any width.
  const analystSteps = page.getByRole('list', { name: 'Assessment request lifecycle' });
  for (const desktopWidth of [1440, 1366, 1280, 1024, 768]) {
    await page.setViewportSize({ width: desktopWidth, height: 900 });
    await expect(analystSteps, `D13B_FULL_STEPPER_SHOWN_${desktopWidth}`).toBeVisible();
    expect.soft(await wordsBrokenAcrossLines(analystSteps), `D13(b): no step label breaks inside a word at ${desktopWidth}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
});
