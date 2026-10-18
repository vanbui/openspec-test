import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
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
  const replacementDialog = page.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  const lifecycleText = await page.locator('text=/Questionnaire generation/').allTextContents().catch(() => []);
  const diagnostic = {
    url: page.url(),
    lifecycleText: lifecycleText.map((text) => text.trim()).filter(Boolean),
    replacementDialogVisible: await replacementDialog.isVisible().catch(() => false),
    // A diagnostic never waits: the link is absent whenever the job is not on the card.
    reviewHref: await review.getAttribute('href', { timeout: 1_000 }).catch(() => null),
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
  await openFromNavigation(page, /^Requests\b/);
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const requestUrl = page.url();
  const generate = page.getByRole('button', { name: 'Generate questionnaire' });
  await expect(generate).toBeVisible();
  // D-29 (12-UI-SPEC §11.1): before anything is sent, the card says how the request's information is classified.
  await expect(
    page.getByText(/^This request’s information is classified (Public|Internal|Restricted|Critical Infrastructure Sensitive)\./),
    'D29_AI_POLICY_CAPTION: the allowed caption names the request’s classification under Generate questionnaire',
  ).toBeVisible();
  /*
   * Phase 15 E2 (15-UI-SPEC §3.1, §16; D-12): the analyst steers the generation with an optional instruction, kept in the
   * field above Generate questionnaire.
   */
  const generationInstruction = page.getByLabel('Instruction for the AI (optional)');
  await expect(generationInstruction, 'E2_INSTRUCTION_ON_GENERATE').toBeVisible();
  await generationInstruction.fill('Cover the offshore support team and payroll data');
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

  // 12-UI-SPEC §14.1 E3: the generated questionnaire says who asked for it, carries help text and offers Not sure.
  // WR-402: on real data, the header names the analyst (the development Security Analyst is the seeded Bob Doe) and
  // the provider and model the generation ran on.
  const provenanceHeader = page.getByRole('region', { name: 'AI generation' });
  await expect(provenanceHeader.getByText('Generated with AI at the request of Bob Doe', { exact: true }), 'E3_PROVENANCE_HEADER').toBeVisible();
  await expect(provenanceHeader, 'E3_PROVENANCE_HEADER names the provider and model').toContainText('Provider: deterministic-questionnaire-generation · Model: 2');
  // Walk D6: the provenance header keeps the page's section rhythm (direction §3.9: 24 to 32px) above the governance panel.
  const headerGap = await page.getByRole('region', { name: 'AI generation' }).evaluate((header) =>
    (header.nextElementSibling?.getBoundingClientRect().top ?? Number.NaN) - header.getBoundingClientRect().bottom);
  expect.soft(headerGap, 'D6: the provenance header sits at least 24px above the governance panel').toBeGreaterThanOrEqual(24);
  expect.soft(headerGap, 'D6: the provenance header sits at most 32px above the governance panel').toBeLessThanOrEqual(32);
  const generatedGovernance = page.getByRole('region', { name: 'Questionnaire governance' });
  await expect(generatedGovernance.getByText(/^Help text: /).first(), 'E3_HELP_TEXT').toBeVisible();
  const providerRow = generatedGovernance.getByRole('listitem').filter({ hasText: 'Is an external provider involved?' });
  await expect(providerRow.getByText(/^Choices: .*Not sure/), 'E3_NOT_SURE').toBeVisible();

  const browserEvents: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') browserEvents.push(`console:${message.type()}:${message.text()}`);
  });
  page.on('pageerror', (error) => browserEvents.push(`pageerror:${error.message}`));
  await test.step('return to the request and open the replacement confirmation', async () => {
    /*
     * A history restore retains the client island from before the first job and
     * can therefore present a stale `action` prop. Reload the authoritative
     * request route before opening the confirmation, rather than deliberately
     * starting an unacknowledged job to make the dialog appear. Strapi still
     * owns the answered, released and eligibility checks once the acknowledged
     * action is submitted.
     */
    await page.goto(requestUrl);
    await expect(page).toHaveURL(/\/app\/review\/requests\/[^/]+$/);
    // WR-06: the generated questionnaire is still in analyst review, so the draft card offers no action yet.
    await expect(page.getByText('Draft generation can begin only after the linked questionnaire is submitted.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate assessment draft' })).toHaveCount(0);
    // UX-06 (D-22): Strapi refuses to return a request to draft once a questionnaire exists, so the rendered hub never offers it.
    await expect(
      page.getByRole('button', { name: 'Return to draft', exact: true }),
      'UX06_NO_REQUEST_REVERT_ONCE_QUESTIONNAIRE_EXISTS: the analyst hub offers no request revert once a questionnaire exists',
    ).toHaveCount(0);
    await dismissToasts(page);
    // E7 (D-08): a questionnaire in analyst review is replaced, never generated over.
    await expect(page.getByRole('button', { name: 'Generate questionnaire' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Replace questionnaire' }).click();
    const replacement = page.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    await expect(replacement).toBeVisible();
    /*
     * Phase 15 E2 (15-UI-SPEC §8.3; D-09, D-12): the unchanged, unanswered questionnaire is offered for replacement, and the
     * confirmation has one description (nothing is lost) followed by the instruction field. Phase 10's change-count
     * descriptions are gone.
     */
    await expect(replacement, 'E2_REPLACE_SINGLE_DESCRIPTION').toContainText('No analyst has changed its questions and the Requestor hasn’t answered it, so nothing is lost.');
    await expect(replacement).not.toContainText('discarding');
    await expect(replacement.getByLabel('Instruction for the AI (optional)'), 'E2_INSTRUCTION_IN_REPLACE').toBeVisible();
    await expect(replacement.getByRole('button', { name: 'Keep this questionnaire' })).toBeVisible();
    const dialogAxe = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
    expect(dialogAxe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => violation.id), 'E2_AXE_REPLACE_DIALOG').toEqual([]);
  });
  /*
   * UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS (UAT-041, D-26; CR-401): while the card shows a queued or running
   * job, the hub offers neither Generate nor Replace, so nobody starts a second job. Strapi answers the start with
   * the job queued, and the card then follows it with status checks (Server Actions posted to this page). The
   * deterministic provider finishes within the first check, so this step holds every status check in the browser
   * while it looks: the card stays on the job Strapi started and cannot move on under the assertions. They run
   * once, outside any retry, after the first check is held. The checks are then released and the job finishes.
   */
  await test.step('confirm replacement and require a new reviewable completion', async () => {
    const replacement = page.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    const requestPath = new URL(requestUrl).pathname;
    const isRequestPage = (url: URL) => url.pathname === requestPath;
    let releaseStatusChecks: () => void = () => undefined;
    const statusChecksReleased = new Promise<void>((resolve) => { releaseStatusChecks = resolve; });
    let heldStatusChecks = 0;
    const holdStatusChecks = async (route: Route) => {
      const sent = route.request();
      // The start itself goes through: it is the one action that acknowledges the replacement.
      const isStatusCheck = sent.method() === 'POST' && sent.headers()['next-action'] !== undefined
        && !(sent.postData() ?? '').includes('replaceUnansweredQuestionnaire');
      if (isStatusCheck) {
        heldStatusChecks += 1;
        await statusChecksReleased;
      }
      await route.fallback();
    };
    await page.route(isRequestPage, holdStatusChecks);
    await replacement.getByRole('button', { name: 'Replace questionnaire' }).press('Enter');
    try {
      // The confirmation closes once Strapi has accepted the replacement and a job exists.
      await expect(replacement).toBeHidden({ timeout: 45_000 });
      /*
       * The status renders twice by design: in the panel and in the polite live region. The start revalidates this
       * page, so a server render that read the job while it ran seeds it as running; either way a job runs.
       */
      const inProgress = page.getByText(/^Questionnaire generation is (queued|running)$/).first();
      await expect(inProgress, 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS: the card shows the job Strapi started').toBeVisible();
      await expect.poll(() => heldStatusChecks, { message: 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS: the card checks the job, and the check is held' }).toBeGreaterThan(0);
      const shown = await inProgress.textContent();
      expect(await inProgress.isVisible(), 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS: the job is still queued or running on the card').toBe(true);
      expect(await page.getByRole('button', { name: 'Generate questionnaire' }).count(), 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS: no Generate questionnaire while a job runs').toBe(0);
      expect(await page.getByRole('button', { name: 'Replace questionnaire' }).count(), 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS: no Replace questionnaire while a job runs').toBe(0);
      test.info().annotations.push({ type: 'UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS', description: `the card showed "${shown}" with ${heldStatusChecks} status check held, and offered neither Generate nor Replace` });
    } finally {
      releaseStatusChecks();
      await page.unroute(isRequestPage, holdStatusChecks);
    }
    try {
      await expect(page.getByText(/Questionnaire generation is (queued|running|ready for review)/).first()).toBeVisible();
    } finally {
      await attachReplacementDiagnostic(page, testInfo, browserEvents);
    }
  });

  /*
   * UX06_JOB_STATUS_ON_RETURN (UAT-041, D-26): the analyst leaves the request after the replacement and comes
   * back. The page reads the jobs on the server, where the browser cannot hold them, and by then the deterministic
   * job has finished; a completed job is not seeded. So this step proves the ending on return: the job's own review
   * link, or the hub's Replace for the new questionnaire in analyst review, and the hub's link to it. That a queued
   * or running job seeded on return shows in place of Generate and Replace is proved where the seed is held, by
   * tests that fail when the card offers its action beside a running job (CR-401): questionnaire-generation-job.test.tsx
   * "shows a queued (or running) job the viewer started in place of Generate and Replace, polled by id" and
   * analyst-route-gate.test.tsx "reads the request generation jobs after the request and shows a running job in place
   * of Generate". In the browser, UX06_NO_GENERATE_OR_REPLACE_WHILE_JOB_RUNS above proves it for a live job.
   */
  await test.step('UX06_JOB_STATUS_ON_RETURN', async () => {
    await openFromNavigation(page, /^Requests\b/);
    await expect(page).toHaveURL(/\/app\/review\/requests(\?.*)?$/);
    await page.goto(requestUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const replaceAction = page.getByRole('button', { name: 'Replace questionnaire' });
    const reviewLink = page.getByRole('link', { name: 'Review generated questionnaire' });
    try {
      await expect.poll(
        async () => await reviewLink.count() + await replaceAction.count(),
        { message: 'UX06_JOB_STATUS_ON_RETURN: the job ends in its review link or the hub offers Replace', timeout: 45_000 },
      ).toBeGreaterThan(0);
    } finally {
      await attachReplacementDiagnostic(page, testInfo, browserEvents);
    }
    // E7 (D-08): a questionnaire in analyst review is replaced, never generated over.
    await expect(page.getByRole('button', { name: 'Generate questionnaire' }), 'UX06_JOB_STATUS_ON_RETURN: no Generate questionnaire over the new questionnaire').toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ }),
      'UX06_JOB_STATUS_ON_RETURN: the hub links the questionnaire',
    ).toHaveAttribute('href', /^\/app\/review\/questionnaires\/[^/]+$/);
  });

  /*
   * Phase 15 E2 (15-UI-SPEC §8.3; D-09): once an analyst changes the replacement's questions, the hub no longer offers
   * Replace and says why, pointing at AI proposals instead.
   */
  await page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ }).click();
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
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

  await page.goto(requestUrl);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace questionnaire' }), 'E2_NO_REPLACE_AFTER_ANALYST_CHANGE').toHaveCount(0);
  const questionnaireCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Questionnaire generation' }) });
  await expect(questionnaireCard.getByText('Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.'), 'E2_ANALYST_CHANGE_LINE').toBeVisible();
  await expect(questionnaireCard.getByRole('link', { name: 'Open AI proposals' }), 'E2_OPEN_AI_PROPOSALS').toHaveAttribute('href', /^\/app\/review\/questionnaires\/[^/]+#ai-proposals$/);
  const cardAxe = await new AxeBuilder({ page }).include('[data-slot="card"]').analyze();
  expect(cardAxe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => violation.id), 'E2_AXE_HUB_CARD').toEqual([]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_GENERATION_DESKTOP_OVERFLOW');
  await expectNoSeriousAxeViolations(page);
});
