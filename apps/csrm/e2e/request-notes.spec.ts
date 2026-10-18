import { expect, test, type Locator, type Page } from '@playwright/test';

import { openFromNavigation } from './helpers/navigation';
import {
  addNote,
  analystPath,
  expectLandedOn,
  expectNoHorizontalOverflow,
  expectNoneNewOnNextRender,
  expectNoSeriousViolations,
  expectStrapiHealthy,
  generateQuestionnaire,
  notesHeading,
  notesSection,
  noteWith,
  requestorPath,
  shownListTotal,
  summaryValue,
  switchTo,
  toastWith,
} from './helpers/request-collaboration';
import { createSubmittedRequest } from './helpers/requests';

/*
 * Phase 13 (COLLAB-01; 13-UI-SPEC §8, §9): the notes Jane and Bob write to each other on a request. Every test runs at
 * 1440 and, through `@journey` and the mobile project's `testMatch`, at 375: each creates its own uniquely titled
 * request, or only reads the seeded released one, so both projects can run it against one database.
 *
 * Read state (D-24, §9.2; WR-602): a journey that leaves a note new to someone has that person read it before it ends,
 * and waits until the next server render reads it as no longer new, so no flag leaks into a later journey and the
 * figures later journeys compare stay exact.
 */

const janesNote = 'After-hours vendor support will come from an offshore team with administrator access.';
const janesSecondNote = 'The vendor also asked for read access to the audit logs during the first quarter.';
const bobsReply = 'Thanks. Which team holds the administrator credentials, and is access logged?';

