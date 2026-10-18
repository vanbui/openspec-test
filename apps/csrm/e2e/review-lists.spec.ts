import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { openFromNavigation, primaryViewport, signInAs } from './helpers/navigation';
import { createSubmittedRequest, type SubmittedRequest } from './helpers/requests';

/*
 * The review lists (UX-09; D-29, D-30, D-55; UI-SPEC §7). The browser runs in a zone other than UTC, so the
 * Requests queue proves it shows the submission instant in the viewer's own time zone.
 */
test.use({ timezoneId: 'Australia/Brisbane' });

const requestorName = 'Jane Doe';
const queueLabel = 'Assessment requests for review';
const myRequestsLabel = 'My assessment requests';
/** The Requestor's next step on a submitted request nobody has picked up yet (13-UI-SPEC §12.1). */
const analystHeldSentence = 'Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.';
const assessmentListLabel = 'Risk assessments for review';
/*
 * The seeded released analyst-insights assessment (seed-analyst-insights.ts): its request's title, its two Risks (one
 * rated Critical, and the accepted Moderate Risk plan 11-16 added, D-45), drafted by Bob Doe. It is released, so no
 * journey adds a Risk to it and both projects read the same facts.
 */
const seededAssessment = {
  number: 'ASM-E2E-P7-RELEASED-001',
  requestTitle: 'Immutable cloud backup for tier 1 systems',
  titleWord: 'Immutable',
  draftedBy: 'Bob Doe',
} as const;

type TriageRequest = SubmittedRequest & { title: string; titleWord: string; dueDate: string };

/*
 * One request per project, created through the UI as the Requestor (D-56). Both journeys below run in both
 * projects against one database, so each project names its own record, and the search journey creates one
 * when it runs without the triage journey before it.
 */
const createdByProject = new Map<string, TriageRequest>();

/** The calendar date `days` after today in UTC, in the form the date input takes. */
function utcDatePlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function triageRequestFor(page: Page, testInfo: TestInfo): Promise<TriageRequest> {
  const existing = createdByProject.get(testInfo.project.name);
  if (existing) return existing;
  const titleWord = `${testInfo.project.name}${Date.now().toString(36)}`;
  const title = `Queue triage ${titleWord}`;
  const dueDate = utcDatePlus(30);
  await signInAs(page, 'Requestor');
  const submitted = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'High', dueDate });
  const created = { ...submitted, title, titleWord, dueDate };
  createdByProject.set(testInfo.project.name, created);
  return created;
}

/** Signs in as the Security Analyst and opens Requests from the navigation, on its All requests view. */
async function openAllRequests(page: Page): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, 'Security Analyst');
  await openFromNavigation(page, /^Requests\b/);
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter by queue' }).selectOption('all');
  await expect.poll(() => new URL(page.url()).searchParams.get('queue')).toBe('all');
  await expect(page.getByText(/^Queue:/)).toHaveText('Queue: All requests');
}

async function searchQueue(page: Page, term: string): Promise<void> {
  const search = page.getByRole('searchbox', { name: 'Search by number or title', exact: true });
  await search.fill(term);
  await search.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(term);
  await expect.poll(() => new URL(page.url()).searchParams.get('queue')).toBe('all');
}

/** The one request the search found, at the width this project shows: a table row from 768px, else a card. */
function foundRecords(page: Page, width: number) {
  return width < 768
    ? page.getByRole('list', { name: queueLabel }).getByRole('listitem')
    : page.getByRole('table', { name: queueLabel }).locator('tbody').getByRole('row');
}

/** Signs in as the Requestor and opens My requests at `search` (a query string, `?` included). */
async function openMyRequests(page: Page, search: string): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  await page.goto(`/app/requests${search}`);
  await expect(page.getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
}

/** My requests' records at the width this page shows: table rows from 768px, else cards. */
function myRequestRecords(page: Page, width: number) {
  return width < 768
    ? page.getByRole('list', { name: myRequestsLabel }).getByRole('listitem')
    : page.getByRole('table', { name: myRequestsLabel }).locator('tbody').getByRole('row');
}

