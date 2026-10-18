import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { expectFocusIndicatorUnclipped } from './helpers/focus';
import { navigationText, openFromNavigation } from './helpers/navigation';
import {
  addNote,
  analystPath,
  expectLandedOn,
  expectNoHorizontalOverflow,
  expectNoneNewOnNextRender,
  expectNoSeriousViolations,
  expectStrapiHealthy,
  generateQuestionnaire,
  noteWith,
  requestorPath,
  shownListTotal,
  shownListTotalOrEmpty,
  softly,
  summaryValue,
  switchTo,
  toastWith,
} from './helpers/request-collaboration';
import { createSubmittedRequest } from './helpers/requests';

/*
 * Phase 13 (REQ-08): picking up a request and the notes on it. Later plans extend this spec. Every test meant to run
 * at 375 carries `@journey` in its title: the mobile project lists this spec in its `testMatch` and runs only the
 * tests its `grep: /@journey/` matches. A desktop-only test leaves the tag off.
 */

/** The job-read refusal notice the questionnaire card shows when the request's jobs read failed (UI-SPEC §12.5). */
const jobsReadFailedNotice = 'We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.';

/*
 * REQ-08 criterion 3, D-18, D-25, UI-SPEC §13 (UAT-014's job-visibility half, UAT-041): a colleague opens a request on
 * which Bob generated the questionnaire. WR-601 (the pilot's ruling): the deterministic job finishes within a second, a
 * completed job is never seeded, and the E2E UI-state harness renders list fixtures only, so nothing can hold a job
 * running or failed for a second analyst without new product configuration. `Started by Bob Doe.` on a running or
 * failed card, and a colleague's retry, are therefore proven by the cards' component tests and Strapi's integration
 * tests, not here. This journey waits for Bob's job to finish, so its outcome is fixed, and proves what the browser
 * can: the colleague reads the request, the request's jobs read serves them (no "couldn't check" notice, and Replace
 * offered under the served policy rather than a second Generate), the hub links the generated questionnaire, and its
 * review page opens for them. No check accepts "either outcome".
 */