/** Jane submits a uniquely titled request through the UI and opens its page, where notes are now open. */
async function janeSubmits(page: Page, title: string): Promise<{ requestNumber: string; documentId: string }> {
  await switchTo(page, 'Requestor');
  const submitted = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });
  await page.goto(requestorPath(submitted.documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  return submitted;
}

/*
 * COLLAB-01 criteria 1, 2 and 4 in the UI; success criteria 3 and 4 (D-21 to D-25; UAT-013): Jane adds a note on her
 * request page with Ctrl+Enter; Bob's analyst page flags it on the hub and in the thread; Bob replies. Jane follows the
 * `1 new note` line of her Home, which lands on the thread (D1) with Bob's reply flagged as new, each note attributed
 * by name and part with a local time; once she has seen it, the next render reads it as read and the Home line goes.
 */
test('COLLAB01_NOTES_BETWEEN_JANE_AND_BOB @journey: Jane and Bob exchange notes on her request, each flagged for the other', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB01_NOTES_BETWEEN_JANE_AND_BOB';
  const title = `Notes between Jane and Bob ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);

  // IN-605 (13-UI-SPEC §5.1): before anyone picks it up, Jane's page says so, and the hub has no Owner row.
  await expect(summaryValue(page, 'Security Analyst'), `${label}: nobody holds the new request`).toHaveText('Not picked up yet');
  await expect(summaryValue(page, 'Owner'), `${label}: the hub names the Requestor, not an Owner`).toHaveCount(0);
  const notes = notesSection(page);
  await expect(notes.getByText('No notes yet', { exact: true }), `${label}: an empty thread`).toBeVisible();
  await expect(notes).toContainText('A Security Analyst may include a note in the information CSRM sends to the AI.');
  await expect(summaryValue(page, 'Notes').getByRole('link', { name: 'Add a note', exact: true })).toHaveAttribute('href', '#note-composer');

  const composer = notes.getByRole('textbox', { name: 'Add a note' });
  await composer.focus();
  await expectNoHorizontalOverflow(page, `${label} (Jane’s composer focused)`);
  const janes = await addNote(page, requestNumber, janesNote, 'shortcut');
  await expect(janes.getByText('Jane Doe', { exact: true }), `${label}: Jane’s note names her`).toBeVisible();
  await expect(janes, `${label}: Jane’s note names her part`).toContainText('Requestor · ');
  await expect(composer).toBeFocused();
  await expectNoSeriousViolations(page, `Jane’s request page with a note at ${width}px`);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const figure = summaryValue(page, 'Notes').getByRole('link', { name: '1 note, 1 new', exact: true });
  await expect(figure, `${label}: the hub flags Jane’s note for Bob`).toHaveAttribute('href', '#notes');
  const janesForBob = noteWith(page, requestNumber, janesNote);
  await expect(janesForBob.getByText('Jane Doe', { exact: true })).toBeVisible();
  await expect(janesForBob.getByText('New', { exact: true }), `${label}: Jane’s note is New to Bob`).toBeVisible();
  await janesForBob.scrollIntoViewIfNeeded();

  const bobs = await addNote(page, requestNumber, bobsReply, 'button');
  await expect(bobs.getByText('Bob Doe', { exact: true })).toBeVisible();
  await expect(janesForBob.getByText('New', { exact: true }), `${label}: New stays for Bob’s view`).toBeVisible();
  await notesSection(page).getByRole('textbox', { name: 'Add a note' }).focus();
  await expectNoHorizontalOverflow(page, `${label} (Bob’s composer focused)`);
  await expectNoSeriousViolations(page, `Bob’s request page with notes at ${width}px`);

  // D1 (the 13-19 walk), the Requestor Home's line (13-UI-SPEC §12.3): it opens the thread and lands on it.
  await switchTo(page, 'Requestor');
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  const homeLine = page.getByRole('main').getByRole('link', { name: `1 new note on ${requestNumber}`, exact: true });
  await expect(homeLine, `${label}: Jane’s Home flags Bob’s reply on the request`).toHaveText('1 new note');
  await homeLine.click();
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expectLandedOn(page, 'notes', notesHeading(page), `${label} (D1, Jane’s Home line at ${width}px)`);
  const bobsForJane = noteWith(page, requestNumber, bobsReply);
  await expect(bobsForJane.getByText('Bob Doe', { exact: true }), `${label}: Bob’s reply names him`).toBeVisible();
  await expect(bobsForJane).toContainText('Security Analyst · ');
  await expect(bobsForJane.locator('time')).toBeVisible();
  await expect(bobsForJane.getByText('New', { exact: true }), `${label}: Bob’s reply is New to Jane`).toBeVisible();
  await expect(noteWith(page, requestNumber, janesNote).getByText('New', { exact: true }), 'her own note is never new to her').toHaveCount(0);
  await expect(summaryValue(page, 'Notes').getByRole('link', { name: '2 notes, 1 new', exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, `Jane’s request page with Bob’s reply at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (Jane reads the reply)`);

  // D-24 (WR-602): once seen, the reply is read on the next render, and the Home line is gone.
  await expectNoneNewOnNextRender(page, requestNumber, label);
  await expect(summaryValue(page, 'Notes').getByRole('link', { name: '2 notes', exact: true }), `${label}: the hub no longer counts a new note`).toBeVisible();
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`new notes? on ${requestNumber}$`) }), `${label}: the Home line clears once the reply is read`).toHaveCount(0);
});

/*
 * COLLAB-01 criterion 4 and D-23 in the UI (T-13-35; 13-UI-SPEC §8.6, O1 of the 13-19 walk, changed deliberately):
 * another Requestor opening Jane's request URL gets the in-shell not-found state, as for a missing request, so the
 * page does not confirm the request exists. Nothing of the notes reaches the page: no Notes surface, count or flag,
 * and no note text or title, not even in its flight data.
 */
test('COLLAB01_OTHER_REQUESTOR_REFUSED @journey: the Secondary Requestor opens Jane’s request and sees no notes', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'COLLAB01_OTHER_REQUESTOR_REFUSED';
  const title = `Notes refused to another Requestor ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  await addNote(page, requestNumber, janesNote, 'button');

  await switchTo(page, 'Secondary Requestor');
  await page.goto(requestorPath(documentId));
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `${label}: the request page’s not-found state`).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 }), `${label}: one level-one heading`).toHaveCount(1);
  await expect(page, `${label}: titled by the not-found page, as for a missing request`).toHaveTitle('Page not found | IdamBox CSRM');
  await expect(main.getByText('The page you asked for doesn’t exist or has moved.', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Go to Home', exact: true })).toHaveAttribute('href', '/app');
  await expect(main.locator('[data-state-kind="permission"]'), `${label}: not the permission state, which would confirm the request exists`).toHaveCount(0);
  await expect(page.getByRole('banner').getByText('Secondary Requestor', { exact: true }), `${label}: the shell stays`).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true }), `${label}: no Notes section`).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toHaveCount(0);
  await expect(page.getByText('New', { exact: true }), `${label}: no New flag`).toHaveCount(0);
  await expect(main.getByText(/\b\d+ (new )?notes?\b/i), `${label}: no notes count`).toHaveCount(0);
  await expect(main.getByRole('link', { name: /new notes?/i }), `${label}: no new-notes line`).toHaveCount(0);
  expect(await page.content(), `${label}: no note text anywhere in the page`).not.toContain(janesNote);
  expect(await page.content()).not.toContain(title);
  expect(await page.content()).not.toContain(requestNumber);
  await expectNoSeriousViolations(page, `the Secondary Requestor on Jane’s request at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, label);
});

/*
 * D-22 (13-UI-SPEC §8.4, §8.5): on Jane's seeded released request the composer is replaced by the closed line, and the
 * empty thread reads No notes. The test only reads the seeded record, so it runs in both projects.
 */
test('COLLAB01_NOTES_CLOSED_ON_RELEASED @journey: Jane’s released request says notes are closed and offers no composer', async ({ page }) => {
  test.setTimeout(120_000);
  await expectStrapiHealthy(page);
  await switchTo(page, 'Requestor');
  await page.goto('/app/assessments');
  await page.getByRole('link', { name: 'ASM-E2E-NAV-OWNER-001' }).click();
  await page.getByRole('link', { name: 'RAR-E2E-NAV-OWNER-001 · Enterprise password manager rollout' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enterprise password manager rollout', exact: true })).toBeVisible();

  const notes = notesSection(page);
  await expect(
    notes.getByText('Notes closed when the assessment was released. They stay here as part of the record.', { exact: true }),
    'COLLAB01_NOTES_CLOSED_ON_RELEASED: the closed line',
  ).toBeVisible();
  // IN-602 (§8.5): with the window closed and nothing written, the thread reads No notes.
  await expect(notes.getByText('No notes', { exact: true }), 'COLLAB01_NOTES_CLOSED_ON_RELEASED: the empty closed thread').toBeVisible();
  await expect(notes.getByRole('button', { name: 'Add note' }), 'COLLAB01_NOTES_CLOSED_ON_RELEASED: no composer').toHaveCount(0);
  await expect(notes.getByRole('textbox', { name: 'Add a note' })).toHaveCount(0);
  await expectNoSeriousViolations(page, `Jane’s released request at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, 'COLLAB01_NOTES_CLOSED_ON_RELEASED');
});

