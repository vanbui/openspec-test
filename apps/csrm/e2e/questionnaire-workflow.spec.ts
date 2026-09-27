import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { signInAs } from './helpers/navigation';

const seededQuestionnaireTitle = 'Customer portal questionnaire draft';
const serviceNameQuestion = 'What is the name of the service being assessed?';
const serviceDescriptionQuestion = 'Describe what the service does and who relies on it.';
const controllerQuestion = 'Will the service handle personal information?';
const dependentQuestion = 'Which categories of personal information will be handled?';
const dependentAnswer = 'Contact details';
const hostingQuestion = 'Where will the service be hosted?';
const goLiveQuestion = 'What is the planned production go-live date?';

/*
 * Toasts stack bottom-right over whatever the page ends with, and hovering one
 * pauses its dismiss timer, so a toast left under the pointer can sit on top of
 * the next control indefinitely. Move the pointer away and let them expire,
 * which is what happens for a person who looks away, rather than clicking a
 * close button while it is still animating in.
 */
async function dismissToasts(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page, baseline: string): Promise<void> {
  // A toast is fixed-position and can briefly extend past the viewport, which
  // reads as document overflow without any layout being wrong. Let them expire
  // first, the same reason every click in this spec does.
  await dismissToasts(page);
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      { message: baseline },
    )
    .toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

async function expectQuestionnaireRequestBacklink(
  page: Page,
  routePrefix: '/app/requests/' | '/app/review/requests/',
  viewport: 'mobile' | 'desktop',
  followingContent?: Locator,
): Promise<void> {
  const link = page.getByRole('link', { name: /^Assessment request RAR-DEV-QUES-DRAFT-001$/ });
  await expect(link, `QUESTIONNAIRE_${viewport.toUpperCase()}_REQUEST_BACKLINK`).toHaveCount(1);
  await expect(link).toHaveAttribute('href', new RegExp(`^${routePrefix}[^/]+$`));

  const [header, relationship, workflow] = await Promise.all([
    page.getByRole('heading', { name: seededQuestionnaireTitle }).boundingBox(),
    link.boundingBox(),
    followingContent?.boundingBox() ?? Promise.resolve(null),
  ]);
  expect(header, 'QUESTIONNAIRE_HEADER_BOX').not.toBeNull();
  expect(relationship, 'QUESTIONNAIRE_RELATIONSHIP_BOX').not.toBeNull();
  expect(relationship!.y, 'QUESTIONNAIRE_RELATIONSHIP_AFTER_HEADER').toBeGreaterThan(header!.y);
  if (followingContent) {
    expect(workflow, 'QUESTIONNAIRE_WORKFLOW_BOX').not.toBeNull();
    expect(workflow!.y, 'QUESTIONNAIRE_RELATIONSHIP_BEFORE_WORKFLOW').toBeGreaterThan(relationship!.y);
  }
  expect(relationship!.height, 'QUESTIONNAIRE_RELATIONSHIP_44PX_TARGET').toBeGreaterThanOrEqual(44);
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  await expectNoHorizontalOverflow(page, `QUESTIONNAIRE_${viewport.toUpperCase()}_RELATIONSHIP_OVERFLOW`);

  await Promise.all([
    page.waitForURL(new RegExp(`^.+${routePrefix}[^/]+$`)),
    link.click(),
  ]);
  await page.goBack();
  await expect(link, `QUESTIONNAIRE_${viewport.toUpperCase()}_REQUEST_BACKLINK_RETURN`).toBeVisible();
}