test('REQ08_COLLEAGUE_FOLLOWS_JOB @journey: a colleague opens a request Bob generated on and reads its jobs and questionnaire', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_COLLEAGUE_FOLLOWS_JOB';
  const title = `Colleague follows job ${testInfo.project.name} ${Date.now().toString(36)}`;

  await switchTo(page, 'Requestor');
  const submitted = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(submitted.documentId));
  await expect(page.getByRole('heading', { name: title, exact: true }), `${label}: Bob opens the request`).toBeVisible();
  const questionnaireHref = await generateQuestionnaire(page, `${label}: Bob’s job finishes`);

  await switchTo(page, 'Second Security Analyst');
  await page.goto(analystPath(submitted.documentId));
  await expect(page.getByRole('heading', { name: title, exact: true }), `${label}: the colleague reads the request, not a permission or not-found state`).toBeVisible();
  const hubQuestionnaireLink = page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ });
  await expect(hubQuestionnaireLink, `${label}: the hub links the questionnaire Bob generated`).toHaveAttribute('href', questionnaireHref);
  // D-25: the request's jobs read serves the colleague, so the card offers Replace under the served AI policy.
  await expect(page.getByText(jobsReadFailedNotice, { exact: true }), `${label}: the request’s jobs read served the colleague`).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replace questionnaire' }), `${label}: the colleague is offered Replace, not a second Generate`).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Generate questionnaire' })).toHaveCount(0);
  // The colleague is never told they may not see the job, and never shown the retired Phase 10 sentences (UI-SPEC §13).
  await expect(page.getByText('Status unavailable', { exact: true }), `${label}: no refused status check`).toHaveCount(0);
  await expect(page.getByText('Started by another Security Analyst.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Only the Security Analyst who started it can retry it.', { exact: true })).toHaveCount(0);
  await expectNoSeriousViolations(page, `the colleague’s request page at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, label);

  await hubQuestionnaireLink.click();
  await expect(page, `${label}: the colleague opens the generated questionnaire`).toHaveURL(new RegExp(`${questionnaireHref}$`));
  await expect(page.getByRole('region', { name: 'Questionnaire governance' }), `${label}: its review page, not a refusal`).toBeVisible();
});

function assignmentSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Assignment' });
}

/** Jane submits a request through the UI and Bob opens its analyst page, which reads `Not picked up`. */
async function janeSubmitsAndBobOpens(page: Page, title: string): Promise<{ requestNumber: string; documentId: string }> {
  await switchTo(page, 'Requestor');
  const submitted = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(submitted.documentId));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(assignmentSection(page).getByText('Not picked up', { exact: true })).toBeVisible();
  return submitted;
}

/** WR-605 (13-UI-SPEC §7.1, X-14): Alt+T moves focus to the notifications, and Tab reaches the toast's action. */
async function reachToastActionByKeyboard(page: Page, toast: Locator, name: string): Promise<Locator> {
  const action = toast.getByRole('button', { name, exact: true });
  await expect(action).toBeVisible();
  await page.keyboard.press('Alt+T');
  for (let step = 0; step < 8 && !(await action.evaluate((element) => element === document.activeElement)); step += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(action, `Alt+T, then Tab, reaches the toast’s ${name}`).toBeFocused();
  return action;
}

/*
 * REQ-08 criterion 1, D-05, D-16, D-17 (13-UI-SPEC §5, §7): Bob picks Jane's request up from its page with one click,
 * the toast's Undo returns it to the queue, and he picks it up again; the hub names both people, and Jane's own page
 * names the Security Analyst who holds it. WR-301 (§7.2, G-4): the first click's call never reaches the server, so the
 * pick-up rolls back in place with family K's danger toast, the page stays, and its Try again picks the request up.
 * WR-605: the pick-up's Undo is reached with the keyboard (Alt+T, Tab, Enter), and focus returns to the status line.
 */
test('REQ08_PICK_UP_FROM_REQUEST_PAGE @journey: Bob picks up Jane’s request from its page, undoes it and picks it up again', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_PICK_UP_FROM_REQUEST_PAGE';
  const title = `Pick up from page ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmitsAndBobOpens(page, title);
  const section = assignmentSection(page);
  await expect(section.getByText('Any Security Analyst who didn’t raise this request can pick it up.', { exact: true })).toBeVisible();
  const pickUp = section.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true });

  // WR-301: the Server Action's request is aborted in the browser, as a dropped connection would.
  const requestPathname = new URL(page.url()).pathname;
  const isThisPage = (url: URL) => url.pathname === requestPathname;
  let aborted = 0;
  const abortTheFirstAction = async (route: Route) => {
    const sent = route.request();
    if (aborted === 0 && sent.method() === 'POST' && sent.headers()['next-action'] !== undefined) {
      aborted += 1;
      await route.abort('failed');
      return;
    }
    await route.fallback();
  };
  const refused = toastWith(page, 'We couldn’t change the assignment. Try again.');
  await page.route(isThisPage, abortTheFirstAction);
  try {
    await pickUp.click();
    await expect(refused, `${label}: WR-301, a failed call shows family K’s danger toast`).toBeVisible();
  } finally {
    await page.unroute(isThisPage, abortTheFirstAction);
  }
  expect(aborted, `${label}: WR-301, the pick-up’s call was the one aborted`).toBe(1);
  await expect(refused).toHaveAttribute('data-type', 'error');
  await expect(refused).toContainText('Request not picked up');
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true }), `${label}: WR-301, the page stays, never the error page`).toBeVisible();
  await expect(section.getByText('Not picked up', { exact: true }), `${label}: WR-301, the pick-up rolled back in place`).toBeVisible();
  await expect(pickUp).toBeVisible();
  await refused.getByRole('button', { name: 'Try again', exact: true }).click();

  await expect(section.getByText('Assigned to Bob Doe', { exact: true }), `${label}: Try again picks it up; the status names Bob`).toBeVisible();
  await expect(section.getByText(/^Picked up \d/), `${label}: the caption says when`).toBeVisible();
  const pickedUp = toastWith(page, `You picked up ${requestNumber}.`);
  await expect(pickedUp).toBeVisible();
  await expectNoHorizontalOverflow(page, `${label} (picked up, toast showing)`);

  const undo = await reachToastActionByKeyboard(page, pickedUp, 'Undo');
  await undo.press('Enter');
  await expect(toastWith(page, `Pick-up undone. ${requestNumber} is back in the queue.`)).toBeVisible();
  const status = section.getByText('Not picked up', { exact: true });
  await expect(status, `${label}: Undo returns it to the queue`).toBeVisible();
  await softly(status, `${label}: WR-605, focus returns to the status line after Undo (§7.3)`).toBeFocused();

  await pickUp.click();
  await expect(section.getByText('Assigned to Bob Doe', { exact: true })).toBeVisible();
  await expect(section.getByRole('button', { name: `Reassign ${requestNumber}`, exact: true })).toBeVisible();
  await expect(summaryValue(page, 'Requestor'), `${label}: the hub names the Requestor`).toHaveText('Jane Doe');
  await expect(summaryValue(page, 'Assigned to'), `${label}: the hub names who holds it`).toHaveText('Bob Doe');
  await expect(summaryValue(page, 'Owner'), `${label}: IN-605, the hub has no Owner row`).toHaveCount(0);
  await expectNoSeriousViolations(page, `Bob’s request page at ${page.viewportSize()?.width}px`);

  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(summaryValue(page, 'Requestor')).toHaveText('Jane Doe');
  await expect(summaryValue(page, 'Security Analyst'), `${label}: Jane reads who holds her request`).toHaveText('Bob Doe');
  await expect(page.getByRole('region', { name: 'Assignment' }), `${label}: the Requestor has no assignment control`).toHaveCount(0);
  await expectNoSeriousViolations(page, `Jane’s request page at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (Jane’s page)`);
});

/*
 * REQ-08, D-06, D-09, D-16 (13-UI-SPEC §5.3, §6, §7.3, §15): on a request Bob holds, Reassign opens the picker (a
 * popover at 1440, the full-screen sheet at 375). The whole journey is driven by the keyboard (WR-605): Enter on Pick
 * up, focus on Reassign starts loading the picker's code, which is held so the pressed trigger is seen busy rather
 * than expanded (IN-306); the picker opens with focus in its search, whose ring is painted whole (D4). Its unfiltered
 * list offers Sam Analyst and never the holder, the request's Requestor, a Requestor-only person or the agent
 * (WR-604). Bob types, chooses with the arrows and Enter, tabs to the reason and assigns with Ctrl+Enter; focus moves to
 * the status line, which names Sam, and the history names both of them, newest first, with the reason quoted.
 */