/*
 * COLLAB-01 criterion 3 and D-26 in the UI (13-UI-SPEC §10.1, §10.4; X-18; T-13-37): Bob marks Jane's note as changing
 * the AI inputs from the thread with the keyboard (Space on the switch; WR-605), undoes it, marks it again, and the
 * mark survives a reload; Jane's page never shows the mark. Strapi refuses the mark for anyone else (13-05, 13-06);
 * this proves the UI half.
 */
test('COLLAB01_MARK_CHANGES_AI_INPUTS @journey: Bob marks Jane’s note as changing the AI inputs, undoes it and marks it again', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const title = `Notes marked for the AI ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  await addNote(page, requestNumber, janesNote, 'button');
  await expect(notesSection(page).getByRole('switch'), 'COLLAB01_MARK_CHANGES_AI_INPUTS: no switch for Jane').toHaveCount(0);
  await expect(notesSection(page).getByRole('checkbox'), 'COLLAB01_MARK_CHANGES_AI_INPUTS: no checkbox for Jane').toHaveCount(0);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(notesSection(page).getByRole('checkbox', { name: 'Changes the AI inputs' }), 'COLLAB01_MARK_CHANGES_AI_INPUTS: the composer checkbox, off').not.toBeChecked();
  const mark = noteWith(page, requestNumber, janesNote).getByRole('switch', { name: 'Changes the AI inputs' });
  await expect(mark).toHaveAttribute('aria-checked', 'false');
  await mark.focus();
  await mark.press('Space');
  await expect(mark, 'COLLAB01_MARK_CHANGES_AI_INPUTS: Space on the switch applies the mark at once (WR-605)').toHaveAttribute('aria-checked', 'true');
  const marked = toastWith(page, 'Note marked as changing the AI inputs.');
  await expect(marked).toBeVisible();
  await expectNoHorizontalOverflow(page, 'COLLAB01_MARK_CHANGES_AI_INPUTS (marked, toast showing)');
  await marked.getByRole('button', { name: 'Undo' }).click();
  await expect(toastWith(page, 'Mark removed.'), 'COLLAB01_MARK_CHANGES_AI_INPUTS: Undo confirms').toBeVisible();
  await expect(mark, 'COLLAB01_MARK_CHANGES_AI_INPUTS: Undo turns the switch off').toHaveAttribute('aria-checked', 'false');
  await expect(mark, 'COLLAB01_MARK_CHANGES_AI_INPUTS: focus stays on the switch').toBeFocused();

  await mark.click();
  await expect(toastWith(page, 'Note marked as changing the AI inputs.').last()).toBeVisible();
  await expect(mark).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const reloaded = noteWith(page, requestNumber, janesNote).getByRole('switch', { name: 'Changes the AI inputs' });
  await expect(reloaded, 'COLLAB01_MARK_CHANGES_AI_INPUTS: Strapi kept the mark').toHaveAttribute('aria-checked', 'true');
  await expectNoSeriousViolations(page, `Bob’s request page with a marked note at ${width}px`);
  await expectNoHorizontalOverflow(page, 'COLLAB01_MARK_CHANGES_AI_INPUTS (after the reload)');

  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(noteWith(page, requestNumber, janesNote)).toBeVisible();
  await expect(page.getByRole('switch'), 'COLLAB01_MARK_CHANGES_AI_INPUTS: the Requestor sees no switch').toHaveCount(0);
  await expect(page.getByText('Changes the AI inputs'), 'COLLAB01_MARK_CHANGES_AI_INPUTS: the Requestor sees no mark (D-26)').toHaveCount(0);
});

/*
 * D-25 in the UI (13-UI-SPEC §9.3; UI-D17, UI-D18): Jane types a note without adding it, opens My requests from the
 * navigation (no dialog stops her), comes back, and finds her text restored; once she adds it the kept text is gone.
 */
test('COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION @journey: Jane’s unsent note survives leaving the request and coming back', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const title = `Unsent note kept ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  const unsent = `Unsent for now: the vendor rotates administrator credentials every 90 days (${testInfo.project.name}).`;

  await notesSection(page).getByRole('textbox', { name: 'Add a note' }).fill(unsent);
  await openFromNavigation(page, /^My requests\b/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true }), 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION: in-app navigation is not blocked').toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname, { message: 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION: back on the request' }).toBe(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const composer = notesSection(page).getByRole('textbox', { name: 'Add a note' });
  await expect(composer, 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION: the text is restored').toHaveValue(unsent);
  await expect(notesSection(page).getByText('Restored from earlier in this session.', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, `the restored composer with its caption at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION (restored)');

  await notesSection(page).getByRole('button', { name: 'Add note', exact: true }).click();
  const added = noteWith(page, requestNumber, unsent);
  await expect(added.locator('time'), 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION: the restored text is added').toBeVisible();
  await expect(composer).toHaveValue('');
  await expect(notesSection(page).getByText('Restored from earlier in this session.', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(notesSection(page).getByRole('textbox', { name: 'Add a note' }), 'COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION: nothing is kept once added').toHaveValue('');
  await expect(notesSection(page).getByText('Restored from earlier in this session.', { exact: true })).toHaveCount(0);
  await expect(noteWith(page, requestNumber, unsent)).toHaveCount(1);
});

/*
 * D-07 and G-1 in the UI (13-UI-SPEC §8.3, §10.1): on his own request Bob is its Requestor. His composer says so and
 * offers no AI checkbox, and his note is the Requestor's. WR-305 (§8.2): his first note is then pushed outside the
 * newest 20 the page loads, and a link to it loads the earlier notes and lands on it.
 */
test('COLLAB01_REQUESTING_ANALYST_NO_MARK @journey: Bob’s note on his own request is the Requestor’s, with no AI mark', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const label = 'COLLAB01_REQUESTING_ANALYST_NO_MARK';
  const title = `Requesting analyst notes ${testInfo.project.name} ${Date.now().toString(36)}`;
  await switchTo(page, 'Security Analyst');
  const own = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Low', dueDate: null });

  await page.goto(analystPath(own.documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const notes = notesSection(page);
  await expect(
    notes.getByText('You raised this request, so your note is added as its Requestor. A note can’t be changed or removed once added.', { exact: true }),
    `${label}: the requesting-analyst hint`,
  ).toBeVisible();
  await expect(notes.getByRole('checkbox', { name: 'Changes the AI inputs' }), `${label}: no AI checkbox`).toHaveCount(0);

  const ownNote = 'Raised by me: the rollout includes the finance team’s shared mailbox.';
  const added = await addNote(page, own.requestNumber, ownNote, 'button');
  await expect(added, `${label}: the note is the Requestor’s`).toContainText('Requestor · ');
  await expect(added.getByRole('switch'), `${label}: no switch on the note`).toHaveCount(0);
  await expect(notes.getByRole('switch')).toHaveCount(0);
  await expectNoSeriousViolations(page, `Bob’s own request with his note at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, label);

  // WR-305: twenty later notes leave the first outside the newest 20 a fresh page loads.
  const firstAnchor = await added.getAttribute('id');
  expect(firstAnchor, `${label}: the note has its thread anchor`).toMatch(/^note-.+/);
  for (let index = 1; index <= 20; index += 1) {
    await addNote(page, own.requestNumber, `Follow-up ${index} of 20 on the shared mailbox (${testInfo.project.name}).`, 'shortcut');
  }
  // A fresh document, so the page loads only the newest 20 (a fragment change alone would keep this view's notes).
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await page.goto(`${analystPath(own.documentId)}#${firstAnchor}`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const first = noteWith(page, own.requestNumber, ownNote);
  await expect(first, `${label}: WR-305, the linked note outside the newest 20 is loaded`).toBeVisible();
  await expectLandedOn(page, firstAnchor!, first, `${label} (WR-305, a link to a note outside the newest 20)`);
});

/*
 * COLLAB-01 criterion 2, success criterion 3, D-13, D-24 (13-UI-SPEC §2.2): after Jane writes a note, Bob's Requests
 * row flags it with an unread line; Notes: With new notes lists the request with its chip; the unread line opens the
 * request at its notes and lands there (D1); once Bob has seen the note, the next render reads it as read and the
 * row's line is gone.
 */
test('COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE @journey: Bob sees Jane’s new note flagged on his Requests queue', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE';
  const title = `New note on queue ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  await addNote(page, requestNumber, janesNote, 'button');

  await switchTo(page, 'Security Analyst');
  await openFromNavigation(page, /^Requests\b/);
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search by number or title', exact: true });
  await search.fill(requestNumber);
  await search.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(requestNumber);

  const queueLabel = 'Assessment requests for review';
  const records = (page.viewportSize()?.width ?? 1440) < 768
    ? page.getByRole('list', { name: queueLabel }).getByRole('listitem')
    : page.getByRole('table', { name: queueLabel }).locator('tbody').getByRole('row');
  await expect(records).toHaveCount(1);
  const unread = records.first().getByRole('link', { name: `1 new note on ${requestNumber}`, exact: true });
  await expect(unread, `${label}: the row flags the new note`).toBeVisible();
  await expect(unread).toHaveText('1 new note');

  await page.getByRole('combobox', { name: 'Notes', exact: true }).selectOption('unread');
  await expect.poll(() => new URL(page.url()).searchParams.get('notes')).toBe('unread');
  await expect(page.getByText('Notes: New notes', { exact: true }), `${label}: the filter shows as a chip`).toBeVisible();
  await expect(records, `${label}: With new notes lists the request`).toHaveCount(1);
  await expectNoSeriousViolations(page, `the Requests queue with new notes at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (queue)`);
  const queueUrl = page.url();

  await records.first().getByRole('link', { name: `1 new note on ${requestNumber}`, exact: true }).click();
  await expect.poll(() => `${new URL(page.url()).pathname}${new URL(page.url()).hash}`, { message: `${label}: the line opens the notes` })
    .toBe(`${analystPath(documentId)}#notes`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expectLandedOn(page, 'notes', notesHeading(page), `${label} (D1, the queue’s line at ${page.viewportSize()?.width}px)`);
  await expect(noteWith(page, requestNumber, janesNote).getByText('New', { exact: true }), `${label}: Jane’s note is New to Bob`).toBeVisible();

  // D-24 (WR-602): once seen, the next render reads the note as read, and the queue no longer flags it.
  await expectNoneNewOnNextRender(page, requestNumber, label);
  await page.goto(queueUrl);
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await expect(records, `${label}: With new notes no longer lists the request once it is read`).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`new notes? on ${requestNumber}$`) })).toHaveCount(0);
});