async function expectQuestionnaireReturnToDraftConfirmation(
  page: Page,
  viewport: 'mobile' | 'desktop',
  followingContent: Locator,
): Promise<void> {
  const pageRegion = page.getByRole('main');
  const trigger = pageRegion.getByRole('button', { name: 'Return to draft' });
  await expect(trigger, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_TRIGGER`).toHaveCount(1);
  await expect(pageRegion.getByRole('button').first(), `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_IS_FIRST_ACTION`).toHaveText('Return to draft');
  await expect(trigger, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_USES_DEFAULT_BUTTON`).toHaveAttribute('data-variant', 'default');

  const [triggerBox, followingBox] = await Promise.all([trigger.boundingBox(), followingContent.boundingBox()]);
  expect(triggerBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_TRIGGER_BOX`).not.toBeNull();
  expect(followingBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_FOLLOWING_CONTENT_BOX`).not.toBeNull();
  expect(followingBox!.y - (triggerBox!.y + triggerBox!.height), `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_16PX_SEPARATION`).toBeGreaterThanOrEqual(16);

  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'Return this questionnaire to draft?' });
  const reason = dialog.getByLabel('Reason');
  const confirm = dialog.getByRole('button', { name: 'Return questionnaire to draft' });
  await expect(dialog, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_PORTAL`).toBeVisible();
  await expect(confirm, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_RECORD_COPY`).toBeVisible();

  const [dialogBox, headerBox, reasonBox, footerBox] = await Promise.all([
    dialog.boundingBox(),
    dialog.locator('[data-slot="alert-dialog-header"]').boundingBox(),
    reason.boundingBox(),
    dialog.locator('[data-slot="alert-dialog-footer"]').boundingBox(),
  ]);
  expect(dialogBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_DIALOG_BOX`).not.toBeNull();
  expect(headerBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_HEADER_BOX`).not.toBeNull();
  expect(reasonBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_REASON_BOX`).not.toBeNull();
  expect(footerBox, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_FOOTER_BOX`).not.toBeNull();
  expect(reasonBox!.width, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_REASON_FULL_WIDTH`).toBeGreaterThanOrEqual(headerBox!.width - 1);
  expect(footerBox!.width, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_FOOTER_FULL_WIDTH`).toBeGreaterThanOrEqual(headerBox!.width - 1);
  expect(dialogBox!.width, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_RESPONSIVE_DIALOG`).toBeLessThanOrEqual(
    viewport === 'mobile' ? 343 : 480,
  );
  await expect(dialog.locator('[data-slot="alert-dialog-footer"]')).toHaveCSS(
    'flex-direction',
    viewport === 'mobile' ? 'column-reverse' : 'row',
  );
  await expectNoHorizontalOverflow(page, `QUESTIONNAIRE_${viewport.toUpperCase()}_REVERSAL_OVERFLOW`);

  await reason.fill('x'.repeat(501));
  await expect(dialog.getByText('Enter a reason of up to 500 characters.')).toBeVisible();
  await expect(confirm).toBeDisabled();
  await reason.fill('x'.repeat(500));
  await expect(dialog.getByText('500/500 characters')).toBeVisible();
  await expect(confirm).toBeEnabled();
  await reason.focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
}

test('Requestor completes a questionnaire and Security Analyst reviews the submitted answers', async ({ page, request }) => {
  test.setTimeout(90_000);

  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) {
    throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  }

  // Every document this journey loads runs under the production CSP, and none may raise a violation (D-19).
  await attachCspCollector(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signInAs(page, 'Requestor');
  await expectNoHorizontalOverflow(page, 'BASELINE_MOBILE_PAGE_OVERFLOW');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' }), 'BASELINE_KEYBOARD_SKIP_LINK').toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Menu', exact: true }), 'BASELINE_KEYBOARD_NAVIGATION').toBeFocused();
  await page.keyboard.press('Enter');

  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigation.getByRole('link', { name: 'My Requests' }), 'BASELINE_REQUESTOR_NAVIGATION').toBeVisible();
  const myQuestionnaires = navigation.getByRole('link', { name: 'My Questionnaires' });
  await expect(myQuestionnaires, 'QUES-01 Requestor questionnaire navigation').toBeVisible();

  await myQuestionnaires.click();
  await expect(page).toHaveURL(/\/app\/questionnaires$/);
  await expect(page.getByRole('heading', { name: 'My Questionnaires' })).toBeVisible();
  const questionnaireLink = page.getByRole('link', { name: seededQuestionnaireTitle });
  await expect(questionnaireLink, 'QUES-01 authorised questionnaire discovery').toHaveCount(1);
  const questionnaireHref = await questionnaireLink.getAttribute('href');
  expect(questionnaireHref).toMatch(/^\/app\/questionnaires\/[^/]+$/);
  const documentId = questionnaireHref?.split('/').at(-1);
  expect(documentId).toBeTruthy();
  await expectNoSeriousAxeViolations(page);

  await page.goto(`/app/review/questionnaires/${documentId}`);
  await expect(page.getByText('Awaiting questionnaire submission')).toBeVisible();
  // Still signed in as the Requestor. The analyst review route offers an
  // analyst-scoped link to the request, which this actor may not follow, so the
  // link must be absent rather than present-and-denied. The Requestor reaches
  // the same request from their own questionnaire page, asserted below.
  await expect(
    page.getByRole('link', { name: /^Assessment request / }),
    'QUESTIONNAIRE_REVIEW_ROUTE_OFFERS_NO_ANALYST_BACKLINK_TO_REQUESTOR',
  ).toHaveCount(0);
  // The analyst is told which questionnaire this is — the title, its number and
  // its request are metadata the review list already shows. What stays private
  // until a complete batch is submitted are the draft answers themselves.
  for (const draftContent of [dependentAnswer, dependentQuestion, serviceNameQuestion]) {
    await expect(page.getByText(draftContent)).toHaveCount(0);
  }

  await page.goto(questionnaireHref!);

  await expect(page.getByRole('heading', { name: seededQuestionnaireTitle })).toBeVisible();
  await expectQuestionnaireRequestBacklink(page, '/app/requests/', 'mobile', page.getByRole('textbox', { name: serviceNameQuestion }));
  await expect(page.getByText(/0 of \d+ answered/i)).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: dependentQuestion }),
    'QUES-02 dependent questions remain hidden until their controller matches',
  ).toHaveCount(0);

  await page.getByRole('textbox', { name: serviceNameQuestion }).fill('Customer portal');
  await page.getByRole('textbox', { name: serviceDescriptionQuestion }).fill('Customers use the portal to manage their accounts.');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  const dependentGroup = page.getByRole('group', { name: dependentQuestion });
  await expect(dependentGroup).toBeVisible();
  await dependentGroup.getByRole('checkbox', { name: dependentAnswer }).check();
  await page.getByRole('group', { name: hostingQuestion }).getByRole('radio', { name: 'Cloud service' }).check();
  await page.getByLabel(goLiveQuestion).fill('2026-10-15');
  /*
   * The seeded questionnaire is one-shot: this pass submits it, so a second pass in another project
   * would find it already answered. Both widths are therefore proved at each stage inside this pass
   * (D-41). Here, the filled form at 1440 before it is saved at 375.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('textbox', { name: serviceNameQuestion }), 'QUESTIONNAIRE_FORM_DESKTOP_ANSWER').toHaveValue('Customer portal');
  await expect(dependentGroup, 'QUESTIONNAIRE_FORM_DESKTOP_DEPENDENT_GROUP').toBeVisible();
  await expect(dependentGroup.getByRole('checkbox', { name: dependentAnswer })).toBeChecked();
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_FORM_DESKTOP_PAGE_OVERFLOW');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeChecked();
  await expect(
    page.getByRole('group', { name: dependentQuestion }).getByRole('checkbox', { name: dependentAnswer }),
    'QUES-03 saved draft answers resume after reload',
  ).toBeChecked();

  await page.setViewportSize({ width: 768, height: 1024 });
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_TABLET_PAGE_OVERFLOW');
  await expectNoSeriousAxeViolations(page);

  const resumedDependentGroup = page.getByRole('group', { name: dependentQuestion });
  await resumedDependentGroup.getByRole('checkbox', { name: dependentAnswer }).uncheck();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  const errorSummary = page.getByRole('region', { name: 'Questionnaire validation guidance' });
  await expect(errorSummary, 'QUES-04 invalid submission exposes a linked error summary').toBeVisible();
  const unansweredLink = errorSummary.getByRole('link', { name: dependentQuestion });
  await expect(unansweredLink).toBeVisible();
  await unansweredLink.click();
  await expect(resumedDependentGroup).toBeFocused();
  await resumedDependentGroup.getByRole('checkbox', { name: dependentAnswer }).check();

  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Submit this questionnaire?' });
  await expect(confirmation).toContainText(/cannot be undone|irreversible/i);
  await confirmation.getByRole('button', { name: 'Submit questionnaire' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(dependentAnswer), 'QUES-04 submitted answers render read-only').toBeVisible();
  await expect(page.getByRole('button', { name: /save draft|submit questionnaire/i })).toHaveCount(0);
  await expect(page.getByLabel(controllerQuestion)).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);

  for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expectQuestionnaireReturnToDraftConfirmation(page, viewport, page.getByText(dependentAnswer, { exact: true }));
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectNoHorizontalOverflow(page, 'QUESTIONNAIRE_DESKTOP_PAGE_OVERFLOW');

  await page.context().clearCookies();
  await signInAs(page, 'Security Analyst');
  await page.getByRole('link', { name: 'Questionnaires', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Questionnaire Review' })).toBeVisible();
  await page.getByRole('link', { name: seededQuestionnaireTitle }).click();

  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
  await expect(page.getByRole('heading', { name: seededQuestionnaireTitle })).toBeVisible();
  await expectQuestionnaireRequestBacklink(page, '/app/review/requests/', 'desktop', page.getByText(dependentAnswer));
  await expect(page.getByText(dependentAnswer), 'QUES-05 analyst reviews the authoritative submitted answer').toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /save draft|submit questionnaire/i })).toHaveCount(0);
  await expect(page.getByLabel(controllerQuestion)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'ANALYST_REVIEW_DESKTOP_PAGE_OVERFLOW');
  await expectNoSeriousAxeViolations(page);

  // The analyst review at 375 in the same pass (D-41): the submitted answer and the Submitted status.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByText(dependentAnswer), 'QUES-05 ANALYST_REVIEW_MOBILE_ANSWER').toBeVisible();
  await expect(page.locator('.page-header [data-slot="badge"]'), 'ANALYST_REVIEW_MOBILE_SUBMITTED_BADGE').toHaveText('Submitted');
  await expectNoHorizontalOverflow(page, 'ANALYST_REVIEW_MOBILE_PAGE_OVERFLOW');
  await page.setViewportSize({ width: 1440, height: 900 });

  await dismissToasts(page);
  await expectQuestionnaireReturnToDraftConfirmation(page, 'desktop', page.getByText(dependentAnswer, { exact: true }));
  await page.getByRole('main').getByRole('button', { name: 'Return to draft' }).click();
  const revertConfirmation = page.getByRole('alertdialog', { name: 'Return this questionnaire to draft?' });
  await expect(revertConfirmation.getByLabel('Reason')).toBeVisible();
  await revertConfirmation.getByLabel('Reason').fill('   ');
  await expect(revertConfirmation.getByRole('button', { name: 'Return questionnaire to draft' })).toBeDisabled();
  await revertConfirmation.getByLabel('Reason').fill('x'.repeat(500));
  await revertConfirmation.getByRole('button', { name: 'Return questionnaire to draft' }).click();
  await expect(page.getByText('Awaiting questionnaire submission')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last returned to draft' })).toBeVisible();
  await expect(page.getByText('x'.repeat(500))).toBeVisible();
  await expect(page.getByText(dependentAnswer)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save draft|submit questionnaire/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to draft' }), 'QUESTIONNAIRE_AWAITING_SUBMISSION_REVERSAL_OMITTED').toHaveCount(0);

  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  await page.getByRole('link', { name: 'My Questionnaires' }).click();
  await page.getByRole('link', { name: seededQuestionnaireTitle }).click();
  await expect(page.getByText(dependentAnswer), 'QUES-06 reverted answer value remains available to the owner').toBeVisible();
  await expectQuestionnaireRequestBacklink(page, '/app/requests/', 'desktop', page.getByRole('textbox', { name: serviceNameQuestion }));
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  const resubmitConfirmation = page.getByRole('alertdialog', { name: 'Submit this questionnaire?' });
  await resubmitConfirmation.getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();

  const analystReviewUrl = page.url();
  await page.context().clearCookies();
  await page.goto(analystReviewUrl);
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  await expect(page.getByText(seededQuestionnaireTitle)).toHaveCount(0);
  await expect(page.getByText(dependentAnswer)).toHaveCount(0);
  await expectNoCspViolations(page, 'the questionnaire journey');
});
