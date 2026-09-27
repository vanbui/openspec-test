import { expect, test, type Locator, type Page } from '@playwright/test';
import { webOrigin } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { primaryViewport, signInAs } from './helpers/navigation';

const analystAssessmentNumber = 'ASM-E2E-NAV-ANALYST-001';
const analystRequestNumber = 'RAR-E2E-NAV-ANALYST-001';
const analystRequestTitle = 'Analyst navigation lifecycle review request';
const ownerAssessmentNumber = 'ASM-E2E-NAV-OWNER-001';
const ownerRequestNumber = 'RAR-E2E-NAV-OWNER-001';
const ownerRequestTitle = 'Owner navigation lifecycle released request';
// Jane's seeded questionnaire and its request (apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts).
const ownerQuestionnaireNumber = 'QUES-DEV-DRAFT-001';
const ownerQuestionnaireTitle = 'Customer portal questionnaire draft';
const ownerQuestionnaireRequestNumber = 'RAR-DEV-QUES-DRAFT-001';
const ownerQuestionnaireRequestTitle = 'Customer portal questionnaire draft request';

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message },
  ).toBe(true);
}

/*
 * D-18: a page refused to another Requestor carries none of the owner's facts. Its text is read once,
 * the way Playwright's text assertions read it: hidden text included, script, style and template
 * content left out (the route's own URL, and so the documentId, sits in the page's flight data). It
 * must hold none of the protected values and no record identifier at all, since the Secondary
 * Requestor owns no record.
 */
async function expectNoOwnerFact(page: Page, protectedValues: readonly string[], label: string): Promise<void> {
  const text = await page.locator('body').evaluate((body) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('script, style, noscript, template')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
    return parts.join(' ');
  });
  for (const value of protectedValues) {
    expect(text, `NO_OWNER_FACT_${label}: ${value}`).not.toContain(value);
  }
  expect(text, `NO_RECORD_IDENTIFIER_${label}`).not.toMatch(/\b(?:RAR|QUES|QNR|ASM|RSK)-[0-9A-Z]/);
}

