import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';

/**
 * Scope is chosen by searching now, not by ticking an enumerated list.
 */
async function chooseRelation(page: Page, label: string): Promise<void> {
  const group = page.getByRole('group', { name: label });
  const combobox = group.getByRole('combobox', { name: `Search ${label.toLowerCase()}` });
  await combobox.fill('e');
  const selected = group.getByRole('list', { name: `Selected ${label}` });
  // Enter takes the first match and is a no-op until the debounced search has
  // returned, so press until a selection lands. This is also the keyboard path
  // a person without a pointer uses.
  await expect(async () => {
    await combobox.press('Enter');
    await expect(selected.getByRole('listitem')).not.toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}


async function signIn(page: Page, role: 'Requestor' | 'Security Analyst'): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: `Continue as ${role}` }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('main')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message }).toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

async function dismissToasts(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
}

async function attachReplacementDiagnostic(page: Page, testInfo: TestInfo, browserEvents: string[]): Promise<void> {
  const replacementDialog = page.getByRole('alertdialog', { name: 'Replace the unanswered questionnaire?' });
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  const lifecycleText = await page.locator('text=/Questionnaire generation/').allTextContents().catch(() => []);
  const diagnostic = {
    url: page.url(),
    lifecycleText: lifecycleText.map((text) => text.trim()).filter(Boolean),
    replacementDialogVisible: await replacementDialog.isVisible().catch(() => false),
    reviewHref: await review.getAttribute('href').catch(() => null),
    browserEvents: browserEvents.slice(-10),
  };
  await testInfo.attach('questionnaire-replacement-state.json', {
    body: Buffer.from(JSON.stringify(diagnostic, null, 2)),
    contentType: 'application/json',
  });
}

/*
 * The journey starts at 375px, where the sidebar is replaced by the navigation
 * drawer, so nav targets are not links on the page until the drawer is opened.
 */
async function openFromNavigation(page: Page, name: string, exact = false): Promise<void> {
  const sidebarLink = page.getByRole('link', { name, exact });
  if (await sidebarLink.count() > 0 && await sidebarLink.first().isVisible()) {
    await sidebarLink.first().click();
    return;
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name, exact }).click();
}

test('Security Analyst generates, replaces, and reviews a contextual questionnaire safely', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);

  const title = `Questionnaire generation journey ${Date.now()}`;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page, 'Requestor');
  await openFromNavigation(page, 'My Requests');
  await openFromNavigation(page, 'New request');
  await page.getByRole('textbox', { name: 'Request title' }).fill(title);
  await page.getByRole('textbox', { name: 'Description' }).fill('A bounded request used to verify the questionnaire generation journey.');
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
  await page.getByRole('textbox', { name: 'Division' }).fill('Digital Services');
  await page.getByRole('textbox', { name: 'Business unit' }).fill('Customer Platforms');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Verify generated questionnaire review.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
  await chooseRelation(page, 'Information systems');
  await chooseRelation(page, 'Information assets');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Submit request' }).click();
  const submitConfirmation = page.getByRole('alertdialog', { name: 'Submit this assessment request?' });
  await submitConfirmation.getByRole('button', { name: 'Submit request' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_GENERATION_MOBILE_OVERFLOW');

  await page.context().clearCookies();
  await signIn(page, 'Security Analyst');
  await openFromNavigation(page, 'Assessment Requests', true);
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const requestUrl = page.url();
  const generate = page.getByRole('button', { name: 'Generate questionnaire' });
  await expect(generate).toBeVisible();
  await generate.focus();
  await page.keyboard.press('Enter');
  // The status renders twice by design: in the panel and in the polite live
  // region that announces the change.
  await expect(page.getByText(/Questionnaire generation is (running|ready for review)/).first()).toBeVisible();
  await expect(page.getByText('Questionnaire generation is ready for review').first()).toBeVisible({ timeout: 45_000 });
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  await expect(review).toHaveAttribute('href', /^\/app\/review\/questionnaires\/[^/]+$/);
  await review.click();
  // Wait for the review route itself rather than for "a heading": the request
  // page has four, so a bare heading assertion passes before navigation and
  // then trips strict mode.
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
  // Domain numbers use the Crockford base32 alphabet, matching RAR and ASM.
  await expect(page.getByText(/QNR-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}/).first()).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  const browserEvents: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') browserEvents.push(`console:${message.type()}:${message.text()}`);
  });
  page.on('pageerror', (error) => browserEvents.push(`pageerror:${error.message}`));
  await test.step('return to the request and open replacement acknowledgement', async () => {
    /*
     * A history restore retains the client island from before the first job and
     * can therefore present a stale `hasExistingQuestionnaire` prop. Reload the
     * authoritative request route before opening the acknowledgement, rather
     * than deliberately starting an unacknowledged job to make the dialog
     * appear. Strapi still owns the answered-questionnaire and eligibility
     * checks once the acknowledged action is submitted.
     */
    await page.goto(requestUrl);
    await expect(page).toHaveURL(/\/app\/review\/requests\/[^/]+$/);
    await dismissToasts(page);
    await page.getByRole('button', { name: 'Generate questionnaire' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Replace the unanswered questionnaire?' })).toBeVisible();
  });
  await test.step('confirm replacement and require a new reviewable completion', async () => {
    const replacement = page.getByRole('alertdialog', { name: 'Replace the unanswered questionnaire?' });
    await replacement.getByRole('button', { name: 'Replace unanswered questionnaire' }).press('Enter');
    try {
      await expect(page.getByText('Questionnaire generation is ready for review').first()).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole('link', { name: 'Review generated questionnaire' })).toHaveAttribute('href', /^\/app\/review\/questionnaires\/[^/]+$/);
    } finally {
      await attachReplacementDiagnostic(page, testInfo, browserEvents);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_GENERATION_DESKTOP_OVERFLOW');
  await expectNoSeriousAxeViolations(page);
});
