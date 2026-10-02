import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { openFromNavigation, signInAs } from './helpers/navigation';

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
 * sheet, so navigation targets are reached through the Menu sheet
 * (`openFromNavigation` in e2e/helpers/navigation.ts).
 */
test('Security Analyst generates, replaces, and reviews a contextual questionnaire safely', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);

  const title = `Questionnaire generation journey ${Date.now()}`;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInAs(page, 'Requestor');
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
  await signInAs(page, 'Security Analyst');
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

  /*
   * QUES08_ADD_TO_GENERATED_SECTIONS (UAT-016, D-05): the deterministic provider opens its first section,
   * Request context, at order 0. A question added to it, and one added to a new section, each save on the
   * first try and appear under their sections.
   */
  await test.step('QUES08_ADD_TO_GENERATED_SECTIONS', async () => {
    const governance = page.getByRole('region', { name: 'Questionnaire governance' });
    const addedToContext = 'Who owns the service day to day?';
    await governance.getByRole('button', { name: 'Add question', exact: true }).click();
    await governance.getByLabel('Question text').fill(addedToContext);
    await governance.getByLabel('Section', { exact: true }).selectOption({ label: 'Request context' });
    await governance.getByRole('button', { name: 'Save question' }).click();
    await expect(
      governance.getByRole('list', { name: 'Request context' }).getByText(addedToContext, { exact: true }),
      'QUES08_ADD_TO_GENERATED_SECTIONS: a question added to a generated section appears under it',
    ).toBeVisible();

    const addedToNewSection = 'Which offshore teams support the service?';
    await governance.getByRole('button', { name: 'Add question', exact: true }).click();
    await governance.getByLabel('Question text').fill(addedToNewSection);
    await governance.getByLabel('Section', { exact: true }).selectOption({ label: 'New section' });
    await governance.getByLabel('New section title').fill('Offshore support');
    await governance.getByRole('button', { name: 'Save question' }).click();
    await expect(
      governance.getByRole('list', { name: 'Offshore support' }).getByText(addedToNewSection, { exact: true }),
      'QUES08_ADD_TO_GENERATED_SECTIONS: a question added to a new section appears under it',
    ).toBeVisible();
    await expect(governance.getByRole('alert'), 'QUES08_ADD_TO_GENERATED_SECTIONS: neither save is refused').toHaveCount(0);
  });

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
    // WR-06: the generated questionnaire is still in analyst review, so the draft card offers no action yet.
    await expect(page.getByText('Draft generation can begin only after the linked questionnaire is submitted.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate assessment draft' })).toHaveCount(0);
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