/* A sweep of both widths that hands the page back at the project's width (D-14), so a journey keeps running there. */
async function expectAtBothWidths(page: Page, surface: Locator, label: string): Promise<void> {
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(surface, `${label} is visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `${label} has no horizontal overflow at ${width}px`);
  }
  await page.setViewportSize(primaryViewport(test.info()));
}

async function expectLifecycle(page: Page, currentLabel: 'In review' | 'Released'): Promise<void> {
  const lifecycle = page.locator('section[aria-labelledby="assessment-lifecycle-heading"]');
  await expect(lifecycle.getByRole('heading', { name: `Current lifecycle state: ${currentLabel}` })).toBeVisible();
  const steps = lifecycle.getByRole('list', { name: 'Risk assessment lifecycle' }).getByRole('listitem');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('Step 1');
  await expect(steps.nth(0)).toContainText('Drafted');
  await expect(steps.nth(1)).toContainText('Step 2');
  await expect(steps.nth(1)).toContainText('In review');
  await expect(steps.nth(2)).toContainText('Step 3');
  await expect(steps.nth(2)).toContainText('Released');
  await expect(steps.nth(3)).toContainText('Step 4');
  await expect(steps.nth(3)).toContainText('Closed');

  const expectedStates = currentLabel === 'In review'
    ? ['Completed', 'Current', 'Future', 'Future']
    : ['Completed', 'Completed', 'Current', 'Future'];
  await expect(steps.locator('[data-testid="lifecycle-step-state"]')).toHaveText(expectedStates);
  await expect(steps.filter({ hasText: 'Current' })).toHaveAttribute('aria-current', 'step');
  await expect(lifecycle.getByRole('button')).toHaveCount(0);
}

async function expectContextBeforeAssessmentContent(page: Page): Promise<void> {
  await expect.poll(() => page.locator('main').evaluate((main) => {
    const request = main.querySelector('section[aria-labelledby="originating-request-label"]');
    const lifecycle = main.querySelector('section[aria-labelledby="assessment-lifecycle-heading"]');
    const existingContent = main.querySelector('#assessment-details, #assessment-overview');
    return Boolean(
      request
      && lifecycle
      && existingContent
      && (request.compareDocumentPosition(lifecycle) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (lifecycle.compareDocumentPosition(existingContent) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  })).toBe(true);
}

async function expectOriginatingRequest(
  page: Page,
  expectedHref: RegExp,
  requestNumber: string,
  requestTitle: string,
): Promise<Locator> {
  const section = page.locator('section[aria-labelledby="originating-request-label"]');
  await expect(section.getByText('Originating assessment request', { exact: true })).toBeVisible();
  const link = section.getByRole('link', { name: `${requestNumber}: ${requestTitle}` });
  await expect(link).toHaveAttribute('href', expectedHref);
  return link;
}

test('assessment navigation gives both actors lifecycle context and keeps an unrelated Requestor denied @journey', async ({ browser, page }, testInfo) => {
  test.setTimeout(180_000);

  // Every document this journey loads, for each actor, runs under the production CSP with no violation (D-19).
  await attachCspCollector(page);
  await page.setViewportSize(primaryViewport(testInfo));
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/review/assessments');
  await page.getByRole('link', { name: analystAssessmentNumber }).click();
  await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
  const analystLink = await expectOriginatingRequest(
    page,
    /^\/app\/review\/requests\/[^/]+$/,
    analystRequestNumber,
    analystRequestTitle,
  );
  await expectLifecycle(page, 'In review');
  await expectContextBeforeAssessmentContent(page);
  await expectAtBothWidths(page, analystLink, 'Analyst originating request link');
  await analystLink.focus();
  await expect(analystLink).toBeFocused();
  await analystLink.click();
  await expect(page.getByRole('heading', { name: analystRequestTitle })).toBeVisible();

  await signInAs(page, 'Requestor');
  await page.goto('/app/assessments');
  await page.getByRole('link', { name: ownerAssessmentNumber }).click();
  await expect(page.getByRole('heading', { name: 'Released risk assessment' })).toBeVisible();
  const ownerLink = await expectOriginatingRequest(
    page,
    /^\/app\/requests\/[^/]+$/,
    ownerRequestNumber,
    ownerRequestTitle,
  );
  await expectLifecycle(page, 'Released');
  await expectContextBeforeAssessmentContent(page);
  await expect(page.getByRole('main').getByRole('form')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: /save|add|edit|remove|release/i })).toHaveCount(0);
  await expectAtBothWidths(page, ownerLink, 'Requestor originating request link');
  await ownerLink.focus();
  await expect(ownerLink).toBeFocused();

  const ownerAssessmentPath = new URL(page.url()).pathname;
  const ownerAssessmentDocumentId = decodeURIComponent(ownerAssessmentPath.split('/').at(-1) ?? '');
  await ownerLink.click();
  await expect(page.getByRole('heading', { name: ownerRequestTitle })).toBeVisible();

  // D-18: Jane's request and questionnaire URLs, taken from her own navigation like the assessment path.
  const ownerRequestPath = new URL(page.url()).pathname;
  expect(ownerRequestPath, 'D18_OWNER_REQUEST_PATH').toMatch(/^\/app\/requests\/[^/]+$/);
  const ownerRequestDocumentId = decodeURIComponent(ownerRequestPath.split('/').at(-1) ?? '');
  await page.goto('/app/questionnaires');
  const ownerQuestionnaireLink = page.getByRole('link', { name: ownerQuestionnaireTitle, exact: true });
  await expect(ownerQuestionnaireLink, 'D18_OWNER_QUESTIONNAIRE_LISTED').toHaveCount(1);
  const ownerQuestionnairePath = await ownerQuestionnaireLink.getAttribute('href') ?? '';
  expect(ownerQuestionnairePath, 'D18_OWNER_QUESTIONNAIRE_PATH').toMatch(/^\/app\/questionnaires\/[^/]+$/);
  const ownerQuestionnaireDocumentId = decodeURIComponent(ownerQuestionnairePath.split('/').at(-1) ?? '');
  await expectNoCspViolations(page, 'the analyst and the owning Requestor');

  const janesFacts = [
    ownerRequestNumber, ownerRequestTitle, ownerRequestDocumentId,
    ownerQuestionnaireNumber, ownerQuestionnaireTitle, ownerQuestionnaireRequestNumber, ownerQuestionnaireRequestTitle, ownerQuestionnaireDocumentId,
    ownerAssessmentNumber, ownerAssessmentDocumentId,
  ];
  const nonOwnerContext = await browser.newContext({ baseURL: webOrigin });
  const nonOwnerPage = await nonOwnerContext.newPage();
  await attachCspCollector(nonOwnerPage);
  await signInAs(nonOwnerPage, 'Secondary Requestor');
  const main = nonOwnerPage.getByRole('main');
  for (const width of [1440, 375] as const) {
    await nonOwnerPage.setViewportSize({ width, height: width === 375 ? 812 : 900 });

    /*
     * Jane's request. Strapi answers another Requestor's request read with 403, so the page renders
     * the shared permission state and nothing of the record, under the page's one level-one heading,
     * which names the page and never the record (08-12).
     */
    await nonOwnerPage.goto(ownerRequestPath);
    await expect(main.getByRole('heading', { level: 1, name: 'Assessment request', exact: true }), `D18_REQUEST_PAGE_HEADING_${width}`).toBeVisible();
    await expect(nonOwnerPage.getByRole('heading', { level: 1 }), `D18_REQUEST_ONE_LEVEL_ONE_HEADING_${width}`).toHaveCount(1);
    await expect(nonOwnerPage, `D18_REQUEST_TITLE_${width}`).toHaveTitle('Assessment Request | IdamBox CSRM');
    const requestDenial = main.locator('[data-state-kind="permission"]');
    await expect(requestDenial, `D18_REQUEST_PERMISSION_STATE_${width}`).toBeVisible();
    await expect(requestDenial).toHaveAttribute('role', 'alert');
    await expect(requestDenial).toContainText('You don’t have access to this area');
    await expect(requestDenial.getByRole('link', { name: 'Return to workspace', exact: true })).toHaveAttribute('href', '/app');
    await expect(nonOwnerPage.getByRole('banner').getByText('Secondary Requestor', { exact: true }), `D18_REQUEST_SHELL_KEPT_${width}`).toBeVisible();
    await expect(main.getByRole('region', { name: 'Request actions' }), `D18_REQUEST_NO_ACTIONS_${width}`).toHaveCount(0);
    await expect(main.getByRole('heading', { name: /^Current lifecycle state:/ }), `D18_REQUEST_NO_LIFECYCLE_${width}`).toHaveCount(0);
    await expectNoOwnerFact(nonOwnerPage, janesFacts, `REQUEST_${width}`);
    await expectNoHorizontalOverflow(nonOwnerPage, `the request permission state has no horizontal overflow at ${width}px`);

    /*
     * Jane's questionnaire, Customer portal questionnaire draft, at /app/questionnaires/{documentId}.
     * Strapi answers 403, so the page renders the questionnaire's own permission copy.
     */
    await nonOwnerPage.goto(ownerQuestionnairePath);
    await expect(main.getByRole('heading', { level: 1, name: 'Questionnaire unavailable', exact: true }), `D18_QUESTIONNAIRE_PERMISSION_HEADING_${width}`).toBeVisible();
    await expect(nonOwnerPage.getByRole('heading', { level: 1 }), `D18_QUESTIONNAIRE_ONE_LEVEL_ONE_HEADING_${width}`).toHaveCount(1);
    await expect(main.getByRole('alert').filter({ hasText: 'You don’t have permission to view this questionnaire' }), `D18_QUESTIONNAIRE_PERMISSION_COPY_${width}`).toBeVisible();
    await expect(main.getByRole('link', { name: 'Back to questionnaires', exact: true })).toHaveAttribute('href', '/app/questionnaires');
    await expect(nonOwnerPage.getByRole('banner').getByText('Secondary Requestor', { exact: true }), `D18_QUESTIONNAIRE_SHELL_KEPT_${width}`).toBeVisible();
    await expect(main.getByRole('textbox'), `D18_QUESTIONNAIRE_NO_ANSWER_FIELD_${width}`).toHaveCount(0);
    await expect(main.getByRole('link', { name: /^Assessment request / }), `D18_QUESTIONNAIRE_NO_REQUEST_LINK_${width}`).toHaveCount(0);
    await expectNoOwnerFact(nonOwnerPage, janesFacts, `QUESTIONNAIRE_${width}`);
    await expectNoHorizontalOverflow(nonOwnerPage, `the questionnaire permission state has no horizontal overflow at ${width}px`);

    /*
     * Jane's assessment. Strapi answers an unauthorised assessment read with 404 rather than 403, so
     * the route renders not-found. Refusing to confirm the record exists is the stronger denial: a
     * permission notice would tell an unrelated Requestor that this assessment is real. The not-found
     * renders inside the shell (app/(app)/not-found.tsx) with the locked copy under the page's only
     * level-one heading.
     */
    await nonOwnerPage.goto(ownerAssessmentPath);
    await expect(main.getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `NOT_FOUND_IN_SHELL_${width}`).toBeVisible();
    await expect(nonOwnerPage.getByRole('heading', { level: 1 }), `ONE_LEVEL_ONE_HEADING_${width}`).toHaveCount(1);
    // The route's metadata makes the same read, so the title follows the not-found (WCAG 2.4.2, 08-12).
    await expect(nonOwnerPage, `NOT_FOUND_TITLE_${width}`).toHaveTitle('Page not found | IdamBox CSRM');
    await expect(main.getByText('The page you asked for doesn’t exist or has moved.', { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Return to workspace', exact: true })).toHaveAttribute('href', '/app');
    await expect(nonOwnerPage.getByRole('banner').getByText('Secondary Requestor', { exact: true }), `SHELL_KEPT_${width}`).toBeVisible();
    await expect(nonOwnerPage.locator('section[aria-labelledby="assessment-lifecycle-heading"]')).toHaveCount(0);
    await expect(nonOwnerPage.locator('section[aria-labelledby="originating-request-label"]')).toHaveCount(0);
    for (const protectedValue of [ownerAssessmentNumber, ownerRequestNumber, ownerRequestTitle, ownerAssessmentDocumentId]) {
      await expect(nonOwnerPage.locator('body'), `NO_OWNER_FACT_${width}`).not.toContainText(protectedValue);
    }
    await expectNoOwnerFact(nonOwnerPage, janesFacts, `ASSESSMENT_${width}`);
    await expectNoHorizontalOverflow(nonOwnerPage, `the in-shell not-found has no horizontal overflow at ${width}px`);
  }
  await expectNoCspViolations(nonOwnerPage, 'the Secondary Requestor denials');
  await nonOwnerContext.close();
});

test('assessment list filters remain readable and independent across responsive widths', async ({ page }) => {
  await signInAs(page, 'Security Analyst');

  await page.goto('/app/review/requests');
  const requestStatus = page.getByRole('combobox', { name: 'Filter by status' });
  const queue = page.getByRole('combobox', { name: 'Filter by queue' });
  await expectAtBothWidths(page, requestStatus, 'Analyst request status filter');
  await expectAtBothWidths(page, queue, 'Analyst request queue filter');
  await expect(requestStatus.locator('option')).toHaveText([
    'All statuses', 'Draft', 'Submitted', 'Questionnaire in progress',
    'Risk assessment drafted', 'Under review', 'Approved', 'Closed',
  ]);
  await queue.selectOption('released');
  await expect(page).toHaveURL(/queue=released/);
  await expect(requestStatus.locator('option')).toHaveText([
    'All statuses', 'Draft', 'Submitted', 'Questionnaire in progress',
    'Risk assessment drafted', 'Under review', 'Approved', 'Closed',
  ]);

  await page.goto('/app/review/assessments');
  const assessmentStatus = page.getByRole('combobox', { name: 'Filter by status' });
  await expectAtBothWidths(page, assessmentStatus, 'Analyst assessment status filter');
  await expect(assessmentStatus.locator('option')).toHaveText([
    'All statuses', 'Draft', 'In review', 'Released', 'Closed',
  ]);
});

/*
 * GAP-1 (06.9-04): choosing a status must filter, never fail. A status the
 * selected queue does not read is intersected to an empty page, so the Analyst
 * sees the shared empty-filter state rather than the error state. The same
 * status inside its own queue still returns its records.
 */
test('an Analyst status choice outside the queue shows the empty filtered list, not an error', async ({ page }) => {
  await signInAs(page, 'Security Analyst');

  await page.goto('/app/review/requests');
  const requestStatus = page.getByRole('combobox', { name: 'Filter by status' });
  const queue = page.getByRole('combobox', { name: 'Filter by queue' });
  await expect(queue).toHaveValue('requires-attention');
  await requestStatus.selectOption('approved');
  await expect(page).toHaveURL(/status=approved/);
  const noMatchingRequests = page.getByRole('heading', { name: 'No assessment requests match these filters' });
  await expectAtBothWidths(page, noMatchingRequests, 'Approved in Requires my attention empty-filter state');
  // The chip says what the list shows, on screen and on paper (verdict 4a); the table row and the empty state each clear it.
  await expect(page.getByText('Status: Approved', { exact: true }), 'the status filter shows as a chip').toBeVisible();
  await expect(page.locator('[data-state-kind="empty"]').getByRole('button', { name: 'Clear filters' })).toBeVisible();
  await expect(page.locator('[data-state-kind="error"]')).toHaveCount(0);

  await queue.selectOption('released');
  await expect(page).toHaveURL(/queue=released/);
  await expect(requestStatus).toHaveValue('approved');
  await expect(page.getByRole('link', { name: ownerRequestNumber })).toBeVisible();
  await expect(page.getByRole('main').locator('[data-state-kind]')).toHaveCount(0);

  await page.goto('/app/review/assessments');
  const assessmentStatus = page.getByRole('combobox', { name: 'Filter by status' });
  await assessmentStatus.selectOption('closed');
  await expect(page).toHaveURL(/status=closed/);
  const noMatchingAssessments = page.getByRole('heading', { name: 'No risk assessments match these filters' });
  await expectAtBothWidths(page, noMatchingAssessments, 'Closed assessment empty-filter state');
  await expect(page.getByText('Status: Closed', { exact: true }), 'the status filter shows as a chip').toBeVisible();
  await expect(page.locator('[data-state-kind="empty"]').getByRole('button', { name: 'Clear filters' })).toBeVisible();
  await expect(page.locator('[data-state-kind="error"]')).toHaveCount(0);

  await assessmentStatus.selectOption('approved');
  await expect(page).toHaveURL(/status=approved/);
  await expect(page.getByRole('link', { name: ownerAssessmentNumber })).toBeVisible();
});