test('REQ08_REASSIGN_THROUGH_PICKER @journey: Bob hands a request he holds to Sam Analyst with a reason', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_REASSIGN_THROUGH_PICKER';
  const title = `Reassign through picker ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber } = await janeSubmitsAndBobOpens(page, title);
  const section = assignmentSection(page);
  const pickUp = section.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true });
  await pickUp.focus();
  await pickUp.press('Enter');
  const holding = section.getByText('Assigned to Bob Doe', { exact: true });
  await expect(holding, `${label}: Enter on Pick up picks it up`).toBeVisible();
  await softly(holding, `${label}: focus moves to the status line after the pick-up (§7.3)`).toBeFocused();

  const trigger = section.getByRole('button', { name: `Reassign ${requestNumber}`, exact: true });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  // IN-306: every script requested from here on is held until the trigger has been seen busy.
  let releaseScripts: () => void = () => undefined;
  const scriptsReleased = new Promise<void>((resolve) => { releaseScripts = resolve; });
  let heldScripts = 0;
  const holdScripts = async (route: Route) => {
    heldScripts += 1;
    await scriptsReleased;
    await route.fallback();
  };
  const scripts = '**/_next/static/**/*.js';
  await page.route(scripts, holdScripts);
  try {
    await trigger.focus();
    await trigger.press('Enter');
    await softly(trigger, `${label}: IN-306, the pressed trigger is busy while the picker’s code loads`).toHaveAttribute('aria-busy', 'true');
    await softly(trigger, `${label}: IN-306, and not expanded while nothing is shown`).toHaveAttribute('aria-expanded', 'false');
    softly(heldScripts, `${label}: IN-306, focus on the trigger requested the picker’s code`).toBeGreaterThan(0);
  } finally {
    releaseScripts();
    await page.unroute(scripts, holdScripts);
  }

  const picker = page.getByRole('dialog', { name: `Reassign ${requestNumber}` });
  await expect(picker, `${label}: the picker opens once its code is there`).toBeVisible();
  const phone = page.viewportSize()?.width === 375;
  await expect(picker.getByRole('button', { name: 'Close assign' }), `${label}: the sheet’s Close only at 375`).toHaveCount(phone ? 1 : 0);
  const search = picker.getByRole('combobox', { name: 'Search Security Analysts' });
  await expect(search).toBeFocused();
  await expectFocusIndicatorUnclipped(picker, `${label}: D4, the picker’s search at ${page.viewportSize()?.width}px`);

  // WR-604: the unfiltered list, before anything is typed.
  const sam = picker.getByRole('option', { name: 'Sam Analyst', exact: true });
  await expect(sam, `${label}: the unfiltered list offers Sam Analyst`).toBeVisible();
  await softly(picker.getByRole('option', { name: 'Bob Doe', exact: true }), `${label}: WR-604, the holder is not offered (§6)`).toHaveCount(0);
  await softly(picker.getByRole('option', { name: 'Jane Doe', exact: true }), `${label}: WR-604, the request’s Requestor is never offered`).toHaveCount(0);
  await softly(picker.getByRole('option', { name: 'Maya Requestor', exact: true }), `${label}: WR-604, a Requestor-only person is never offered`).toHaveCount(0);
  await softly(picker.getByRole('option', { name: /Agent/ }), `${label}: WR-604, the agent is never offered`).toHaveCount(0);

  /*
   * The unfiltered list already shows Sam alone, so the search is awaited by its own call (debounced, then a Server Action
   * carrying the term), and then the list's loading fade, before anything is chosen or scanned.
   */
  const searched = page.waitForResponse((response) => {
    const sent = response.request();
    return sent.method() === 'POST' && sent.headers()['next-action'] !== undefined && (sent.postData() ?? '').includes('"Sam"');
  });
  await search.pressSequentially('Sam');
  await searched;
  const list = picker.locator('[data-slot="command-list"]');
  await expect(list).not.toHaveAttribute('aria-busy', 'true');
  await expect(list).toHaveCSS('opacity', '1');
  await expect(picker.getByRole('option'), `${label}: the search finds only Sam`).toHaveText(['Sam Analyst']);
  await search.press('ArrowDown');
  await search.press('Enter');
  const assign = picker.getByRole('button', { name: 'Assign to Sam Analyst' });
  await expect(assign, `${label}: the arrows and Enter choose Sam`).toBeVisible();
  await page.keyboard.press('Tab');
  const reason = picker.getByRole('textbox', { name: 'Reason (optional)' });
  await expect(reason, `${label}: Tab reaches the reason`).toBeFocused();
  await page.keyboard.type('Sam covers this system.');
  await expectNoSeriousViolations(page, `the picker open at ${page.viewportSize()?.width}px`);
  await reason.press('Control+Enter');

  await expect(picker).toHaveCount(0);
  const handed = section.getByText('Assigned to Sam Analyst', { exact: true });
  await expect(handed, `${label}: the status names Sam`).toBeVisible();
  await softly(handed, `${label}: WR-605, focus moves to the status line after the picker assigns (§7.3)`).toBeFocused();
  await expect(section.getByText(/^Assigned by Bob Doe · \d/), `${label}: the caption names who assigned and when`).toBeVisible();
  await expect(toastWith(page, `${requestNumber} reassigned to Sam Analyst.`)).toBeVisible();
  await expect(summaryValue(page, 'Assigned to')).toHaveText('Sam Analyst');

  await section.getByRole('button', { name: 'Show assignment history (2)' }).click();
  const history = section.getByRole('list', { name: 'Assignment history' });
  const newest = history.getByRole('listitem').first();
  await expect(newest).toContainText('Reassigned from Bob Doe to Sam Analyst by Bob Doe');
  await expect(newest).toContainText('Reason: “Sam covers this system.”');
  await expect(history.getByRole('listitem').nth(1)).toContainText('Picked up by Bob Doe');
  await expectNoSeriousViolations(page, `the expanded assignment history at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (history open)`);
});

/** The Requests queue's records at this width: table rows from 768px, cards below (13-UI-SPEC §2.2). */
function queueRecords(page: Page): Locator {
  const queueLabel = 'Assessment requests for review';
  return (page.viewportSize()?.width ?? 1440) < 768
    ? page.getByRole('list', { name: queueLabel }).getByRole('listitem')
    : page.getByRole('table', { name: queueLabel }).locator('tbody').getByRole('row');
}

/** Narrows the open Requests queue to one request by its number, as the search box does. */
async function searchQueue(page: Page, requestNumber: string): Promise<void> {
  const search = page.getByRole('searchbox', { name: 'Search by number or title', exact: true });
  await search.fill(requestNumber);
  await search.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(requestNumber);
}

/*
 * D-07, G-1 (13-UI-SPEC §2.2, §2.3, §5.2): on a request Bob raised himself, his analyst page says why there is no
 * control and offers none, and his Requests row reads `You raised it` with no Pick up (IN-605). Strapi refusing the
 * change itself is 13-03's mounted proof (OWN_REQUEST); this is the page's half (T-13-31).
 */
test('REQ08_OWN_REQUEST_NO_PICK_UP @journey: Bob’s own request offers him no assignment control', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_OWN_REQUEST_NO_PICK_UP';
  const title = `Own request no pick up ${testInfo.project.name} ${Date.now().toString(36)}`;
  await switchTo(page, 'Security Analyst');
  const own = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Low', dueDate: null });

  await page.goto(analystPath(own.documentId));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const section = assignmentSection(page);
  await expect(section.getByText('You raised this request, so another Security Analyst picks it up.', { exact: true })).toBeVisible();
  await expect(section.getByText('Not picked up', { exact: true })).toBeVisible();
  for (const name of [/^Pick up /, /^Assign /, /^Reassign /, /^Return /]) {
    await expect(section.getByRole('button', { name }), `${label}: no ${name.source} control`).toHaveCount(0);
  }
  await expectNoSeriousViolations(page, `the requesting analyst’s own request page at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, label);

  await page.goto('/app/review/requests');
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await searchQueue(page, own.requestNumber);
  const records = queueRecords(page);
  await expect(records, `${label}: the queue lists Bob’s own request`).toHaveCount(1);
  await expect(records.first().getByText('You raised it', { exact: true }), `${label}: IN-605, the row says Bob raised it`).toBeVisible();
  await expect(records.first().getByRole('button', { name: /^Pick up / }), `${label}: IN-605, and offers no Pick up`).toHaveCount(0);
});

