import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

import { strapiHealthUrl } from '../harness-urls';
import { signInAs, type SignInRole } from './navigation';

/*
 * Phase 13 (REQ-08, COLLAB-01): the helpers both request collaboration specs share (`request-pick-up.spec.ts`,
 * `request-notes.spec.ts`), kept in one place so a fix to one reaches both (IN-604).
 */

/**
 * Checks that only observe, so one local break can be seen failing at every such check of a journey in one run
 * (the Phase 12 stage B pattern). The test still fails at its end when any of them failed.
 */
export const softly = expect.configure({ soft: true });

export async function expectStrapiHealthy(page: Page): Promise<void> {
  const health = await page.request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
}

/** Signs in as `role` on a clean session, so no earlier actor's cookie survives the switch. */
export async function switchTo(page: Page, role: SignInRole): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, role);
}

export const requestorPath = (documentId: string) => `/app/requests/${encodeURIComponent(documentId)}`;
export const analystPath = (documentId: string) => `/app/review/requests/${encodeURIComponent(documentId)}`;

/*
 * Zero serious or critical axe violations on the WCAG 2.2 A and AA tags (13-UI-SPEC Accessibility, Automated).
 *
 * The scan reads settled notifications. Axe measures text contrast through an opacity that is still changing, and
 * Sonner fades a stacked toast's content out over 400 ms when a newer toast arrives (and fades a new toast in), so a
 * scan taken inside that window reads a toast mid-fade as low contrast (the Phase 14 stage B regression run:
 * `COLLAB02_REMOVE_UNDO` at 375). The scan therefore waits until no transition or animation is running inside the
 * toaster; the toasts themselves stay on screen and are scanned.
 */
export async function expectNoSeriousViolations(page: Page, surface: string): Promise<void> {
  /*
   * After a client navigation the route's title arrives with its streamed metadata, a moment after the new page's content
   * (the Phase 15 gate, 2026-10-12: axe read `document-title` on the assessment review at 375). Every CSRM route has a
   * title, so the scan waits for it, as a reader's browser tab would show it.
   */
  await expect.poll(() => page.title(), { message: `axe on ${surface}: the page has its title before the scan`, timeout: 10_000 }).not.toBe('');
  await expect.poll(
    () => page.evaluate(() => document.getAnimations().filter((animation) => {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      return animation.playState === 'running' && target instanceof Element && target.closest('[data-sonner-toaster]') !== null;
    }).length),
    { message: `axe on ${surface}: the notifications have settled before the scan`, timeout: 10_000 },
  ).toBe(0);
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(serious.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(' ')}${node.any[0]?.message ? ` (${node.any[0].message})` : ''}`).join(' | ')}`), `axe on ${surface}`).toEqual([]);
}

/**
 * No horizontal page overflow at whatever width the page has (WR-606): at 375 a card list must fit, and at 1440 a
 * table that gained a column (the Requests queue's `Assigned to`) must scroll inside its labelled region, never the
 * page (13-UI-SPEC §2.2).
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const width = page.viewportSize()?.width;
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message: `${label}: no horizontal page overflow at ${width}px` },
  ).toBe(true);
}

/** The value of a row in the hub's Request summary, found by its term (13-UI-SPEC §5.1). */
export function summaryValue(page: Page, term: string): Locator {
  return page.getByRole('region', { name: 'Request summary' })
    .locator('dl > div')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${term}$`) }) })
    .locator('dd');
}

/** A toast on the page, by its words (X-14). */
export function toastWith(page: Page, text: string): Locator {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

/** The list's own result total, from its `{n} results` output. */
export async function shownListTotal(page: Page): Promise<number> {
  const output = page.getByRole('main').locator('output').filter({ hasText: /^[\d,]+ results?$/ });
  await expect(output).toHaveCount(1);
  return Number((await output.textContent())!.replace(/[^\d]/g, ''));
}

/** The list's total, or 0 when the list shows its empty state instead (a figure of zero opens an empty list). */
export async function shownListTotalOrEmpty(page: Page): Promise<number> {
  const main = page.getByRole('main');
  const output = main.locator('output').filter({ hasText: /^[\d,]+ results?$/ });
  const empty = main.locator('[data-slot="state"][data-state-kind="empty"]');
  await expect(output.or(empty).first(), 'the list shows its total or its empty state').toBeVisible();
  if (await output.count() > 0) return shownListTotal(page);
  await expect(main.locator('a.record-link'), 'an empty list shows no record').toHaveCount(0);
  return 0;
}

/**
 * D1 (the 13-19 walk; 13-UI-SPEC §2.2, §5.1, §12.3, §12.4): after a link to `#{id}` the target is on screen once the
 * streamed page exists, and keyboard focus is on `focused` (the target itself, or the heading that names it), so a
 * keyboard or screen reader user is taken where the link said (WCAG 2.4.3).
 */
export async function expectLandedOn(page: Page, id: string, focused: Locator, label: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).hash, { message: `${label}: the URL names #${id}` }).toBe(`#${encodeURIComponent(id)}`);
  await softly(page.locator(`[id="${id}"]`), `${label}: #${id} is brought into the viewport`).toBeInViewport();
  await softly(focused, `${label}: focus moves to what #${id} names`).toBeFocused();
}