/** A calendar date as the queue writes it: its own day, with no zone (D-55). */
function calendarDateLabel(page: Page, date: string): Promise<string> {
  return page.evaluate((value) => new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`)).replace(/\s/g, ' '), date);
}

test.describe('Review lists @journey', () => {
  test('UX09_QUEUE_TRIAGE_COLUMNS: the analyst triages a new request from the queue’s columns', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const primary = primaryViewport(testInfo);
    await page.setViewportSize(primary);
    const request = await triageRequestFor(page, testInfo);

    await openAllRequests(page);
    await searchQueue(page, request.requestNumber);
    const records = foundRecords(page, primary.width);
    await expect(records, 'UX09_QUEUE_TRIAGE_COLUMNS_ONE_MATCH').toHaveCount(1);
    const dueLabel = await calendarDateLabel(page, request.dueDate);

    if (primary.width >= 768) {
      const cells = records.first().getByRole('cell');
      await expect(cells, 'UX09_QUEUE_TRIAGE_COLUMNS').toHaveText([
        request.requestNumber,
        request.title,
        requestorName,
        'Project',
        'High',
        'Submitted',
        // Phase 13 (13-12; 13-UI-SPEC §2.2): Assigned to after Status. Nobody holds the new request, so Bob may pick it up.
        'Pick up',
        dueLabel,
        /^(0 days|1 day)$/,
        /\S/,
      ]);
      // Business criticality is a business attribute in plain text, never the risk severity badge (UI-D27).
      await expect(cells.nth(4).locator('[data-slot="badge"]'), 'UX09_QUEUE_CRITICALITY_PLAIN_TEXT').toHaveCount(0);

      // D-55: the submission instant reads in the browser's own zone. The page may first render in UTC until the
      // shell sends the zone, then re-renders in place; the poll absorbs that one re-render.
      const submitted = cells.nth(9).locator('time');
      const instant = await submitted.getAttribute('datetime');
      expect(instant, 'UX09_QUEUE_SUBMITTED_HAS_INSTANT').toBeTruthy();
      await expect.poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === 'csrm-time-zone')?.value,
        { message: 'UX09_BROWSER_ZONE_REACHES_SERVER_COOKIE' }).toBe('Australia%2FBrisbane');
      const expectedSubmitted = await page.evaluate((iso) => new Intl.DateTimeFormat('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane',
      }).format(new Date(iso)).replace(/\s/g, ' '), instant!);
      await expect.poll(
        async () => (await submitted.textContent())?.replace(/\s/g, ' '),
        { message: 'UX09_QUEUE_SUBMITTED_IN_VIEWER_ZONE' },
      ).toBe(expectedSubmitted);
    } else {
      // UI-SPEC §7.1: the phone card names who asked with the due date, then the age.
      const card = records.first();
      await expect(card.getByRole('link', { name: request.requestNumber, exact: true })).toBeVisible();
      await expect(card.getByRole('link', { name: request.title, exact: true })).toBeVisible();
      await expect(card.getByText(`${requestorName} · Due ${dueLabel}`, { exact: true }), 'UX09_QUEUE_CARD_REQUESTOR_AND_DUE').toBeVisible();
      await expect(card.getByText(/^Age (0 days|1 day)$/), 'UX09_QUEUE_CARD_AGE').toBeVisible();
    }
  });

  test('UX09_ASSESSMENT_COLUMNS: the analyst tells assessments apart by request title and sees their Risks', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const primary = primaryViewport(testInfo);
    await page.setViewportSize(primary);
    await signInAs(page, 'Security Analyst');
    await openFromNavigation(page, 'Risk assessments', true);
    await expect(page.getByRole('heading', { level: 1, name: 'Risk assessments', exact: true })).toBeVisible();

    // D-31: a word of the request title finds the assessment (it is in neither its number nor its summary).
    const search = page.getByRole('searchbox', { name: 'Search risk assessments', exact: true });
    await search.fill(seededAssessment.titleWord);
    await search.press('Enter');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(seededAssessment.titleWord);

    if (primary.width >= 768) {
      const table = page.getByRole('table', { name: assessmentListLabel });
      await expect(table.getByRole('columnheader'), 'UX09_ASSESSMENT_COLUMN_HEADERS').toHaveText([
        'Assessment', 'Request title', 'Status', 'Risks', 'Highest residual rating', 'Draft initiated by', 'Released',
      ]);
      const row = table.locator('tbody').getByRole('row').filter({ hasText: seededAssessment.number });
      await expect(row, 'UX09_ASSESSMENT_SEARCH_BY_REQUEST_TITLE').toHaveCount(1);
      await expect(row.getByRole('cell'), 'UX09_ASSESSMENT_COLUMNS').toHaveText([
        seededAssessment.number,
        seededAssessment.requestTitle,
        'Released',
        '2',
        'Critical',
        seededAssessment.draftedBy,
        /\S/,
      ]);
      await expect(row.getByRole('cell').nth(4).getByLabel('Severity: critical (4 of 4)'), 'UX09_ASSESSMENT_RATING_BADGE').toBeVisible();
      await expect(row.getByRole('cell').nth(6).locator('time'), 'UX09_ASSESSMENT_RELEASED_LOCAL').toHaveCount(1);
    } else {
      // UI-SPEC §7.2: the phone card names the request and the Risk count with the highest residual rating.
      const card = page.getByRole('list', { name: assessmentListLabel }).getByRole('listitem').filter({ hasText: seededAssessment.number });
      await expect(card, 'UX09_ASSESSMENT_SEARCH_BY_REQUEST_TITLE').toHaveCount(1);
      await expect(card.getByText(seededAssessment.requestTitle, { exact: true }), 'UX09_ASSESSMENT_CARD_REQUEST_TITLE').toBeVisible();
      await expect(card.getByText(/^2 Risks · Highest residual$/), 'UX09_ASSESSMENT_CARD_RISKS').toBeVisible();
      await expect(card.getByLabel('Severity: critical (4 of 4)'), 'UX09_ASSESSMENT_CARD_RATING').toBeVisible();
    }
  });

  test('UX09_MY_REQUESTS_HOLDER_FILTER: My requests filters to the requests the Security Analyst holds, on a desktop and a phone', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const primary = primaryViewport(testInfo);
    await page.setViewportSize(primary);
    const request = await triageRequestFor(page, testInfo);
    const search = `q=${encodeURIComponent(request.requestNumber)}`;

    // D-35: the list the Homes' holder figures open. A submitted request is with the Security Analyst.
    await openMyRequests(page, `?holder=analyst&${search}`);
    await expect(page.getByRole('combobox', { name: 'Show', exact: true }), 'UX09_MY_REQUESTS_SHOW_VALUE').toHaveValue('analyst');
    await expect(page.getByText('Show: With the Security Analyst', { exact: true }), 'UX09_MY_REQUESTS_SHOW_CHIP').toBeVisible();
    const records = myRequestRecords(page, primary.width);
    await expect(records, 'UX09_MY_REQUESTS_HOLDER_FILTER').toHaveCount(1);
    const record = records.first();
    await expect(record.getByRole('link', { name: request.requestNumber, exact: true })).toBeVisible();
    if (primary.width < 768) {
      // UI-SPEC §7.3: the phone card says whose turn it is and what happens next, then the dates.
      await expect(record.getByText('With the Security Analyst', { exact: true }), 'UX09_MY_REQUESTS_CARD_HOLDER').toBeVisible();
      await expect(record.getByText(analystHeldSentence, { exact: true }), 'UX09_MY_REQUESTS_CARD_NEXT_STEP').toBeVisible();
      await expect(record.getByText('Not picked up yet', { exact: true }), 'UX09_MY_REQUESTS_CARD_NOT_PICKED_UP').toBeVisible();
      await expect(record.getByText(/^Due .+ · Updated .+$/), 'UX09_MY_REQUESTS_CARD_DATES').toBeVisible();
    } else {
      // Phase 13 (13-15; 13-UI-SPEC §12.4): the Security Analyst column follows Status, so Next step is the fifth cell.
      await expect(record.getByRole('cell').nth(4).getByText('With the Security Analyst', { exact: true }), 'UX09_MY_REQUESTS_ROW_HOLDER').toBeVisible();
      await expect(record.getByRole('cell').nth(3), 'UX09_MY_REQUESTS_ROW_NOT_PICKED_UP').toHaveText('Not picked up yet');
    }

    // The same request does not wait on the Requestor.
    await page.goto(`/app/requests?holder=requestor&${search}`);
    await expect(page.getByRole('combobox', { name: 'Show', exact: true })).toHaveValue('requestor');
    await expect(page.getByRole('heading', { name: 'No assessment requests match these filters' }), 'UX09_MY_REQUESTS_HOLDER_EXCLUDES').toBeVisible();
    await expect(page.getByRole('link', { name: request.requestNumber, exact: true })).toHaveCount(0);

    // Clear filters clears Show with the search (D-34).
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('holder'), { message: 'UX09_MY_REQUESTS_CLEAR_SHOW' }).toBeNull();
    await expect(page.getByRole('combobox', { name: 'Show', exact: true })).toHaveValue('');
  });

  test('UX09_QUEUE_SEARCH_BY_TITLE: a word of the title finds the same request', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const primary = primaryViewport(testInfo);
    await page.setViewportSize(primary);
    const request = await triageRequestFor(page, testInfo);

    await openAllRequests(page);
    await expect(page.getByRole('searchbox', { name: 'Search by number or title', exact: true }), 'UX09_QUEUE_SEARCH_NAME').toBeVisible();
    await searchQueue(page, request.titleWord);
    const records = foundRecords(page, primary.width);
    await expect(records, 'UX09_QUEUE_SEARCH_BY_TITLE_ONE_MATCH').toHaveCount(1);
    await expect(records.first().getByRole('link', { name: request.requestNumber, exact: true }), 'UX09_QUEUE_SEARCH_BY_TITLE').toBeVisible();
  });
});

test.describe('Deterministic viewer date', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('UX09_ZONE_CROSSES_MIDNIGHT: a seeded UTC-midnight submission displays the previous local day', async ({ page }) => {
    await openAllRequests(page);
    await searchQueue(page, 'RAR-E2E-P7-MUTABLE-001');
    // The Submitted column follows Phase 13's Assigned to (13-12).
    const submitted = foundRecords(page, 1440).first().getByRole('cell').nth(9).locator('time');
    await expect(submitted).toBeVisible();
    const instant = await submitted.getAttribute('datetime');
    expect(instant, 'seeded submission is a controlled UTC-midnight instant').toMatch(/T00:00:00(?:\.000)?Z$/);
    const labels = await page.evaluate((iso) => {
      const date = new Date(iso!);
      const label = (timeZone: string) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(date).replace(/\s/g, ' ');
      return { utc: label('UTC'), local: label('America/New_York') };
    }, instant);
    expect(labels.local, 'the fixture must distinguish the local date from UTC').not.toBe(labels.utc);
    await expect.poll(async () => (await submitted.textContent())?.replace(/\s/g, ' ')).toBe(labels.local);
  });
});

/*
 * My requests' Next step column (D-34; UI-SPEC §7.3) is a desktop table column, so this proof runs at 1440 only and
 * sits outside the @journey describe; the phone card is proved by UX09_MY_REQUESTS_HOLDER_FILTER.
 */
test('UX09_MY_REQUESTS_NEXT_STEP: the Requestor reads that a new request is with the Security Analyst, and what happens next', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const request = await triageRequestFor(page, testInfo);

  await openMyRequests(page, `?q=${encodeURIComponent(request.requestNumber)}`);
  const table = page.getByRole('table', { name: myRequestsLabel });
  await expect(table.getByRole('columnheader'), 'UX09_MY_REQUESTS_COLUMN_HEADERS').toHaveText([
    'Request ID', 'Title', 'Status', 'Security Analyst', 'Next step', 'Due date', 'Updated',
  ]);
  const records = myRequestRecords(page, 1440);
  await expect(records, 'UX09_MY_REQUESTS_NEXT_STEP_ONE_MATCH').toHaveCount(1);
  const row = records.first();
  await expect(row.getByRole('link', { name: request.title, exact: true })).toBeVisible();
  // Phase 13 (13-15): the Security Analyst column follows Status, so Next step is the fifth cell.
  const nextStep = row.getByRole('cell').nth(4);
  await expect(nextStep.getByText('With the Security Analyst', { exact: true }), 'UX09_MY_REQUESTS_NEXT_STEP_HOLDER').toBeVisible();
  await expect(nextStep.getByText(analystHeldSentence, { exact: true }), 'UX09_MY_REQUESTS_NEXT_STEP').toBeVisible();
  // The Security Analyst holds the step, so the Requestor's sentence opens nothing (UI-SPEC §6.1).
  await expect(nextStep.getByRole('link'), 'UX09_MY_REQUESTS_NEXT_STEP_NOT_A_LINK').toHaveCount(0);
});