/*
 * REQ-08 criterion 1, D-13, D-16 (13-UI-SPEC §2.2, §7): Jane submits a request; Bob opens Requests, narrows it to the
 * requests nobody has picked up, and picks Jane's up from its row with the keyboard (a card with a full-width Pick up
 * at 375). The toast offers Undo; the request leaves the Not picked up view, and focus moves to the list's empty-state
 * heading rather than the page body (D2, §7.3). The request is listed under Assigned to: Me with Bob's name.
 */
test('REQ08_PICK_UP_FROM_QUEUE_ROW @journey: Bob picks up Jane’s request from its Requests row', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_PICK_UP_FROM_QUEUE_ROW';
  const phone = page.viewportSize()?.width === 375;
  const title = `Pick up from queue ${testInfo.project.name} ${Date.now().toString(36)}`;
  await switchTo(page, 'Requestor');
  const { requestNumber } = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });

  await switchTo(page, 'Security Analyst');
  await page.goto('/app/review/requests');
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  // The page header is read in <main>: until React reveals the streamed list, its hidden copy sits outside it (19-15 gate).
  await expect(page.getByRole('main').getByText('Submitted requests across the team. Pick up a request to make it yours.', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Queue:/)).toHaveText('Queue: Requires attention');
  await page.getByRole('combobox', { name: 'Assigned to', exact: true }).selectOption('unassigned');
  await expect.poll(() => new URL(page.url()).searchParams.get('assignee')).toBe('unassigned');
  await expect(page.getByText('Assigned to: Not picked up', { exact: true }), `${label}: the filter shows as a chip`).toBeVisible();
  await searchQueue(page, requestNumber);
  await expect.poll(() => new URL(page.url()).searchParams.get('assignee'), { message: 'the search keeps the filter' }).toBe('unassigned');

  const records = queueRecords(page);
  await expect(records, `${label}: the request waits for pick-up`).toHaveCount(1);
  const record = records.first();
  const pickUp = record.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true });
  await expect(pickUp).toBeVisible();
  if (phone) {
    // 13-UI-SPEC §2.2: on a card, Pick up is the last element, at full width and the touch-target height.
    const [button, card] = await Promise.all([pickUp.boundingBox(), record.boundingBox()]);
    expect(Boolean(button && card && button.width >= card.width * 0.8), `${label}: Pick up is full width on the card`).toBe(true);
    expect(Boolean(button && button.height >= 44), `${label}: Pick up meets the touch height`).toBe(true);
    await expect(record.getByText('Not picked up', { exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole('columnheader', { name: 'Assigned to' })).toBeVisible();
  }
  await expectNoSeriousViolations(page, `the Requests queue with the Assigned to column at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (queue)`);

  await pickUp.focus();
  await pickUp.press('Enter');
  const pickedUp = toastWith(page, `You picked up ${requestNumber}.`);
  await expect(pickedUp, `${label}: the toast confirms the pick-up`).toBeVisible();
  await expect(pickedUp.getByRole('button', { name: 'Undo' }), `${label}: the toast offers Undo`).toBeVisible();
  // The queue is read again: the request has left the Not picked up view.
  await expect(records, `${label}: a picked-up request is no longer waiting`).toHaveCount(0);
  const empty = page.getByRole('main').getByRole('heading', { name: 'No assessment requests match these filters', exact: true });
  await expect(empty, `${label}: the filtered queue shows its empty state`).toBeVisible();
  await softly(empty, `${label}: D2, focus moves to the empty state, not the page body (§7.3)`).toBeFocused();

  await page.getByRole('combobox', { name: 'Assigned to', exact: true }).selectOption('me');
  await expect.poll(() => new URL(page.url()).searchParams.get('assignee')).toBe('me');
  await expect(page.getByText('Assigned to: Me', { exact: true })).toBeVisible();
  await expect(records, `${label}: Assigned to: Me lists it`).toHaveCount(1);
  await expect(records.first().getByRole('link', { name: requestNumber, exact: true })).toBeVisible();
  await expect(
    records.first().getByText(phone ? 'Assigned to Bob Doe' : 'Bob Doe', { exact: true }),
    `${label}: the row names Bob`,
  ).toBeVisible();
  await expect(records.first().getByRole('button', { name: /^Pick up / })).toHaveCount(0);
  await expectNoSeriousViolations(page, `the Requests queue under Assigned to: Me at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (Assigned to: Me)`);
});

