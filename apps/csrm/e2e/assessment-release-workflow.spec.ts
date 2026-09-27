import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl, webOrigin } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { signInAs } from './helpers/navigation';

const submittedRequestTitle = 'Customer portal security assessment';
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

async function selectOwner(ownerPicker: Locator): Promise<void> {
  await ownerPicker.fill('Jane');
  await ownerPicker.page().getByRole('option', { name: 'Jane Doe' }).click();
}

async function completeRiskForRelease(
  page: Page,
  index: number,
  treatmentAction: 'Accept' | 'Treat',
): Promise<void> {
  const riskForm = page.getByRole('region', { name: 'Identified Risks' }).locator('form').nth(index);
  await riskForm.getByRole('textbox', { name: 'Inherent likelihood' }).fill('Likely');
  await riskForm.getByRole('textbox', { name: 'Highest inherent consequence' }).fill('Major');
  await riskForm.getByRole('textbox', { name: 'Residual likelihood' }).fill('Possible');
  await riskForm.getByRole('textbox', { name: 'Highest residual consequence' }).fill('Moderate');
  await selectOwner(riskForm.getByRole('combobox', { name: 'Risk owner' }));
  await riskForm.getByRole('combobox', { name: 'Treatment action' }).selectOption(treatmentAction);
  await riskForm.getByRole('textbox', { name: 'Target date' }).fill('2027-08-30');

  if (treatmentAction === 'Treat') {
    await riskForm.getByRole('textbox', { name: 'Treatment plan' }).fill('Implement and verify the selected reusable mitigation control.');
    await selectOwner(riskForm.getByRole('combobox', { name: 'Treatment owner' }));
    await riskForm.getByRole('textbox', { name: 'Treatment resolve date' }).fill('2027-06-30');
  }

  const saveResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
  await riskForm.getByRole('button', { name: 'Save risk' }).click();
  expect((await saveResponse).ok(), `ASSESS-03 risk ${index + 1} persisted`).toBe(true);
  await page.reload();
  await expect(riskForm.getByRole('combobox', { name: 'Treatment action' })).toHaveValue(treatmentAction);
  await expect(page.getByRole('list', { name: 'Release requirements' }), `ASSESS-03 risk ${index + 1} retains the complete readiness checklist`).toBeVisible();
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
  const reviewRequests = navigation.getByRole('link', { name: 'Assessment Requests', exact: true });
  expect(await reviewRequests.count(), 'Phase 4 capability unmet: analyst review queue is available').toBe(1);

  await reviewRequests.click();
  await expect(page).toHaveURL(/\/app\/review\/requests$/);
  await expect(page.getByRole('heading', { name: 'Assessment request review' }), 'ASSESS-01 authorised analyst queue').toBeVisible();
  await expectNoHorizontalOverflow(page, 'ASSESS-01 analyst request queue has no mobile overflow');
  await expectNoSeriousAxeViolations(page);

  const submittedRequest = page.getByRole('link', { name: submittedRequestTitle });
  await expect(submittedRequest, 'ASSESS-01 submitted request is available for review').toHaveCount(1);
  const submittedRequestHref = await submittedRequest.getAttribute('href');
  expect(submittedRequestHref).toMatch(/^\/app\/review\/requests\/[^/]+$/);

  const crossOwnerRequest = page.getByRole('link', { name: 'Other Requestor security assessment' });
  const crossOwnerHref = await crossOwnerRequest.getAttribute('href');
  expect(crossOwnerHref).toMatch(/^\/app\/review\/requests\/[^/]+$/);

  await submittedRequest.click();
  await expect(page.getByRole('heading', { name: submittedRequestTitle })).toBeVisible();
  // The request hub opens a record from its own identifier, so the questionnaire
  // is reached by its link destination rather than by a separate Open control.
  const questionnaireLink = page.locator('main a[href^="/app/review/questionnaires/"]').first();
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

  await page.getByRole('combobox', { name: 'Overall control effectiveness' }).selectOption('Partially Effective');
  const assessmentSaveResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
  await page.getByRole('button', { name: 'Save assessment' }).click();
  expect((await assessmentSaveResponse).ok(), 'ASSESS-03 assessment conclusion persisted').toBe(true);
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();

  const readinessRequirements = page.getByRole('list', { name: 'Release requirements' });
  const outstandingRiskLinks = readinessRequirements.getByRole('link', { name: /^Risk .+ — / });
  const outstandingRiskHrefs = await outstandingRiskLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(new Set(outstandingRiskHrefs).size, 'ASSESS-03 named Risk requirements keep distinct record destinations').toBeGreaterThanOrEqual(3);
  for (const href of new Set(outstandingRiskHrefs)) {
    expect(href, 'ASSESS-03 Risk requirement uses a same-page anchor').toMatch(/^#risk-/);
    await expect(page.locator(href!), `ASSESS-03 Risk destination ${href} exists`).toBeVisible();
  }
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(readinessRequirements, `ASSESS-03 readiness requirements are visible at ${width}px`).toBeVisible();
    await expectNoHorizontalOverflow(page, `ASSESS-03 readiness requirements have no overflow at ${width}px`);
  }

  const rating = page.getByRole('combobox', { name: 'Residual rating' }).first();
  await rating.selectOption('Moderate');
  await completeRiskForRelease(page, 0, 'Treat');
  await completeRiskForRelease(page, 1, 'Accept');
  await completeRiskForRelease(page, 2, 'Accept');
  await expect(rating, 'ASSESS-03 edited rating remains selected').toHaveValue('Moderate');

  await page.getByRole('button', { name: 'Add mitigation control' }).first().click();
  const firstControlRegion = page.getByRole('region', { name: /Mitigation controls for/ }).first();
  const controlForm = firstControlRegion.locator('form');
  const reusableControl = controlForm.getByRole('combobox', { name: 'Reusable control' });
  const reusableControlOption = reusableControl.locator('option').nth(1);
  const reusableControlValue = await reusableControlOption.getAttribute('value');
  const reusableControlLabel = await reusableControlOption.textContent();
  expect(reusableControlValue, 'ASSESS-03 reusable Control has a selectable identifier').toBeTruthy();
  expect(reusableControlLabel, 'ASSESS-03 reusable Control has an authoritative label').toBeTruthy();
  await reusableControl.selectOption(reusableControlValue!);
  await controlForm.getByRole('combobox', { name: 'Control owner' }).selectOption({ label: 'Jane Doe' });
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
  await page.reload();
  const persistedControl = firstControlRegion.locator('form').filter({ has: page.getByRole('button', { name: 'Save mitigation control' }) });
  await expect(persistedControl.getByRole('combobox', { name: 'Reusable control' }), 'ASSESS-03 reusable Control becomes a contextual ControlImplementation').toHaveValue(reusableControlValue!);
  await expect(persistedControl.getByRole('textbox', { name: 'Evidence' })).toHaveValue('Control selected from the reusable catalogue and scheduled for verification.');
  await expect(page.getByText('All release requirements are met'), 'ASSESS-03 persisted edits satisfy release readiness').toBeVisible();
  await expect(readinessRequirements, 'ASSESS-03 retains met requirements').toBeVisible();
  await expect(readinessRequirements.getByText('Met').first(), 'ASSESS-03 readiness state is explicit').toBeVisible();

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
  await expect(prereleasePage.getByRole('main').getByRole('heading', { level: 1, name: 'Page not found', exact: true }), 'ASSESS-05 prerelease assessment is secret').toBeVisible();
  await expect(prereleasePage.getByText(deterministicRiskStatement, { exact: true })).toHaveCount(0);
  await prereleasePage.goto(crossOwnerHref!);
  await expect(prereleasePage.getByText('You don’t have permission to review this request'), 'ASSESS-05 cross-owner assessment is denied').toBeVisible();
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
  const releasedRegion = page.getByRole('region', { name: 'Recently released assessments' });
  await expect(releasedRegion.getByText('Deterministic assessment assistance identified 3 reviewable risk proposals.'), 'ASSESS-05 Jane dashboard item is authoritative').toBeVisible();
  const releasedAssessment = releasedRegion.getByRole('link', { name: /ASM-\d{4}-/ });
  await expect(releasedAssessment, 'ASSESS-05 released assessment identifier is the only record opener').toHaveCount(1);
  await expect(releasedAssessment).toHaveAttribute('href', /^\/app\/assessments\/[^/]+$/);
  await expect(releasedAssessment).toHaveClass(/text-text-link.*underline.*focus-visible:ring-2/);
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
  await expect(page.getByRole('region', { name: 'Mitigation control implementations' }).first().getByText(reusableControlValue!, { exact: true }), 'ASSESS-05 Jane sees the persisted reusable Control reference').toBeVisible();
  const releasedMain = page.getByRole('main');
  await expect(releasedMain.getByRole('form')).toHaveCount(0);
  await expect(releasedMain.getByRole('textbox')).toHaveCount(0);
  await expect(releasedMain.getByRole('combobox')).toHaveCount(0);
  await expect(releasedMain.getByRole('button', { name: /save|add|edit|remove|release/i }), 'ASSESS-05 Requestor has no mutation controls').toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'ASSESS-05 released assessment has no desktop overflow');
  await expectNoSeriousAxeViolations(page);
  await expectNoCspViolations(page, 'the release journey');
});
