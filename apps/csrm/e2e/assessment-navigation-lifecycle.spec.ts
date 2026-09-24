import { expect, test, type Locator, type Page } from '@playwright/test';
import { webOrigin } from './harness-urls';

const analystAssessmentNumber = 'ASM-E2E-NAV-ANALYST-001';
const analystRequestNumber = 'RAR-E2E-NAV-ANALYST-001';
const analystRequestTitle = 'Analyst navigation lifecycle review request';
const ownerAssessmentNumber = 'ASM-E2E-NAV-OWNER-001';
const ownerRequestNumber = 'RAR-E2E-NAV-OWNER-001';
const ownerRequestTitle = 'Owner navigation lifecycle released request';

async function signIn(page: Page, role: 'Requestor' | 'Secondary Requestor' | 'Security Analyst'): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);

  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  /*
   * Assert the shell, not the URL: '/sign-in?returnTo=/app' also ends in '/app',
   * so a URL check alone reports a click that never left sign-in as a success.
   */
  await expect(page.getByRole('heading', { name: 'Dashboard' }), `SIGN_IN_SHELL:${role}`).toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), `SIGN_IN_ROLE:${role}`).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message },
  ).toBe(true);
}

async function expectAtBothWidths(page: Page, surface: Locator, label: string): Promise<void> {
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(surface, `${label} is visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `${label} has no horizontal overflow at ${width}px`);
  }
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

test('assessment navigation gives both actors lifecycle context and keeps an unrelated Requestor denied', async ({ browser, page }) => {
  test.setTimeout(180_000);

  await signIn(page, 'Security Analyst');
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

  await signIn(page, 'Requestor');
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

  const nonOwnerContext = await browser.newContext({ baseURL: webOrigin });
  const nonOwnerPage = await nonOwnerContext.newPage();
  await signIn(nonOwnerPage, 'Secondary Requestor');
  await nonOwnerPage.goto(ownerAssessmentPath);
  /*
   * Strapi answers an unauthorised assessment read with 404 rather than 403, so the
   * route renders not-found. Refusing to confirm the record exists is the stronger
   * denial: a permission notice would tell an unrelated Requestor that this
   * assessment is real. Assert that treatment, and that no owner fact reaches the page.
   */
  await expect(nonOwnerPage.getByText('This page could not be found.')).toBeVisible();
  await expect(nonOwnerPage.locator('section[aria-labelledby="assessment-lifecycle-heading"]')).toHaveCount(0);
  await expect(nonOwnerPage.locator('section[aria-labelledby="originating-request-label"]')).toHaveCount(0);
  for (const protectedValue of [ownerAssessmentNumber, ownerRequestNumber, ownerRequestTitle, ownerAssessmentDocumentId]) {
    await expect(nonOwnerPage.locator('body')).not.toContainText(protectedValue);
  }
  await nonOwnerContext.close();
});

test('assessment list filters remain readable and independent across responsive widths', async ({ page }) => {
  await signIn(page, 'Security Analyst');

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
    'All statuses', 'Draft', 'In review', 'Approved', 'Closed',
  ]);
});