/** Bob picks up Jane's newly submitted request and hands it to Sam Analyst through the picker, at either width. */
async function bobHandsJanesRequestToSam(page: Page, title: string): Promise<{ requestNumber: string; documentId: string }> {
  const submitted = await janeSubmitsAndBobOpens(page, title);
  const section = assignmentSection(page);
  await section.getByRole('button', { name: `Pick up ${submitted.requestNumber}`, exact: true }).click();
  await expect(section.getByText('Assigned to Bob Doe', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: `Reassign ${submitted.requestNumber}`, exact: true }).click();
  const picker = page.getByRole('dialog', { name: `Reassign ${submitted.requestNumber}` });
  await picker.getByRole('combobox', { name: 'Search Security Analysts' }).fill('Sam');
  await picker.getByRole('option', { name: 'Sam Analyst', exact: true }).click();
  await picker.getByRole('button', { name: 'Assign to Sam Analyst' }).click();
  await expect(picker).toHaveCount(0);
  await expect(section.getByText('Assigned to Sam Analyst', { exact: true })).toBeVisible();
  return submitted;
}

/*
 * REQ-08 criterion 2, D-14 (13-UI-SPEC §1, §2.1): Bob picks up Jane's request and hands it to Sam Analyst. Signed in
 * as the Second Security Analyst, Sam opens Assigned to me from the sidebar (from the drawer at 375): the page is
 * headed with its label, opens on All open and lists the request, without an Assigned to column or filter. Bob's own
 * Assigned to me does not list it. The newest request sorts first, so it is on the first page when listed.
 */
test('REQ08_ASSIGNED_TO_ME_VIEW @journey: the Second Security Analyst finds the request handed to them in Assigned to me', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const title = `Assigned to me ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber } = await bobHandsJanesRequestToSam(page, title);

  await switchTo(page, 'Second Security Analyst');
  await openFromNavigation(page, navigationText('Assigned to me'));
  await expect.poll(() => new URL(page.url()).pathname, { message: 'REQ08_ASSIGNED_TO_ME_VIEW: the navigation opens the view' }).toBe('/app/review/assigned');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Assigned to me | IdamBox CSRM');
  // The page header is read in <main>: until React reveals the streamed list, its hidden copy sits outside it (19-15 gate).
  await expect(page.getByRole('main').getByText('Requests you’re accountable for, and what each needs next.', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Queue:/), 'REQ08_ASSIGNED_TO_ME_VIEW: the view opens on All open').toHaveText('Queue: All open');
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('open');
  await expect(page.getByRole('combobox', { name: 'Assigned to', exact: true }), 'REQ08_ASSIGNED_TO_ME_VIEW: no Assigned to filter').toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Notes', exact: true })).toBeVisible();

  const records = queueRecords(page);
  const listed = records.filter({ has: page.getByRole('link', { name: requestNumber, exact: true }) });
  await expect(listed, 'REQ08_ASSIGNED_TO_ME_VIEW: Sam’s Assigned to me lists the request').toHaveCount(1);
  if (page.viewportSize()?.width !== 375) {
    await expect(page.getByRole('columnheader', { name: 'Assigned to' }), 'REQ08_ASSIGNED_TO_ME_VIEW: no Assigned to column').toHaveCount(0);
  }
  await expect(listed.getByRole('button', { name: /^Pick up / })).toHaveCount(0);
  await expectNoSeriousViolations(page, `Assigned to me at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, 'REQ08_ASSIGNED_TO_ME_VIEW (Sam’s view)');

  await switchTo(page, 'Security Analyst');
  await page.goto('/app/review/assigned');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
  await expect(page.getByText(/^Queue:/)).toHaveText('Queue: All open');
  await expect(
    page.getByRole('main').getByRole('link', { name: requestNumber, exact: true }),
    'REQ08_ASSIGNED_TO_ME_VIEW: Bob no longer holds it, so his Assigned to me does not list it',
  ).toHaveCount(0);
});

/*
 * REQ-08 criterion 1 "everywhere it appears", D-13 (13-UI-SPEC §4): Bob's quick find for the request's number shows
 * who holds it on the option's second line, from the queue projection. The search field's ring is painted whole (D4),
 * and the open dialog with the assignee line passes axe (WR-606).
 */