/** My requests' records: table rows from 768px, cards below. */
function myRequestRecords(page: Page): Locator {
  const listLabel = 'My assessment requests';
  return (page.viewportSize()?.width ?? 1440) < 768
    ? page.getByRole('list', { name: listLabel }).getByRole('listitem')
    : page.getByRole('table', { name: listLabel }).locator('tbody').getByRole('row');
}

/** Searches My requests for one request, keeping the filters already chosen. */
async function searchMyRequests(page: Page, requestNumber: string): Promise<void> {
  const search = page.getByRole('searchbox', { name: 'Search requests', exact: true });
  await search.fill(requestNumber);
  await search.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(requestNumber);
}

/*
 * COLLAB-01 criterion 2, success criterion 4, D-24 (13-UI-SPEC §12.3, §12.4; UI-D25): after Bob replies to Jane's
 * note, Jane's Home shows the new-notes row directly under the header. It is a figure link (X-10): it opens My
 * requests filtered `Notes: New notes`, whose total equals it and which lists her request with `1 new note`; that
 * line opens the thread at #notes and lands there (D1) with Bob's reply marked New. Every earlier journey has its
 * notes read before it ends (WR-602), so the row reads exactly one request. Once Jane has seen the reply, the next
 * render reads it as read, and the row, the list and the line all clear.
 */
