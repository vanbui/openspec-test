import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl, webOrigin } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { completeRiskForRelease, confirmRemainingToastText, expectDecisionRecorded, selectOwner } from './helpers/assessment-release';
import { signInAs } from './helpers/navigation';

const submittedRequestTitle = 'Customer portal release 4.2 self-service changes';
const deterministicRiskStatement = 'Internet exposure may increase the likelihood of unauthorised access to the service.';

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      { message },
    )
    .toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

function expectEncodedRecordPath(href: string | null, prefix: string): string {
  expect(href).toMatch(new RegExp(`^${prefix}[^/]+$`));
  const encodedDocumentId = href!.slice(prefix.length);
  expect(encodeURIComponent(decodeURIComponent(encodedDocumentId))).toBe(encodedDocumentId);
  return href!;
}

async function expectRelationshipLinkAtBothViewports(
  page: Page,
  link: Locator,
  href: string,
  label: string,
): Promise<void> {
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(link, `${label} is visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `${label} has no horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await link.click();
  await expect(page, `${label} opens its authorised route`).toHaveURL(new URL(href, webOrigin).href);
}

test('Bob reviews, drafts, edits, and releases an assessment that Jane reads without mutation access', async ({ browser, page, request }) => {
  test.setTimeout(240_000);

  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) {
    throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  }

  // Every document this journey loads runs under the production CSP, and none may raise a violation (D-19).
  await attachCspCollector(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signInAs(page, 'Security Analyst');
  await expectNoHorizontalOverflow(page, 'ASSESS-01 analyst mobile shell has no horizontal overflow');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' }), 'ASSESS-01 keyboard skip link').toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Menu', exact: true }), 'ASSESS-01 keyboard navigation trigger').toBeFocused();
  await page.keyboard.press('Enter');

  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigation.getByRole('link', { name: 'Questionnaires', exact: true }), 'BASELINE_ANALYST_QUESTIONNAIRE_NAVIGATION').toBeVisible();
  // Its name gains its count when the queue holds work ("Requests, 9 waiting for pick-up", 13 D-14), so it is anchored, not exact.
  const reviewRequests = navigation.getByRole('link', { name: /^Requests\b/ });
  expect(await reviewRequests.count(), 'Phase 4 capability unmet: analyst review queue is available').toBe(1);

  await reviewRequests.click();
  await expect(page).toHaveURL(/\/app\/review\/requests$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Requests', exact: true }), 'ASSESS-01 authorised analyst queue').toBeVisible();
  await expectNoHorizontalOverflow(page, 'ASSESS-01 analyst request queue has no mobile overflow');
  await expectNoSeriousAxeViolations(page);

  const submittedRequest = page.getByRole('link', { name: submittedRequestTitle });
  await expect(submittedRequest, 'ASSESS-01 submitted request is available for review').toHaveCount(1);
  const submittedRequestHref = await submittedRequest.getAttribute('href');
  expect(submittedRequestHref).toMatch(/^\/app\/review\/requests\/[^/]+$/);

  const crossOwnerRequest = page.getByRole('link', { name: 'Azure Pipeline Decorator for all delivery pipelines' });
  const crossOwnerHref = await crossOwnerRequest.getAttribute('href');
  expect(crossOwnerHref).toMatch(/^\/app\/review\/requests\/[^/]+$/);

  await submittedRequest.click();
  await expect(page.getByRole('heading', { name: submittedRequestTitle })).toBeVisible();
  // The request hub opens a record from its own identifier, so the questionnaire
  // is reached by its link destination rather than by a separate Open control.
  // Read inside the hub's relationships: below 768px the lifecycle stepper's next action ("Draft the
  // assessment.") also links to the questionnaire, and from 768px it is hidden (UI-SPEC §6.2, E18).
  const questionnaireLink = page.getByRole('region', { name: 'Request relationships' }).locator('a[href^="/app/review/questionnaires/"]').first();
  const questionnaireHref = expectEncodedRecordPath(
    await questionnaireLink.getAttribute('href'),
    '/app/review/questionnaires/',
  );
  await expectRelationshipLinkAtBothViewports(
    page,
    questionnaireLink,
    questionnaireHref,
    'ASSESS-01 authorised questionnaire relationship',
  );
  await expect(page.getByRole('heading', { name: 'Customer portal cyber risk questionnaire' }), 'ASSESS-01 submitted answers are reviewable').toBeVisible();
  await expect(page.getByText('Contact details'), 'ASSESS-01 authoritative questionnaire answer').toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.goto(submittedRequestHref!);

  const startDraft = page.getByRole('button', { name: 'Generate assessment draft' });
  await expect(startDraft, 'ASSESS-02 analyst owns the explicit draft action').toBeEnabled();
  await startDraft.click();
  await expect(page.getByText('Draft generation is queued', { exact: true }).last(), 'ASSESS-02 queued draft state is observable').toBeVisible();
  await expect(page.getByText('Draft generation is ready for Security Analyst review', { exact: true }).last(), 'ASSESS-02 completed draft state is observable').toBeVisible();
  const lifecycle = page.getByRole('list', { name: 'Draft generation lifecycle' });
  await expect(lifecycle, 'ASSESS-02 persisted lifecycle records queued, running, and completed states').toContainText('Queued');
  await expect(lifecycle).toContainText('Running');
  await expect(lifecycle).toContainText('Completed');

  const assessmentLink = page.getByRole('link', { name: 'Open assessment draft' });
  await expect(assessmentLink, 'ASSESS-02 the generated draft opens for human review').toBeVisible();
  const assessmentHref = expectEncodedRecordPath(
    await assessmentLink.getAttribute('href'),
    '/app/review/assessments/',
  );

  await expectRelationshipLinkAtBothViewports(
    page,
    assessmentLink,
    assessmentHref,
    'ASSESS-02 authorised assessment relationship',
  );
  await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
  await expect(page.getByText(/ASM-\d{4}-/)).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first(), 'ASSESS-02 generated output is not released').toBeVisible();
  // UAT-032 (12-UI-SPEC §1): the analyst editor opens with who asked for the AI generation, and the provider and model
  // it ran on (WR-402): the development Security Analyst is the seeded Bob Doe, and the deterministic draft provider's model is 2.
  const provenanceHeader = page.getByRole('region', { name: 'AI generation' });
  await expect(provenanceHeader.getByText('Generated with AI at the request of Bob Doe', { exact: true }), 'UAT032_ANALYST_PROVENANCE_HEADER').toBeVisible();
  await expect(provenanceHeader, 'UAT032_ANALYST_PROVENANCE_HEADER names the provider and model').toContainText('Provider: deterministic-assessment-draft · Model: 2');

  await page.getByRole('combobox', { name: 'Overall control effectiveness' }).selectOption('Partially Effective');
  const assessmentSaveResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
  const saveAssessment = page.getByRole('button', { name: 'Save assessment' });
  await saveAssessment.click();
  expect((await assessmentSaveResponse).ok(), 'ASSESS-03 assessment conclusion persisted').toBe(true);
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();

  // D-33, UI-SPEC §13.4: a changed save confirms beside Save assessment with its time; saving the same details
  // again sends nothing and says so in the same region (walkthrough fix 1).
  const detailsStatus = page.locator('[data-slot="form-actions"]').filter({ has: saveAssessment }).getByRole('status');
  await expect(detailsStatus, 'ASSESS06_DETAILS_SAVE_CONFIRMED the changed save confirms with its time').toHaveText(/^Assessment details saved at /);
  const unchangedSaveWrites: string[] = [];
  const recordWrite = (sent: { method(): string; url(): string }) => {
    if (sent.method() !== 'GET') unchangedSaveWrites.push(`${sent.method()} ${sent.url()}`);
  };
  page.on('request', recordWrite);
  await saveAssessment.click();
  await expect(detailsStatus, 'ASSESS06_UNCHANGED_SAVE_NOTED an unchanged save says so in the same region').toHaveText('No changes to save.');
  // IN-408: keep listening after the note renders, so a write sent after it (a note shown first, then a Server
  // Action) is caught. The wait ends early, and the expectation below fails, on the first such request.
  await page.waitForRequest((sent) => sent.method() !== 'GET', { timeout: 2_000 }).catch(() => undefined);
  page.off('request', recordWrite);
  expect(unchangedSaveWrites, 'ASSESS06_UNCHANGED_SAVE_WRITES_NOTHING an unchanged save sends no request').toEqual([]);
  await expect(page.getByText('In review', { exact: true }).first(), 'ASSESS06_UNCHANGED_SAVE_WRITES_NOTHING the review stands').toBeVisible();

  const readinessRequirements = page.getByRole('list', { name: 'Release requirements' });
  // E10 (D-35, UI-SPEC §14.1): one row per Risk, named `{risk number}: {n} outstanding`, saying what is missing.
  const outstandingRiskLinks = readinessRequirements.getByRole('link', { name: /^RSK-\S+: \d+ outstanding$/ });
  const outstandingRiskHrefs = await outstandingRiskLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(new Set(outstandingRiskHrefs).size, 'ASSESS-03 named Risk requirements keep distinct record destinations').toBeGreaterThanOrEqual(3);
  expect(outstandingRiskHrefs.length, 'ASSESS06_READINESS_BY_RISK one readiness row per Risk, never one per requirement').toBe(new Set(outstandingRiskHrefs).size);
  for (const href of new Set(outstandingRiskHrefs)) {
    expect(href, 'ASSESS-03 Risk requirement uses a same-page anchor').toMatch(/^#risk-/);
    await expect(page.locator(href!), `ASSESS-03 Risk destination ${href} exists`).toBeVisible();
  }
  // WR-406: every Risk row, not only the first, carries its `Missing:` caption as its accessible description.
  for (const [index, row] of (await outstandingRiskLinks.all()).entries()) {
    await expect(row, `ASSESS06_READINESS_BY_RISK Risk row ${index + 1} says what is missing`).toHaveAccessibleDescription(/^Missing: /);
  }
  await expect(readinessRequirements.getByText(/^Missing: /), 'ASSESS06_READINESS_BY_RISK one caption per Risk row').toHaveCount(outstandingRiskHrefs.length);
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(readinessRequirements, `ASSESS-03 readiness requirements are visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `ASSESS-03 readiness requirements have no overflow at ${width}px`);
  }
  // UI-D27: following a readiness link moves focus to its Risk card.
  const followedRiskHref = outstandingRiskHrefs[0]!;
  await outstandingRiskLinks.first().click();
  await expect(page.locator(followedRiskHref), 'ASSESS06_READINESS_BY_RISK following a Risk row moves focus to its Risk').toBeFocused();

  const rating = page.getByRole('combobox', { name: 'Residual rating' }).first();
  await rating.selectOption('Moderate');
  await completeRiskForRelease(page, 0, 'Treat');
  await completeRiskForRelease(page, 1, 'Accept');
  await completeRiskForRelease(page, 2, 'Accept');
  await completeRiskForRelease(page, 3, 'Accept');
  await expect(rating, 'ASSESS-03 edited rating remains selected').toHaveValue('Moderate');

  await page.getByRole('button', { name: 'Add mitigation control' }).first().click();
  const firstControlRegion = page.getByRole('region', { name: /Mitigation controls for/ }).first();
  const controlForm = firstControlRegion.locator('form');
  // E11 (D-28, D-31): the Control field is a searchable picker. `exact` because Control owner and Control
  // status share its prefix. The Risk Type's applicable controls come first; typing searches the library.
  const controlPicker = controlForm.getByRole('combobox', { name: 'Control', exact: true });
  await expect(controlPicker, 'ASSESS-06 the new form opens with focus in its Control picker').toBeFocused();
  await controlPicker.click();
  await expect(page.getByRole('group', { name: /^Applicable to / }), 'ASSESS06_APPLICABLE_CONTROLS_FIRST the Risk Type’s controls are offered first').toBeVisible();
  // D-46, D-29: a word from a loaded control title finds the control through the same control search.
  await controlPicker.fill('masking');
  const titleWordOption = page.getByRole('option', { name: '8.11 · Data masking' });
  await expect(titleWordOption, 'ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD a word from its title finds the control').toBeVisible();
  expect(await titleWordOption.getAttribute('aria-label'), 'ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD the option starts with its number and name').toMatch(/^8\.11 · Data masking/);
  await controlPicker.fill('APP-11');
  const controlOption = page.getByRole('option', { name: /^APP-11 · / });
  await expect(controlOption, 'ASSESS06_CONTROL_PICKED_BY_TYPING typing finds the control by its number').toBeVisible();
  const controlLabel = await controlOption.getAttribute('aria-label');
  expect(controlLabel, 'ASSESS06_CONTROL_PICKED_BY_TYPING the control reads by its number and title').toMatch(/^APP-11 · \S/);
  await controlOption.click();
  await expect(controlForm.getByText(`Selected control: ${controlLabel}`, { exact: true }), 'ASSESS06_CONTROL_PICKED_BY_TYPING the choice shows below the field').toBeVisible();
  // E11 (D-28): the control owner is found with the active-user search, not chosen from names already on the Risk.
  await selectOwner(controlForm.getByRole('combobox', { name: 'Control owner' }));
  await expect(controlForm.getByText('Selected owner: Jane Doe', { exact: true })).toBeVisible();
  await controlForm.getByRole('combobox', { name: 'Control status' }).selectOption('Planned');
  await controlForm.getByRole('combobox', { name: 'Effectiveness rating' }).selectOption('Partially Effective');
  await controlForm.getByRole('textbox', { name: 'Evidence' }).fill('Control selected from the reusable catalogue and scheduled for verification.');
  await controlForm.getByRole('textbox', { name: 'Implementation due date' }).fill('2027-03-31');
  await controlForm.getByRole('textbox', { name: 'Implemented date' }).fill('2027-02-28');
  await controlForm.getByRole('textbox', { name: 'Review date' }).fill('2027-08-30');
  const controlSaveResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
  await controlForm.getByRole('button', { name: 'Add mitigation control' }).click();
  expect((await controlSaveResponse).ok(), 'ASSESS-03 ControlImplementation persisted').toBe(true);
  // UI-SPEC §13.4: the new control's form confirms the create, and focus returns to that Risk's add control.
  await expect(
    firstControlRegion.getByRole('status').filter({ hasText: /^Mitigation control added at / }),
    'ASSESS06_CONTROL_ADD_CONFIRMED the new control confirms when it was added',
  ).toBeVisible();
  await expect(
    firstControlRegion.getByRole('button', { name: 'Add mitigation control' }),
    'ASSESS06_CONTROL_ADD_CONFIRMED focus returns to Add mitigation control',
  ).toBeFocused();
  await page.reload();
  const persistedControl = firstControlRegion.locator('form').filter({ has: page.getByRole('button', { name: 'Save mitigation control' }) });
  await expect(persistedControl.getByText(`Selected control: ${controlLabel}`, { exact: true }), 'ASSESS06_CONTROL_PICKED_BY_TYPING the chosen control is saved and read back by its label').toBeVisible();
  await expect(persistedControl.getByText('Selected owner: Jane Doe', { exact: true }), 'E11 the searched control owner is saved and read back by name').toBeVisible();
  await expect(persistedControl.getByRole('textbox', { name: 'Evidence' })).toHaveValue('Control selected from the reusable catalogue and scheduled for verification.');
  await expect(readinessRequirements, 'E1_AI_REVIEW_OUTSTANDING unreviewed proposals block release').toContainText('Review of AI proposals');
  /*
   * A decision re-reads the assessment, which can reorder the Risks, so each pass takes the first remaining Confirm
   * remaining. WR-401: each pass waits for its own outcome, the success toast naming its count and record, with no
   * danger toast, never for an HTTP status (a refused Server Action still answers 200).
   */
  const confirmRemaining = page.getByRole('button', { name: /^Confirm remaining \(\d+\)/ });
  for (let pass = 0; pass < 12 && await confirmRemaining.count() > 0; pass += 1) {
    const confirm = confirmRemaining.first();
    const name = String(await confirm.getAttribute('aria-label'));
    await confirm.focus();
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');
    const confirmed = await expectDecisionRecorded(page, confirmRemainingToastText(name), `E1_AI_REVIEW_CONFIRMED ${name}`);
    await expect(page.getByRole('button', { name, exact: true }), `E1_AI_REVIEW_CONFIRMED ${name} leaves nothing to confirm`).toHaveCount(0);
    const closeToast = confirmed.locator('[data-close-button]');
    if (await closeToast.count()) await closeToast.click();
  }
  await expect(confirmRemaining, 'E1_AI_REVIEW_CONFIRMED every record’s AI proposals are reviewed').toHaveCount(0);
  await page.reload();
  await expect(page.getByText('All release requirements are met'), 'ASSESS-03 persisted edits satisfy release readiness').toBeVisible();
  await expect(readinessRequirements, 'ASSESS06_READINESS_BY_RISK nothing outstanding is listed once all are met').toHaveCount(0);
  // D-35: met items show only when the analyst asks.
  const metRequirements = page.getByRole('list', { name: 'Met release requirements' });
  await expect(metRequirements, 'ASSESS06_READINESS_BY_RISK met items stay hidden until asked for').toBeHidden();
  await page.getByRole('button', { name: /^Show met requirements \(\d+\)$/ }).click();
  await expect(metRequirements, 'ASSESS06_READINESS_BY_RISK the met requirements show on demand').toBeVisible();
  await expect(metRequirements, 'ASSESS-03 readiness state is explicit').toContainText('Met');
  await expect(page.getByRole('button', { name: 'Hide met requirements' })).toHaveAttribute('aria-expanded', 'true');

  await expect(page.getByText(deterministicRiskStatement, { exact: true }), 'ASSESS-02 deterministic semantic risk is present').toBeVisible();
  const prereleaseAssessmentUrl = page.url();

  const prereleaseContext = await browser.newContext({
    baseURL: webOrigin,
    viewport: { width: 375, height: 812 },
  });
  const prereleasePage = await prereleaseContext.newPage();
  await attachCspCollector(prereleasePage);
  await signInAs(prereleasePage, 'Requestor');
  await prereleasePage.goto(prereleaseAssessmentUrl);
  // The analyst route refuses the Requestor before any read (D-23), so the prerelease assessment stays secret.
  await expect(prereleasePage.getByRole('main').getByRole('heading', { level: 1, name: 'Risk assessment review', exact: true }), 'ASSESS-05 prerelease assessment is secret').toBeVisible();
  await expect(prereleasePage.getByText('You don’t have permission to review this assessment')).toBeVisible();
  await expect(prereleasePage.getByText(deterministicRiskStatement, { exact: true })).toHaveCount(0);
  // The analyst questionnaire route refuses her the same way, and shows no question.
  await prereleasePage.goto(questionnaireHref);
  await expect(prereleasePage.getByRole('link', { name: 'Go to My Questionnaires' }), 'UX06_REQUESTOR_ON_ANALYST_QUESTIONNAIRE_ROUTE').toHaveAttribute('href', '/app/questionnaires');
  await expect(prereleasePage.getByText('Contact details')).toHaveCount(0);
  await expect(prereleasePage.getByRole('heading', { name: 'Customer portal cyber risk questionnaire' })).toHaveCount(0);
  // D-22, UI-SPEC §8.2 and §10.1: the assessment draft exists, so the Requestor's own questionnaire offers no return to draft and says why.
  await prereleasePage.goto(`/app/questionnaires/${questionnaireHref.slice('/app/review/questionnaires/'.length)}`);
  await expect(prereleasePage.getByRole('heading', { name: 'Customer portal cyber risk questionnaire' }), 'UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT').toBeVisible();
  await expect(prereleasePage.getByText('Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.'), 'UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT').toBeVisible();
  await expect(prereleasePage.getByRole('button', { name: 'Return to draft' }), 'UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT').toHaveCount(0);
  await prereleasePage.goto(crossOwnerHref!);
  await expect(prereleasePage.getByText('You don’t have permission to review this request'), 'ASSESS-05 cross-owner assessment is denied').toBeVisible();
  // Jane's own request on the analyst route: the gate refuses her before the read and points to her own list (D-23).
  await prereleasePage.goto(submittedRequestHref!);
  for (const width of [375, 1440] as const) {
    await prereleasePage.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(prereleasePage.getByText('You don’t have permission to review this request'), `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE refused at ${width}px`).toBeVisible();
    await expect(prereleasePage.getByRole('link', { name: 'Go to My Requests' }), `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE points to her own requests at ${width}px`).toHaveAttribute('href', '/app/requests');
    await expect(prereleasePage.getByRole('button', { name: /^(Generate|Return to draft)/ }), `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE offers no analyst action at ${width}px`).toHaveCount(0);
    await expect(prereleasePage.locator('a[href^="/app/review"]'), `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE links nowhere into the analyst routes at ${width}px`).toHaveCount(0);
    await expectNoHorizontalOverflow(prereleasePage, `UX06_REQUESTOR_ON_ANALYST_REQUEST_ROUTE has no overflow at ${width}px`);
  }
  await prereleasePage.setViewportSize({ width: 375, height: 812 });
  await expectNoCspViolations(prereleasePage, 'the Requestor before release');
  await prereleaseContext.close();

  /*
   * The submitted request is one-shot: this pass releases it, so a second pass in another project
   * would find nothing left to release. Both widths are therefore proved at each stage inside this
   * pass (D-41). Here, the completed editor before release.
   */
  const identifiedRisks = page.getByRole('region', { name: 'Identified Risks' });
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(page.getByRole('button', { name: 'Save assessment' }), `ASSESS-03 the assessment form is shown at ${width}px`).toBeVisible();
    await expect(identifiedRisks.locator('form').first().getByRole('button', { name: 'Save risk' }), `ASSESS-03 the first Risk form is shown at ${width}px`).toBeVisible();
    await expect(page.getByText(deterministicRiskStatement, { exact: true }), `ASSESS-03 the drafted Risk is shown at ${width}px`).toBeVisible();
    await expect(page.getByText('All release requirements are met'), `ASSESS-03 release readiness is shown at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `ASSESS-03 analyst assessment editor has no overflow at ${width}px`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectNoHorizontalOverflow(page, 'ASSESS-03 analyst assessment editor has no desktop overflow');
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('button', { name: 'Release assessment' }).click();
  const releaseDialog = page.getByRole('alertdialog', { name: 'Release this risk assessment?' });
  await expect(releaseDialog, 'ASSESS-04 release requires explicit confirmation').toContainText(/read-only|cannot be undone|irreversible/i);
  await releaseDialog.getByRole('button', { name: 'Confirm release' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Assessment released', { exact: true })).toBeVisible();
  // The header badge states the assessment status. Its stored value stays approved; it reads Released.
  const releasedStatus = page.locator('.page-header [data-slot="badge"]');
  await expect(releasedStatus, 'ASSESS-04 analyst performs the release').toHaveText('Released');
  await expect(releasedStatus, 'ASSESS-04 the released status is the tinted success badge').toHaveAttribute('data-tone', 'success');
  await expect(page.getByRole('button', { name: /save|add|edit|remove|release/i })).toHaveCount(0);

  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  // E14 (UI-SPEC §5.2): the Requestor Home's Released assessments names each item by its request title, newest first.
  const releasedRegion = page.getByRole('region', { name: 'Released assessments', exact: true });
  const releasedItem = releasedRegion.getByRole('list', { name: 'Released risk assessments' }).getByRole('listitem')
    .filter({ hasText: submittedRequestTitle });
  await expect(releasedItem, 'ASSESS-05 Jane’s Home lists the released assessment by its request title').toHaveCount(1);
  const releasedAssessment = releasedItem.getByRole('link', { name: /ASM-\d{4}-/ });
  await expect(releasedAssessment, 'ASSESS-05 released assessment identifier is the only record opener').toHaveCount(1);
  await expect(releasedAssessment).toHaveAttribute('href', /^\/app\/assessments\/[^/]+$/);
  // The shared record-link treatment (direction §4 Record links), owned by the record-link class.
  await expect(releasedAssessment).toHaveClass(/\brecord-link\b/);
  // The list is a real <ul>/<li>, so the row carries the listitem role
  // implicitly and has no role attribute for an XPath predicate to match.
  const releasedCard = releasedAssessment.locator('xpath=ancestor-or-self::li[1]');
  await expect(releasedCard).not.toHaveAttribute('tabindex');
  await expect(releasedCard).not.toHaveAttribute('role', 'link');
  await expect(releasedCard.getByRole('link')).toHaveCount(1);
  await expect(releasedCard.getByRole('button', { name: /open asm-/i })).toHaveCount(0);
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(releasedAssessment, `ASSESS-05 released identifier is visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `ASSESS-05 released list has no horizontal overflow at ${width}px`);
  }
  await releasedAssessment.focus();
  await expect(releasedAssessment, 'ASSESS-05 released identifier is the keyboard focus target').toBeFocused();
  await releasedAssessment.click();

  await expect(page.getByRole('heading', { name: 'Released risk assessment' })).toBeVisible();
  // The released view at both widths, in the same pass (D-41): the record, its Risk and its mitigation controls.
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(page.getByRole('article', { name: /Released risk assessment ASM-/ }), `ASSESS-05 the released assessment is shown at ${width}px`).toBeVisible();
    await expect(page.getByText(deterministicRiskStatement, { exact: true }), `ASSESS-05 the released Risk is shown at ${width}px`).toBeVisible();
    await expect(page.getByRole('region', { name: 'Mitigation control implementations' }).first(), `ASSESS-05 the mitigation controls are shown at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `ASSESS-05 released assessment has no overflow at ${width}px`);
  }
  await expect(page.getByRole('article', { name: /Released risk assessment ASM-/ })).toBeVisible();
  await expect(page.getByText(deterministicRiskStatement, { exact: true }), 'ASSESS-05 Jane sees the released risk').toBeVisible();
  // UAT-032 (12-UI-SPEC §10, D-23): Jane learns that AI assisted and an analyst reviewed, and sees no generator row.
  const overview = page.getByRole('heading', { level: 2, name: 'Assessment overview' }).locator('..');
  await expect(overview.getByText('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.'), 'UAT032_REQUESTOR_AI_NOTICE').toBeVisible();
  await expect(overview.locator('dt:text-is("Generated by")'), 'UAT032_REQUESTOR_AI_NOTICE no generator row').toHaveCount(0);
  // E12 (D-34, D-36): Jane reads the control the analyst picked by its number and title, never by its internal id.
  const releasedMitigation = page.getByRole('region', { name: 'Mitigation control implementations' }).first();
  const [pickedControlNumber, pickedControlTitle] = controlLabel!.split(' · ');
  await expect(releasedMitigation, 'ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE the control number shows').toContainText(pickedControlNumber!);
  await expect(releasedMitigation, 'ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE the control title shows').toContainText(pickedControlTitle!);
  await expect(releasedMitigation.getByText(controlLabel!, { exact: true }), 'ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE Jane sees the persisted control by its label').toBeVisible();
  expect(await releasedMitigation.innerText(), 'ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE no document id shows').not.toMatch(/\b[a-z0-9]{24}\b/);
  // ASSESS-07 (D-34): Jane reads each Risk's treatment, owners and target date as the analyst recorded them.
  const releasedRisks = page.getByRole('region', { name: 'Identified risks' });
  await expect(releasedRisks.getByText('Implement and verify the selected reusable mitigation control.', { exact: true }), 'ASSESS07_TREATMENT_AND_OWNERS_VISIBLE the treatment plan').toBeVisible();
  await expect(releasedRisks.locator('dt:text-is("Risk owner") + dd').first(), 'ASSESS07_TREATMENT_AND_OWNERS_VISIBLE the risk owner').toHaveText('Jane Doe');
  await expect(releasedRisks.locator('dt:text-is("Treatment owner") + dd').first(), 'ASSESS07_TREATMENT_AND_OWNERS_VISIBLE the treatment owner').toHaveText('Jane Doe');
  await expect(releasedRisks.locator('dt:text-is("Target date") + dd').first(), 'ASSESS07_TREATMENT_AND_OWNERS_VISIBLE the target date').toHaveText('30 August 2027');
  const releasedMain = page.getByRole('main');
  await expect(releasedMain.getByRole('form')).toHaveCount(0);
  await expect(releasedMain.getByRole('textbox')).toHaveCount(0);
  await expect(releasedMain.getByRole('combobox')).toHaveCount(0);
  await expect(releasedMain.getByRole('button', { name: /save|add|edit|remove|release/i }), 'ASSESS-05 Requestor has no mutation controls').toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'ASSESS-05 released assessment has no desktop overflow');
  await expectNoSeriousAxeViolations(page);

  // Released or not, the analyst route still refuses Jane before any read: her copy is the released view.
  await page.goto(prereleaseAssessmentUrl);
  await expect(page.getByText('You don’t have permission to review this assessment'), 'UX06_REQUESTOR_ON_ANALYST_ASSESSMENT_ROUTE_AFTER_RELEASE').toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to My Risk Assessments' })).toHaveAttribute('href', '/app/assessments');
  await expect(page.getByText(deterministicRiskStatement, { exact: true })).toHaveCount(0);
  await expectNoCspViolations(page, 'the release journey');
});