test('REQ08_QUICK_FIND_NAMES_ASSIGNEE @journey: Bob’s quick find names Sam Analyst as the holder', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_QUICK_FIND_NAMES_ASSIGNEE';
  const title = `Quick find holder ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber } = await bobHandsJanesRequestToSam(page, title);

  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  // Quick find is modal once open, so its control is read with hidden elements included (quick-find.spec.ts).
  const control = page.getByRole('banner', { includeHidden: true }).getByRole('button', { name: /^Search\b/, includeHidden: true });
  await expect(async () => {
    if ((await control.getAttribute('aria-expanded')) !== 'true') await control.click();
    await expect(control).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
  }).toPass();
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const field = dialog.getByRole('combobox', { name: 'Search by number or title' });
  await field.pressSequentially(requestNumber);
  const option = dialog.getByRole('group', { name: /^Requests\b/ }).getByRole('option', { name: `${requestNumber} · ${title}` });
  await expect(option, `${label}: the request is found`).toBeVisible();
  await expect(option.getByText('Submitted · Assigned to Sam Analyst', { exact: true }), `${label}: line 2 names Sam`).toBeVisible();
  await expect(field).toBeFocused();
  await expectFocusIndicatorUnclipped(dialog, `${label}: D4, quick find’s search at ${page.viewportSize()?.width}px`);
  await expectNoSeriousViolations(page, `quick find with the assignee line at ${page.viewportSize()?.width}px`);
  await expectNoHorizontalOverflow(page, `${label} (quick find open)`);
});

/** A KPI tile's display figure. */
async function tileFigure(tile: Locator): Promise<number> {
  const text = await tile.locator('[data-slot="kpi-tile-value"]').textContent();
  const value = Number.parseInt((text ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the tile shows a whole number, not "${text}"`).toBe(true);
  return value;
}

/** The figure a Review queue row names: "{label}: {n} {record noun}". */
async function rowFigure(row: Locator): Promise<number> {
  const name = (await row.getAttribute('aria-label')) ?? '';
  const value = Number.parseInt((/: ([\d,]+) /.exec(name)?.[1] ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the queue row names a whole number, not "${name}"`).toBe(true);
  return value;
}

/*
 * REQ-08 criterion 2, D-15 (13-UI-SPEC §3; X-10): Bob's Home leads with the work he holds. Bob picks up Jane's new
 * request and Jane adds a note to it; tile 1, `Needs your action`, and the `Assigned to you` group's `Needs your
 * action` row both equal the total of Assigned to me under Requires attention, which lists the request. Every row of
 * the `Assigned to you` group opens a list whose total equals its figure (WR-603), `With new notes` among them with
 * Jane's note counted; the team's `Waiting for pick-up` equals the Requests list of requests nobody holds. At 375 the
 * Review queue still begins on the first 812px screen. Axe is clean on the Home at each width.
 */
test('REQ08_HOME_COUNTS_ASSIGNED_WORK @journey: Bob’s Home counts the requests he holds, and each figure opens an equal list', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  const label = 'REQ08_HOME_COUNTS_ASSIGNED_WORK';
  const title = `Home assigned work ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmitsAndBobOpens(page, title);
  const section = assignmentSection(page);
  await section.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true }).click();
  await expect(section.getByText('Assigned to Bob Doe', { exact: true }), `${label}: Bob holds the request`).toBeVisible();

  // Jane writes to Bob, so the request he holds has a note new to him.
  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await addNote(page, requestNumber, 'Our vendor shortlist is attached to the procurement ticket.', 'button');
  await switchTo(page, 'Security Analyst');

  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
  const tile = needsAction.getByRole('link', { name: /^Needs your action [\d,]+ Requests assigned to you that need analyst action$/ });
  await expect(tile, `${label}: tile 1 is the viewer’s own work`).toHaveCount(1);
  await expect(tile).toHaveAttribute('href', '/app/review/assigned?queue=requires-attention');
  const reviewQueue = page.getByRole('region', { name: 'Review queue', exact: true });
  await expect(reviewQueue.getByText('Your assigned requests first, then the team’s queue.', { exact: true })).toBeVisible();
  await expect(reviewQueue.getByRole('heading', { level: 3 }).first()).toHaveText('Assigned to you');
  await expect(reviewQueue.getByRole('link'), `${label}: the widget’s eleven rows`).toHaveCount(11);
  const mineRow = reviewQueue.getByRole('link', { name: /^Needs your action: [\d,]+ Assessment Requests?$/ });
  const pickUpRow = reviewQueue.getByRole('link', { name: /^Waiting for pick-up: [\d,]+ Assessment Requests?$/ });
  await expect(mineRow).toHaveAttribute('href', '/app/review/assigned?queue=requires-attention');
  await expect(pickUpRow).toHaveAttribute('href', '/app/review/requests?assignee=unassigned');
  await expect(page.getByRole('main').getByText(/my attention/i)).toHaveCount(0);

  const tileValue = await tileFigure(tile);
  expect(tileValue, `${label}: Bob’s new request needs him`).toBeGreaterThanOrEqual(1);
  expect(await rowFigure(mineRow), `${label}: the tile and the Assigned to you row are one figure`).toBe(tileValue);
  const waiting = await rowFigure(pickUpRow);

  // WR-603: every row of the Assigned to you group, read before any list is opened.
  const assignedRows = reviewQueue.getByRole('list', { name: 'Assigned to you', exact: true }).getByRole('link');
  await expect(assignedRows, `${label}: the Assigned to you group’s four rows`).toHaveCount(4);
  const rows: { name: string; href: string; figure: number }[] = [];
  for (const row of await assignedRows.all()) {
    rows.push({ name: (await row.getAttribute('aria-label')) ?? '', href: (await row.getAttribute('href')) ?? '', figure: await rowFigure(row) });
  }
  const withNewNotes = rows.find(({ name }) => name.startsWith('With new notes:'));
  expect(withNewNotes, `${label}: the group has its With new notes row`).toBeDefined();
  expect(withNewNotes!.figure, `${label}: Jane’s note is new to Bob on a request he holds`).toBeGreaterThanOrEqual(1);

  // At 375 the grown widget still begins within the first screen, and nothing on Home overflows.
  if (page.viewportSize()?.width === 375) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await reviewQueue.boundingBox();
    expect(box, 'the Review queue has a box').not.toBeNull();
    expect(box!.y, `${label}: the Review queue begins within the first 812px`).toBeLessThan(812);
  }
  await expectNoHorizontalOverflow(page, `${label} (Home)`);
  await expectNoSeriousViolations(page, `Bob’s Home at ${page.viewportSize()?.width}px`);

  await tile.click();
  await expect(page).toHaveURL(/\/app\/review\/assigned\?queue=requires-attention$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  expect(await shownListTotal(page), `${label}: Needs your action equals Assigned to me under Requires attention`).toBe(tileValue);
  await expect(
    page.getByRole('main').getByRole('link', { name: requestNumber, exact: true }),
    `${label}: the request Bob picked up is in the list the figure opens`,
  ).toHaveCount(1);

  for (const row of rows) {
    expect(row.href, `${label}: ${row.name} opens Assigned to me`).toMatch(/^\/app\/review\/assigned\?/);
    await page.goto(row.href);
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
    expect(await shownListTotalOrEmpty(page), `${label}: WR-603, “${row.name}” equals the list it opens`).toBe(row.figure);
    if (row === withNewNotes) {
      await expect(page.getByRole('main').getByRole('link', { name: requestNumber, exact: true }), `${label}: With new notes lists the request with Jane’s note`).toHaveCount(1);
    }
  }

  await page.goto('/app/review/requests?assignee=unassigned');
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  if (waiting > 0) {
    expect(await shownListTotal(page), `${label}: Waiting for pick-up equals the requests nobody holds`).toBe(waiting);
  } else {
    // O2 (the 13-19 walk): the queue's own filtered empty state, the heading REQ08_PICK_UP_FROM_QUEUE_ROW sees too.
    await expect(page.getByRole('heading', { name: 'No assessment requests match these filters', exact: true }), `${label}: nothing waits for pick-up`).toBeVisible();
  }
});