test('COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR @journey: Bob’s reply is flagged on Jane’s Home and My requests, and opens the thread', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width ?? 1440;
  const label = 'COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR';
  const title = `Reply flagged for Jane ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  await addNote(page, requestNumber, janesNote, 'button');

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await addNote(page, requestNumber, bobsReply, 'button');

  await switchTo(page, 'Requestor');
  await page.goto('/app');
  const needs = page.getByRole('region', { name: 'Needs your action', exact: true });
  await expect(needs).toBeVisible();
  const row = page.getByRole('main').getByRole('link', { name: /^New notes on [\d,]+ requests?$/ });
  await expect(row, `${label}: the Home flags the reply`).toHaveCount(1);
  await expect(row).toHaveAttribute('href', '/app/requests?notes=unread');
  await expect(row, `${label}: exactly the one request with a new note`).toHaveText('New notes on 1 request');
  const [rowBox, needsBox] = await Promise.all([row.boundingBox(), needs.boundingBox()]);
  expect(rowBox!.y, `${label}: the row sits above Needs your action`).toBeLessThan(needsBox!.y);
  if (width === 375) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const heading = await needs.getByRole('heading', { level: 2, name: 'Needs your action' }).boundingBox();
    expect(heading!.y, `${label}: Needs your action still starts on the first screen`).toBeLessThan(812);
  }
  await expectNoSeriousViolations(page, `Jane’s Home with new notes at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (Home)`);

  await row.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('notes'), { message: `${label}: the row opens the filtered list` }).toBe('unread');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Notes', exact: true })).toHaveValue('unread');
  await expect(page.getByText('Notes: New notes', { exact: true }), `${label}: the filter shows as a chip`).toBeVisible();
  expect(await shownListTotal(page), `${label}: the figure equals the list it opens`).toBe(1);

  await searchMyRequests(page, requestNumber);
  const records = myRequestRecords(page);
  await expect(records, `${label}: New notes lists the request`).toHaveCount(1);
  const unread = records.first().getByRole('link', { name: `1 new note on ${requestNumber}`, exact: true });
  await expect(unread, `${label}: the row flags one new note`).toBeVisible();
  await expect(unread).toHaveText('1 new note');
  await expectNoSeriousViolations(page, `Jane’s My requests with new notes at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (My requests)`);
  const listUrl = page.url();

  await unread.click();
  await expect.poll(() => `${new URL(page.url()).pathname}${new URL(page.url()).hash}`, { message: `${label}: the line opens the notes` })
    .toBe(`${requestorPath(documentId)}#notes`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expectLandedOn(page, 'notes', notesHeading(page), `${label} (D1, My requests’ line at ${width}px)`);
  const reply = noteWith(page, requestNumber, bobsReply);
  await expect(reply.getByText('Bob Doe', { exact: true })).toBeVisible();
  await expect(reply.getByText('New', { exact: true }), `${label}: Bob’s reply is New to Jane`).toBeVisible();
  await expect(summaryValue(page, 'Notes').getByRole('link', { name: '2 notes, 1 new', exact: true })).toBeVisible();

  // D-24 (WR-602): once seen, the reply is read on the next render, and every figure that counted it clears.
  await expectNoneNewOnNextRender(page, requestNumber, label);
  await expect(summaryValue(page, 'Notes').getByRole('link', { name: '2 notes', exact: true })).toBeVisible();
  await page.goto(listUrl);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  await expect(records, `${label}: New notes no longer lists the request once it is read`).toHaveCount(0);
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /^New notes on/ }), `${label}: the Home row clears once the reply is read`).toHaveCount(0);
});