/** Bob starts questionnaire generation from the hub and waits for its review link; the deterministic job may finish at once. */
export async function generateQuestionnaire(page: Page, label: string): Promise<string> {
  await page.getByRole('button', { name: 'Generate questionnaire' }).click();
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  const hubLink = page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ });
  await expect.poll(async () => await review.count() + await hubLink.count(), { message: `${label}: the questionnaire is generated`, timeout: 60_000 }).toBeGreaterThan(0);
  const href = await (await review.count() > 0 ? review : hubLink).first().getAttribute('href', { timeout: 5_000 });
  expect(href, `${label}: the questionnaire review route`).toMatch(/^\/app\/review\/questionnaires\/[^/]+$/);
  return href!;
}

export function notesSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Notes', exact: true });
}

/** The Notes heading, which a link to `#notes` focuses once the streamed page exists (D1, UI-D27). */
export function notesHeading(page: Page): Locator {
  return page.locator('#notes').getByRole('heading', { level: 2, name: 'Notes', exact: true });
}

/** The note in the thread whose body is `text`. */
export function noteWith(page: Page, requestNumber: string, text: string): Locator {
  return notesSection(page).getByRole('list', { name: `Notes on ${requestNumber}` }).getByRole('article').filter({ hasText: text });
}

/** Adds a note through the composer and waits for Strapi's answer: the note shows its posted time, not `Adding…`. */
export async function addNote(page: Page, requestNumber: string, text: string, via: 'shortcut' | 'button'): Promise<Locator> {
  const composer = notesSection(page).getByRole('textbox', { name: 'Add a note' });
  await composer.fill(text);
  if (via === 'shortcut') await composer.press('Control+Enter');
  else await notesSection(page).getByRole('button', { name: 'Add note', exact: true }).click();
  const note = noteWith(page, requestNumber, text);
  await expect(note.locator('time'), 'the added note shows the time Strapi recorded').toBeVisible();
  await expect(note.getByText('Adding…', { exact: true })).toHaveCount(0);
  await expect(composer, 'the composer is cleared once the note is added').toHaveValue('');
  await expect(page.getByRole('status').filter({ hasText: 'Note added.' })).toHaveCount(1);
  return note;
}

/**
 * D-24, §9.2 (WR-602): the thread on the page has been seen, so the next server render reads none of its notes as new.
 * The mark-read call is not awaited by the page, so the next render is read until it agrees; that wait is also the
 * journey's clean-up.
 */
export async function expectNoneNewOnNextRender(page: Page, requestNumber: string, label: string): Promise<void> {
  const thread = notesSection(page).getByRole('list', { name: `Notes on ${requestNumber}` });
  await expect.poll(async () => {
    await page.reload();
    await expect(thread.getByRole('article').first()).toBeVisible();
    return thread.getByText('New', { exact: true }).count();
  }, { message: `${label}: D-24, the notes seen on the last view are no longer new on the next render`, timeout: 30_000 }).toBe(0);
}