/*
 * REQ-08 criterion 1, D-17 (13-UI-SPEC §12.1 to §12.4; success criterion 1): once Bob picks up Jane's request, every
 * surface Jane reads names him by display name alone. Her request page's next action names him (the hub's line at
 * 1440, the stepper's compact line at 375) and its Security Analyst row reads his name; her My requests row reads him
 * in the Security Analyst column, or `Security Analyst: Bob Doe` on the phone card; her Home item reads
 * `· Assigned to Bob Doe` on line 2. Axe is clean and nothing overflows at either width.
 */
test('REQ08_REQUESTOR_SEES_ASSIGNEE @journey: Jane reads that Bob Doe holds her request on its page, My requests and Home', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width ?? 1440;
  const title = `Requestor sees assignee ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmitsAndBobOpens(page, title);
  const section = assignmentSection(page);
  await section.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true }).click();
  await expect(section.getByText('Assigned to Bob Doe', { exact: true }), 'REQ08_REQUESTOR_SEES_ASSIGNEE: Bob holds the request').toBeVisible();
  const named = 'Bob Doe is reviewing your request and will send you a questionnaire to answer.';

  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const nextAction = width < 768
    ? page.getByRole('region', { name: /^Current lifecycle state:/ }).locator('p').filter({ hasText: /^Next action: / })
    : page.getByRole('region', { name: 'Request summary' }).locator('p').filter({ hasText: /^Next action: / });
  await expect(nextAction, 'REQ08_REQUESTOR_SEES_ASSIGNEE: the next action names Bob').toHaveText(`Next action: ${named}`);
  await expect(nextAction.getByRole('link'), 'REQ08_REQUESTOR_SEES_ASSIGNEE: the sentence opens nothing').toHaveCount(0);
  await expect(summaryValue(page, 'Security Analyst'), 'REQ08_REQUESTOR_SEES_ASSIGNEE: the hub names Bob').toHaveText('Bob Doe');
  await expect(page.getByRole('region', { name: 'Assignment' }), 'REQ08_REQUESTOR_SEES_ASSIGNEE: no assignment control for Jane').toHaveCount(0);
  await expectNoSeriousViolations(page, `Jane’s request page naming Bob at ${width}px`);
  await expectNoHorizontalOverflow(page, 'REQ08_REQUESTOR_SEES_ASSIGNEE (request page)');

  await page.goto(`/app/requests?q=${encodeURIComponent(requestNumber)}`);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  if (width < 768) {
    const cards = page.getByRole('list', { name: 'My assessment requests' }).getByRole('listitem');
    await expect(cards, 'REQ08_REQUESTOR_SEES_ASSIGNEE: My requests finds the request').toHaveCount(1);
    await expect(cards.first().getByText('Security Analyst: Bob Doe', { exact: true }), 'REQ08_REQUESTOR_SEES_ASSIGNEE: the card names Bob').toBeVisible();
    await expect(cards.first().getByText(named, { exact: true })).toBeVisible();
  } else {
    const table = page.getByRole('table', { name: 'My assessment requests' });
    await expect(table.getByRole('columnheader').nth(3)).toHaveText('Security Analyst');
    const rows = table.locator('tbody').getByRole('row');
    await expect(rows, 'REQ08_REQUESTOR_SEES_ASSIGNEE: My requests finds the request').toHaveCount(1);
    await expect(rows.first().getByRole('cell').nth(3), 'REQ08_REQUESTOR_SEES_ASSIGNEE: the Security Analyst column names Bob').toHaveText('Bob Doe');
    await expect(rows.first().getByRole('cell').nth(4).getByText(named, { exact: true })).toBeVisible();
  }
  await expectNoSeriousViolations(page, `Jane’s My requests naming Bob at ${width}px`);
  await expectNoHorizontalOverflow(page, 'REQ08_REQUESTOR_SEES_ASSIGNEE (My requests)');

  await page.goto('/app');
  const withAnalyst = page.getByRole('region', { name: 'With the Security Analyst', exact: true });
  const item = withAnalyst.getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await expect(item, 'REQ08_REQUESTOR_SEES_ASSIGNEE: the Home lists the request with the Security Analyst').toHaveCount(1);
  await expect(item.getByText(new RegExp(`^${requestNumber} · Submitted (today|1 day ago) · Assigned to Bob Doe$`)), 'REQ08_REQUESTOR_SEES_ASSIGNEE: line 2 names Bob').toBeVisible();
  await expect(item.getByText(named, { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, `Jane’s Home naming Bob at ${width}px`);
  await expectNoHorizontalOverflow(page, 'REQ08_REQUESTOR_SEES_ASSIGNEE (Home)');
});

/*
 * REQ-08 criterion 1, D-16, D-25 in the UI; success criterion 1 (13-UI-SPEC §11): the analyst's questionnaire and
 * assessment pages say, under the originating request link, who holds the request and how many notes it has. Bob
 * generates Jane's questionnaire, picks the request up and adds a note; its questionnaire review page reads `Assigned to
 * Bob Doe` with the notes figure. On the seeded released assessment of RAR-E2E-NAV-OWNER-001, which nobody holds, Bob's
 * assessment page reads `Not picked up · Pick up on the request page`, which opens the request and lands on its
 * assignment block (D1). The lines are rendered on the server and handed to the client views (D-34): the routes gain
 * no client code for them. Jane then reads Bob's note, so no flag is left for a later journey (WR-602).
 */
test('REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT @journey: Bob reads who holds the request and its notes on its questionnaire and assessment pages', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT';
  const title = `Assignee on records ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { requestNumber, documentId } = await janeSubmitsAndBobOpens(page, title);

  // Bob generates the questionnaire; the deterministic job may finish before the card shows it running.
  const questionnaireHref = await generateQuestionnaire(page, label);

  const section = assignmentSection(page);
  await section.getByRole('button', { name: `Pick up ${requestNumber}`, exact: true }).click();
  await expect(section.getByText('Assigned to Bob Doe', { exact: true }), `${label}: Bob holds the request`).toBeVisible();

  const bobsNote = 'Picked up: I will review the questionnaire this week.';
  await addNote(page, requestNumber, bobsNote, 'button');

  await page.goto(questionnaireHref);
  const requestLink = page.getByRole('link', { name: `Assessment request ${requestNumber}`, exact: true });
  await expect(requestLink).toBeVisible();
  const relationship = requestLink.locator('xpath=..');
  await expect(relationship.getByText('Assigned to Bob Doe', { exact: true }), `${label}: the questionnaire page names who holds the request`).toBeVisible();
  const figure = relationship.getByRole('link', { name: '1 note', exact: true });
  await expect(figure, `${label}: the questionnaire page links the notes figure`).toHaveAttribute('href', /\/app\/review\/requests\/[^/]+#notes$/);
  await expect(relationship.getByRole('link', { name: 'Pick up on the request page' })).toHaveCount(0);
  await expectNoSeriousViolations(page, `Bob’s questionnaire review naming the assignee at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (the questionnaire review)`);

  await page.goto('/app/review/assessments?q=ASM-E2E-NAV-OWNER-001');
  await page.getByRole('main').getByRole('link', { name: 'ASM-E2E-NAV-OWNER-001', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Risk assessment review' })).toBeVisible();
  const originating = page.getByRole('region', { name: 'Originating assessment request' });
  await expect(originating.getByRole('link', { name: 'RAR-E2E-NAV-OWNER-001 · Enterprise password manager rollout' })).toBeVisible();
  await expect(originating, `${label}: nobody holds the seeded released request`).toContainText('Not picked up · Pick up on the request page');
  await expectNoSeriousViolations(page, `Bob’s released assessment naming no assignee at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (the assessment page)`);

  // The seeded released request is only read: it must stay unassigned for every later journey (IN-603).
  await originating.getByRole('link', { name: 'Pick up on the request page', exact: true }).click();
  await expect(page, `${label}: the link opens the request at its assignment block`).toHaveURL(/\/app\/review\/requests\/[^/]+#assignment$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Enterprise password manager rollout', exact: true })).toBeVisible();
  await expect(assignmentSection(page).getByText('Not picked up', { exact: true })).toBeVisible();
  await expectLandedOn(
    page,
    'assignment',
    page.locator('#assignment').getByRole('heading', { level: 2, name: 'Assignment', exact: true }),
    `${label} (D1, the assessment page’s Pick up link at ${width}px)`,
  );

  // Jane reads Bob's note, and the next render reads it as read.
  await switchTo(page, 'Requestor');
  await page.goto(`${requestorPath(documentId)}#notes`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(noteWith(page, requestNumber, bobsNote).getByText('New', { exact: true }), `${label}: Bob’s note is new to Jane`).toBeVisible();
  await expectNoneNewOnNextRender(page, requestNumber, label);
});