/*
 * COLLAB-01 criterion 4, D-23 (T-13-48): Bob writes to Jane on her request, and the Secondary Requestor's Home shows no
 * new-notes row for it and her My requests with `Notes: New notes` lists nothing of Jane's. Jane then reads the note,
 * and the journey waits until the next render reads it as read, so no flag is left for a later journey (WR-602).
 */
test('COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG @journey: the Secondary Requestor sees no flag or count of Jane’s new notes', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width ?? 1440;
  const label = 'COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG';
  const title = `No flag for another Requestor ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await addNote(page, requestNumber, bobsReply, 'button');

  await switchTo(page, 'Secondary Requestor');
  await page.goto('/app');
  await expect(page.getByRole('region', { name: 'Needs your action', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /^New notes on/ }), `${label}: no new-notes row`).toHaveCount(0);
  await expect(page.getByRole('main').getByText(/new notes?/i)).toHaveCount(0);
  expect(await page.content(), `${label}: nothing of Jane’s request on the Home`).not.toContain(title);
  await expectNoSeriousViolations(page, `the Secondary Requestor’s Home at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (Home)`);

  await page.goto('/app/requests?notes=unread');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  await expect(page.getByText('Notes: New notes', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`new notes? on ${requestNumber}$`) })).toHaveCount(0);
  await searchMyRequests(page, requestNumber);
  await expect(
    page.getByRole('heading', { name: 'No assessment requests match these filters', exact: true }),
    `${label}: New notes lists nothing of Jane’s`,
  ).toBeVisible();
  await expect(myRequestRecords(page)).toHaveCount(0);
  const content = await page.content();
  expect(content, `${label}: no title of Jane’s in the page`).not.toContain(title);
  expect(content, `${label}: no note of Bob’s in the page`).not.toContain(bobsReply);
  await expectNoSeriousViolations(page, `the Secondary Requestor’s My requests with New notes at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (My requests)`);

  // Jane reads Bob's note, and the next render reads it as read: no flag is left for the journeys that follow.
  await switchTo(page, 'Requestor');
  await page.goto(`${requestorPath(documentId)}#notes`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(noteWith(page, requestNumber, bobsReply).getByText('New', { exact: true })).toBeVisible();
  await expectNoneNewOnNextRender(page, requestNumber, label);
});

