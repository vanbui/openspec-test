import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const analystReviewTitle = 'Customer portal questionnaire awaiting release';
const releasedTitle = 'Customer portal questionnaire draft';
const analystAssessmentNumber = 'ASM-E2E-NAV-ANALYST-001';
const ownerAssessmentNumber = 'ASM-E2E-NAV-OWNER-001';

async function signIn(page: Page, role: 'Requestor' | 'Security Analyst'): Promise<void> {
  await page.goto('/sign-in?returnTo=/app');
  await page.getByRole('button', { name: `Continue as ${role}` }).click();
  await expect(page.getByRole('banner').getByText(role, { exact: true })).toBeVisible();
}

async function expectAccessibleAtBothWidths(page: Page, surface: string): Promise<void> {
  for (const width of [1440, 375] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    /*
     * A scan that starts mid-navigation reports the transient document as
     * having no title and no level-one heading, which says nothing about the
     * surface. Wait for the settled document before measuring it.
     */
    await expect.poll(() => page.title(), { message: `${surface} settles before the scan at ${width}px` })
      .not.toBe('');
    await expect(page.getByRole('heading', { level: 1 }).first(), `${surface} has its page heading at ${width}px`).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations, `${surface} has no axe violations at ${width}px`).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${surface} has no horizontal overflow at ${width}px`,
    ).toBe(true);
  }
}

test('has no axe violations in the signed-in CSRM shell', async ({ page }) => {
  await page.goto('/sign-in?returnTo=/app');
  await page.getByRole('button', { name: 'Continue as Security Analyst' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page).toHaveTitle('Dashboard | IdamBox CSRM');

  const scan = await new AxeBuilder({ page }).analyze();

  expect(scan.violations).toEqual([]);
});

test('has no axe violations on phase 06.8 governed questionnaire surfaces', async ({ page }) => {
  await signIn(page, 'Security Analyst');
  await page.goto('/app/review/questionnaires');
  const analystReview = page.getByRole('link', { name: analystReviewTitle }).first();
  await expect(analystReview).toBeVisible();
  await analystReview.click();
  await expectAccessibleAtBothWidths(page, 'analyst questionnaire review');

  await page.goto('/app/review/questionnaires');
  const releasedReview = page.getByRole('link', { name: releasedTitle }).first();
  await expect(releasedReview).toBeVisible();
  await releasedReview.click();
  await expectAccessibleAtBothWidths(page, 'analyst released questionnaire review');

  await signIn(page, 'Requestor');
  await page.goto('/app/questionnaires');
  const questionnaire = page.getByRole('link', { name: releasedTitle }).first();
  await expect(questionnaire).toBeVisible();
  await questionnaire.click();
  await expectAccessibleAtBothWidths(page, 'Requestor questionnaire detail timeline');

  await page.goto('/app/requests');
  await page.getByRole('link', { name: 'Customer portal questionnaire draft request' }).first().click();
  await expectAccessibleAtBothWidths(page, 'Requestor request hub');
  await page.goto('/app');
  await expectAccessibleAtBothWidths(page, 'Requestor dashboard lifecycle cards');

  await signIn(page, 'Security Analyst');
  await page.goto('/app/review/requests');
  await expectAccessibleAtBothWidths(page, 'analyst request queue requires attention');
  await page.getByRole('combobox', { name: 'Queue' }).selectOption('released');
  // Selecting a queue navigates. Scanning mid-navigation reports the transient
  // document as having no title, which is an artefact of the scan timing rather
  // than anything the queue renders.
  await expect(page).toHaveURL(/queue=released/);
  await expect(page.getByRole('main')).toBeVisible();
  await expectAccessibleAtBothWidths(page, 'analyst request queue released');
  /*
   * A released questionnaire the Requestor is still answering is waiting with
   * them, so the request is reached through the explicit awaiting-requestor
   * filter rather than the default action queue.
   */
  await page.goto('/app/review/requests?queue=awaiting-requestor');
  await page.getByRole('link', { name: 'Customer portal questionnaire draft request' }).first().click();
  await expectAccessibleAtBothWidths(page, 'analyst request hub');
});

test('has no axe violations on phase 06.9 assessment lifecycle detail surfaces', async ({ page }) => {
  await signIn(page, 'Security Analyst');
  await page.goto('/app/review/assessments');
  await page.getByRole('link', { name: analystAssessmentNumber }).click();
  await expectAccessibleAtBothWidths(page, 'analyst assessment lifecycle editor');

  await signIn(page, 'Requestor');
  await page.goto('/app/assessments');
  await page.getByRole('link', { name: ownerAssessmentNumber }).click();
  await expectAccessibleAtBothWidths(page, 'Requestor released assessment lifecycle detail');
});