/** The hub card titled `title` (13-UI-SPEC §10.2). */
function hubCard(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) });
}

const questionnaireSignal = 'AI inputs changed since this questionnaire was generated';

/*
 * COLLAB-01 criterion 3, D-28 and D-29 in the UI; success criterion 5 (13-UI-SPEC §10.2, §10.3, X-18; T-13-57, T-13-58):
 * Jane adds a note and Bob marks it before he generates her questionnaire, so the run includes it; Jane then adds a
 * second note and Bob marks that one too. The hub's questionnaire card and the questionnaire review page's provenance
 * header name the second note, as a link to it in the thread, with `Marked since`, and offer no action. Each link
 * lands on its note (D3): the card's on the same page, the header's from the questionnaire. The run sheet's Notes
 * group (WR-607) counts the first note, names it by part, time and length with no text, and its link closes the sheet
 * and lands on the note. Once Bob releases the questionnaire and Jane starts answering it, the hub still shows the
 * signal (WR-306). The signal is rendered on the server and served to analysts only, so Jane never sees it.
 */
test('COLLAB01_AI_INPUTS_CHANGED_SIGNAL @journey: Bob marks Jane’s note after generating her questionnaire, and the AI-inputs signal names it', async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB01_AI_INPUTS_CHANGED_SIGNAL';
  // The title never contains the signal's words, so the Requestor's page can be searched for them.
  const title = `Note marked after generation ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmits(page, title);
  await addNote(page, requestNumber, janesNote, 'button');

  // Bob marks Jane's first note, then generates: the run includes it, so it is not "marked since".
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const included = noteWith(page, requestNumber, janesNote);
  const includedAnchor = await included.getAttribute('id');
  expect(includedAnchor, `${label}: the note has its thread anchor`).toMatch(/^note-.+/);
  await included.getByRole('switch', { name: 'Changes the AI inputs' }).click();
  await expect(toastWith(page, 'Note marked as changing the AI inputs.')).toBeVisible();
  await expect(included.getByRole('switch', { name: 'Changes the AI inputs' })).toHaveAttribute('aria-checked', 'true');
  const questionnaireHref = await generateQuestionnaire(page, label);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(page.getByText(questionnaireSignal), `${label}: no signal for a note the run included`).toHaveCount(0);

  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await addNote(page, requestNumber, janesSecondNote, 'button');

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const note = noteWith(page, requestNumber, janesSecondNote);
  const noteAnchor = await note.getAttribute('id');
  expect(noteAnchor, `${label}: the second note has its thread anchor`).toMatch(/^note-.+/);
  await note.getByRole('switch', { name: 'Changes the AI inputs' }).click();
  await expect(toastWith(page, 'Note marked as changing the AI inputs.')).toBeVisible();
  await expect(note.getByRole('switch', { name: 'Changes the AI inputs' })).toHaveAttribute('aria-checked', 'true');

  // The hub renders the signal on the server: the next render of the page carries it.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const card = hubCard(page, 'Questionnaire generation');
  const cardList = card.getByRole('list', { name: questionnaireSignal });
  await expect(cardList, `${label}: the hub’s questionnaire card names the changed note`).toBeVisible();
  await expect(cardList.getByRole('listitem'), `${label}: only the note marked since the run`).toHaveCount(1);
  const cardLink = cardList.getByRole('link', { name: /^Requestor note · / });
  await expect(cardLink).toHaveAttribute('href', `${analystPath(documentId)}#${noteAnchor}`);
  await expect(cardList.getByText('Marked since', { exact: true })).toBeVisible();
  await expect(card.getByText('The AI hasn’t seen these changes.', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, `the hub with the AI-inputs signal at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (the hub)`);

  // D3 (§8.2): the card's link names a note on this page, so following it lands on the note.
  await cardLink.click();
  await expectLandedOn(page, noteAnchor!, page.locator(`[id="${noteAnchor}"]`), `${label} (D3, the hub card’s note link)`);

  await page.goto(questionnaireHref);
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
  const header = page.getByRole('region', { name: 'AI generation' });
  const headerList = header.getByRole('list', { name: questionnaireSignal });
  await expect(headerList, `${label}: the provenance header names the changed note`).toBeVisible();
  await expect(headerList.getByText('Marked since', { exact: true })).toBeVisible();
  await expect(header.getByText('The AI hasn’t seen these changes.', { exact: true })).toBeVisible();
  // D-29: the header's buttons are Phase 12's sheet trigger and, since Phase 15 (15-UI-SPEC §9.1, UI-D20), the signal's
  // Suggest follow-up questions, offered where the proposals read allows a start.
  await expect(header.getByRole('button')).toHaveCount(2);
  await expect(header.getByRole('button', { name: 'Show what the AI used', exact: true })).toHaveCount(1);
  await expect(header.getByRole('button', { name: 'Suggest follow-up questions', exact: true })).toHaveCount(1);
  await expectNoSeriousViolations(page, `Bob’s questionnaire review with the AI-inputs signal at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (the questionnaire review)`);

  // WR-607 (D-28, §10.3): the run sheet's Notes group names the note the run used, without its text.
  await header.getByRole('button', { name: 'Show what the AI used' }).click();
  const sheet = page.getByRole('dialog', { name: 'What the AI used' });
  await expect(sheet.getByRole('heading', { level: 3, name: 'Notes', exact: true }), `${label}: the sheet has its Notes group`).toBeVisible();
  await expect(sheet.getByText('1 note included', { exact: true }), `${label}: the run included the note marked before it`).toBeVisible();
  const sheetLink = sheet.getByRole('link', { name: /^Requestor note\b/ });
  await expect(sheetLink, `${label}: the included note is named by its part`).toHaveCount(1);
  await expect(sheetLink).toHaveAttribute('href', `${analystPath(documentId)}#${includedAnchor}`);
  const sheetRow = sheet.getByRole('listitem').filter({ has: page.getByRole('link', { name: /^Requestor note\b/ }) });
  await expect(sheetRow, `${label}: the row gives the note’s part, time and length`).toContainText(`· ${janesNote.length} characters`);
  await expect(sheetRow.locator('time')).toBeVisible();
  await expect(sheet, `${label}: the sheet holds no note text (G-3, T-13-58)`).not.toContainText(janesNote);
  await expect(sheet).not.toContainText(janesSecondNote);
  await expectNoSeriousViolations(page, `the run sheet with its Notes group at ${width}px`);
  await sheetLink.click();
  await expect(sheet, `${label}: the sheet closes, then the link navigates`).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expectLandedOn(page, includedAnchor!, page.locator(`[id="${includedAnchor}"]`), `${label} (D3, the run sheet’s note link)`);

  // D3 (§8.2): the header's link opens the request's thread at the note marked since, and lands on it.
  await page.goto(questionnaireHref);
  await headerList.getByRole('link', { name: /^Requestor note · / }).click();
  await expect.poll(() => { const url = new URL(page.url()); return `${url.pathname}${url.hash}`; }, { message: `${label}: the link opens the note in the request’s thread` })
    .toBe(`${analystPath(documentId)}#${noteAnchor}`);
  await expectLandedOn(page, noteAnchor!, page.locator(`[id="${noteAnchor}"]`), `${label} (D3, the provenance header’s note link)`);

  // WR-306: Bob releases the questionnaire and Jane starts answering it; the hub keeps the signal, offering nothing.
  await page.goto(questionnaireHref);
  await page.getByRole('region', { name: 'Questionnaire governance' }).getByRole('button', { name: 'Release questionnaire' }).click();
  const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
  await release.getByRole('button', { name: 'Release questionnaire' }).click();
  await expect(release).toBeHidden();
  await expect(page.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();

  await switchTo(page, 'Requestor');
  await page.goto(questionnaireHref.replace('/app/review/questionnaires/', '/app/questionnaires/'));
  const completion = page.getByRole('region', { name: 'Questionnaire completion' });
  await page.getByRole('textbox', { name: /^What security outcomes matter most/ }).fill('Payment files must not be altered before the bank receives them.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(completion.getByRole('status')).toContainText('Saved at');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const answering = hubCard(page, 'Questionnaire generation');
  await expect(answering.getByRole('list', { name: questionnaireSignal }), `${label}: WR-306, the hub keeps the signal while Jane answers`).toBeVisible();
  await expect(answering.getByRole('list', { name: questionnaireSignal }).getByRole('link', { name: /^Requestor note · / })).toHaveAttribute('href', `${analystPath(documentId)}#${noteAnchor}`);
  await expect(answering.getByRole('button'), `${label}: WR-306, the signal card offers no action`).toHaveCount(0);
  await expectNoHorizontalOverflow(page, `${label} (the hub while Jane answers)`);

  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(noteWith(page, requestNumber, janesNote)).toBeVisible();
  await expect(page.getByText(/AI inputs changed since this|seen these changes|Marked since/), `${label}: the Requestor never sees the signal (T-13-57)`).toHaveCount(0);
});
