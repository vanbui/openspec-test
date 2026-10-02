import { expect, test, type Browser, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';
import { signInAs } from './helpers/navigation';

/* The browser runs in a zone other than UTC, so the timeline proves it shows the viewer's local time (D-19). */
test.use({ timezoneId: 'Australia/Brisbane' });

const unreleasedTitle = 'Customer portal questionnaire awaiting release';
const unreleasedRequestTitle = 'Customer portal mobile app and public API';
const serviceNameQuestion = 'What is the name of the service being assessed?';
const serviceDescriptionQuestion = 'Describe what the service does and who relies on it.';
const personalDataQuestion = 'Will the service handle personal information?';
const personalDataTypesQuestion = 'Which categories of personal information will be handled?';
const hostingQuestion = 'Where will the service be hosted?';
const deletedQuestion = 'What production URL or network location will users access?';
const addedQuestion = 'Who owns this service?';

async function expectNoHorizontalOverflow(page: Page, criterion: string): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message: criterion },
  ).toBe(true);
}

async function expectAtBothWidths(page: Page, criterion: string, assertion: () => Promise<void>): Promise<void> {
  for (const width of [1440, 375] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await assertion();
    await expectNoHorizontalOverflow(page, `${criterion}_${width}_NO_HORIZONTAL_OVERFLOW`);
  }
}

async function openRequest(page: Page, actor: 'Requestor' | 'Security Analyst', title: string): Promise<string> {
  await page.goto(actor === 'Requestor' ? '/app/requests' : '/app/review/requests');
  const request = page.getByRole('link', { name: title }).first();
  await expect(request, `GOVERNANCE_REQUEST_${actor}_DISCOVERY`).toBeVisible();
  await request.click();
  await expect(page, `GOVERNANCE_REQUEST_${actor}_OPEN`).toHaveURL(/\/requests\/(?!new$)[^/]+$/);
  return page.url();
}

async function expectRequestorDirectDenial(browser: Browser, questionnaireUrl: string, criterion: string): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await signInAs(page, 'Requestor');
    await page.goto(questionnaireUrl);
    // The refusal states itself in both the page copy and the alert title, so the
    // assertion is that a refusal is shown, not that exactly one element says so.
    await expect(
      page.getByText(/cannot be displayed|Page not found|don’t have permission/i).first(),
      `${criterion}_DIRECT_URL_IS_REFUSED_BY_SERVER`,
    ).toBeVisible();
    await expect(page.getByText(serviceNameQuestion, { exact: true }), `${criterion}_NO_QUESTION_TEXT_LEAKS`).toHaveCount(0);
  } finally {
    await context.close();
  }
}

async function answerActiveQuestions(page: Page, hostingChoice: string): Promise<void> {
  await page.getByRole('textbox', { name: serviceNameQuestion }).fill('Customer portal');
  await page.getByRole('textbox', { name: serviceDescriptionQuestion }).fill('Customers use the portal to manage their accounts.');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await page.getByRole('group', { name: personalDataTypesQuestion }).getByRole('checkbox').first().check();
  await page.getByRole('group', { name: hostingQuestion }).getByRole('radio', { name: hostingChoice }).check();
  await page.getByLabel('What is the planned production go-live date?').fill('2026-10-15');
}

test.describe.configure({ mode: 'serial' });

test('criteria 1-8: an Analyst governs an unreleased questionnaire through release, return, correction, and re-submission', async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  expect((await request.get(strapiHealthUrl)).ok(), 'GOVERNANCE_STRAPI_HEALTH').toBe(true);

  // Capture the analyst-only URL from the authorised list; fixture document ids are random per harness database.
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/review/questionnaires');
  const analystQuestionnaireLink = page.getByRole('link', { name: unreleasedTitle }).first();
  await expect(analystQuestionnaireLink, 'CRITERION_3_ANALYST_CAN_READ_UNRELEASED_FIXTURE').toBeVisible();
  const analystQuestionnaireHref = await analystQuestionnaireLink.getAttribute('href');
  expect(analystQuestionnaireHref, 'CRITERION_3_UNRELEASED_URL_EXISTS_FOR_DIRECT_DENIAL').toMatch(/^\/app\/review\/questionnaires\/[^/]+$/);
  const requestorQuestionnaireHref = analystQuestionnaireHref!.replace('/app/review/questionnaires/', '/app/questionnaires/');

  await signInAs(page, 'Requestor');
  await page.goto('/app/questionnaires');
  await expect(page.getByText(unreleasedTitle, { exact: true }), 'CRITERION_3_UNRELEASED_ABSENT_FROM_MY_QUESTIONNAIRES').toHaveCount(0);
  await page.goto('/app');
  await expect(page.getByText(unreleasedTitle, { exact: true }), 'CRITERION_3_UNRELEASED_ABSENT_FROM_DASHBOARD').toHaveCount(0);
  const requestorRequestUrl = await openRequest(page, 'Requestor', unreleasedRequestTitle);
  // Exact, because an accessible name matches as a substring by default and the
  // lifecycle stepper's heading names the questionnaire steps.
  await expect(page.getByRole('heading', { name: 'Questionnaire', exact: true }), 'CRITERION_3_REQUEST_HUB_OMITS_PROTECTED_QUESTIONNAIRE_SUMMARY').toHaveCount(0);
  await expect(page.getByText(/^Questionnaire state:/), 'CRITERION_3_REQUESTOR_SEES_PLAIN_STATE').toHaveCount(0);
  await expect(page.getByText(unreleasedTitle, { exact: true }), 'CRITERION_3_UNRELEASED_HUB_DOES_NOT_DISCLOSE_QUESTIONNAIRE').toHaveCount(0);
  await expectRequestorDirectDenial(browser, requestorQuestionnaireHref, 'CRITERION_3_UNRELEASED');

  await signInAs(page, 'Security Analyst');
  await page.goto(analystQuestionnaireHref!);
  await expectAtBothWidths(page, 'CRITERION_1_ANALYST_REVIEW', async () => {
    await expect(page.getByRole('region', { name: 'Questionnaire governance' })).toBeVisible();
    // The question editor is the single list of questions in analyst review (D-32): no read-only
    // questionnaire repeats it beneath.
    await expect(page.getByText(serviceNameQuestion, { exact: true })).toBeVisible();
    await expect(page.getByText(serviceNameQuestion, { exact: true }), 'CRITERION_1_EACH_QUESTION_LISTED_ONCE').toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Release questionnaire' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return to analyst review' })).toHaveCount(0);
    await expect(page.getByText('No revisions have been recorded.')).toBeVisible();
  });
  const analystRequestUrl = await page.getByRole('link', { name: /^Assessment request / }).getAttribute('href');
  expect(analystRequestUrl, 'CRITERION_1_ANALYST_REQUEST_BACKLINK').toMatch(/^\/app\/review\/requests\/[^/]+$/);
  await page.goto(analystRequestUrl!);
  await expect(page.getByRole('heading', { name: /Current lifecycle state: Questionnaire generated/ }), 'CRITERION_1_GENERATED_STEPPER_STATE').toBeVisible();
  await expect(page.getByText(/^Next action:/), 'CRITERION_1_NEXT_ACTION_IS_IN_HUB_BENEATH_STEPPER').toBeVisible();
  await page.goto(analystQuestionnaireHref!);

  const governance = page.getByRole('region', { name: 'Questionnaire governance' });
  /*
   * QUES08_FORM_OPENS_IN_VIEW (UAT-005, D-04): a question's Edit and a section's Add question open their form
   * where they were clicked, with focus in Question text and the field on screen, at both widths; discarding
   * returns focus to the control that opened the form.
   */
  for (const width of [1440, 375] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await governance.getByText(hostingQuestion, { exact: true }).locator('xpath=../..').getByRole('button', { name: 'Edit' }).click();
    const editText = governance.getByRole('form', { name: 'Edit question' }).getByLabel('Question text');
    await expect(editText, `QUES08_FORM_OPENS_IN_VIEW_EDIT_FOCUSED_${width}`).toBeFocused();
    await expect(editText, `QUES08_FORM_OPENS_IN_VIEW_EDIT_IN_VIEWPORT_${width}`).toBeInViewport();
    await governance.getByRole('button', { name: 'Discard changes' }).click();
    const addToHosting = governance.getByRole('button', { name: 'Add question to Hosting and access' });
    await addToHosting.click();
    const addText = governance.getByRole('form', { name: 'Add question to Hosting and access' }).getByLabel('Question text');
    await expect(addText, `QUES08_FORM_OPENS_IN_VIEW_SECTION_ADD_FOCUSED_${width}`).toBeFocused();
    await expect(addText, `QUES08_FORM_OPENS_IN_VIEW_SECTION_ADD_IN_VIEWPORT_${width}`).toBeInViewport();
    await governance.getByRole('button', { name: 'Discard changes' }).click();
    await expect(addToHosting, `QUES08_FORM_OPENS_IN_VIEW_DISCARD_RETURNS_FOCUS_${width}`).toBeFocused();
  }
  // E9: exact, because each section's own control is named Add question to {section}.
  await governance.getByRole('button', { name: 'Add question', exact: true }).click();
  await page.getByLabel('Question text').fill(addedQuestion);
  await page.getByRole('button', { name: 'Save question' }).click();
  await expect(governance.getByText(addedQuestion, { exact: true }), 'CRITERION_1_ADDED_QUESTION_VISIBLE').toBeVisible();
  await expect(page.getByText('Question added', { exact: true }), 'CRITERION_1_ADD_IS_DATED_TIMELINE_EVENT').toBeVisible();

  const hostingEditor = governance.getByText(hostingQuestion, { exact: true }).locator('xpath=../..');
  await hostingEditor.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Choices').fill('Organisation managed\nCloud revised\nHybrid\nThird-party hosted');
  await page.getByRole('button', { name: 'Save question' }).click();
  await expect(page.getByText('Question edited', { exact: true }), 'CRITERION_1_EDIT_IS_DATED_TIMELINE_EVENT').toBeVisible();

  const deletableEditor = governance.getByText(deletedQuestion, { exact: true }).locator('xpath=../..');
  await deletableEditor.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog', { name: 'Delete this question?' }).getByRole('button', { name: 'Delete question' }).click();
  await expect(governance.getByText(deletedQuestion, { exact: true }), 'CRITERION_1_DELETED_QUESTION_REMOVED_FROM_EDITOR').toHaveCount(0);
  await expect(page.getByText('Question removed', { exact: true }), 'CRITERION_1_DELETE_IS_DATED_TIMELINE_EVENT').toBeVisible();

  await governance.getByRole('button', { name: 'Release questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Release this questionnaire?' }).getByRole('button', { name: 'Release questionnaire' }).click();
  const timeline = page.getByRole('region', { name: 'Questionnaire revision timeline' });
  // The timeline records the action; the governance panel names the current
  // state. They read differently so one screen never says the same thing twice.
  await expect(timeline.getByText('Released', { exact: true }), 'CRITERION_1_RELEASE_IS_DATED_TIMELINE_EVENT').toBeVisible();
  // QUES08_RELEASED_QUESTIONS_WITH_PROGRESS (UAT-020, D-07): the analyst reads what was released and how far the Requestor has got.
  const releasedQuestions = page.getByRole('region', { name: 'Released questions' });
  await expect(releasedQuestions, 'QUES08_RELEASED_QUESTIONS_WITH_PROGRESS').toBeVisible();
  await expect(releasedQuestions.getByText(/^0 of \d+ answered$/), 'QUES08_RELEASED_QUESTIONS_WITH_PROGRESS_COUNT').toBeVisible();
  await expect(releasedQuestions.getByText(addedQuestion, { exact: true }), 'QUES08_RELEASED_QUESTIONS_WITH_PROGRESS_LISTS_QUESTIONS').toBeVisible();
  await expect(releasedQuestions.getByText(deletedQuestion, { exact: true }), 'QUES08_RELEASED_QUESTIONS_WITH_PROGRESS_OMITS_REMOVED').toHaveCount(0);
  await expect(releasedQuestions.getByRole('button'), 'QUES08_RELEASED_QUESTIONS_WITH_PROGRESS_READ_ONLY').toHaveCount(0);
  /*
   * D-19, UI-SPEC §4.5. With only the zone cookie cleared, the reloaded page does not know the
   * viewer's zone, so it first labels its times UTC. The shell then sends the browser's zone and the
   * route re-renders in place, with no further navigation: the timeline shows Brisbane local time
   * and no label. The poll absorbs that one re-render.
   */
  await page.context().clearCookies({ name: 'csrm-time-zone' });
  await page.reload();
  const timelineTime = timeline.locator('time').first();
  const timelineInstant = await timelineTime.getAttribute('datetime');
  expect(timelineInstant, 'UX06_TIMELINE_SHOWS_LOCAL_TIME_HAS_INSTANT').toBeTruthy();
  const expectedLocalTime = await page.evaluate((iso) => new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Brisbane',
  }).format(new Date(iso)).replace(/\s/g, ' '), timelineInstant!);
  await expect.poll(
    async () => (await timelineTime.textContent())?.replace(/\s/g, ' '),
    { message: 'UX06_TIMELINE_SHOWS_LOCAL_TIME' },
  ).toBe(expectedLocalTime);
  expect((await timelineTime.textContent())?.endsWith(' UTC'), 'UX06_TIMELINE_SHOWS_LOCAL_TIME_NO_UTC_LABEL').toBe(false);
  await page.goto(analystRequestUrl!);
  await expect(page.getByRole('heading', { name: /Current lifecycle state: Questionnaire released/ }), 'CRITERION_1_RELEASED_STEPPER_STATE').toBeVisible();

  await signInAs(page, 'Requestor');
  await page.goto(requestorQuestionnaireHref);
  await expectAtBothWidths(page, 'CRITERION_2_REQUESTOR_ANSWERING', async () => {
    await expect(page.getByText(deletedQuestion, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: addedQuestion })).toBeVisible();
    await expect(page.getByText(/0 of \d+ answered/i)).toBeVisible();
  });
  await answerActiveQuestions(page, 'Cloud revised');
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Submit this questionnaire?' }).getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();
  await page.goto(requestorRequestUrl);
  await expect(page.getByRole('heading', { name: /Current lifecycle state: Questionnaire submitted/ }), 'CRITERION_2_SUBMITTED_STEPPER_STATE').toBeVisible();
  await expect(page.getByText(/^Next action:/), 'CRITERION_2_NEXT_ACTION_REMAINS_IN_HUB').toBeVisible();

  await signInAs(page, 'Security Analyst');
  await page.goto(analystQuestionnaireHref!);
  await page.getByRole('button', { name: 'Return to analyst review' }).click();
  const returnDialog = page.getByRole('alertdialog', { name: 'Return questionnaire to analyst review?' });
  await returnDialog.getByLabel('Reason').fill('   ');
  await expect(returnDialog.getByRole('button', { name: 'Return to analyst review' }), 'CRITERION_4_EMPTY_RETURN_REASON_REFUSED').toBeDisabled();
  await returnDialog.getByLabel('Reason').fill('Correct the hosting choices after review.');
  await returnDialog.getByRole('button', { name: 'Return to analyst review' }).click();
  await expect(page.getByText('Returned to analyst review', { exact: true }), 'CRITERION_4_RETURN_IS_DATED_TIMELINE_EVENT').toBeVisible();
  // The reason is rendered on a labelled line ("Reason: ..."), so it is matched
  // as a substring of that line rather than as the whole of an element.
  await expect(timeline.getByText('Correct the hosting choices after review.'), 'CRITERION_4_RETURN_REASON_IS_AUDITED').toBeVisible();
  await expectRequestorDirectDenial(browser, requestorQuestionnaireHref, 'CRITERION_4_RETURNED');

  const returnedGovernance = page.getByRole('region', { name: 'Questionnaire governance' });
  const returnedHostingEditor = returnedGovernance.getByText(hostingQuestion, { exact: true }).locator('xpath=../..');
  await returnedHostingEditor.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Choices').fill('Organisation managed\nCloud final\nHybrid\nThird-party hosted');
  await page.getByRole('button', { name: 'Save question' }).click();
  await expect(page.getByText('Answers cleared by this revision'), 'CRITERION_5_CLEARED_ANSWER_REPORTED').toBeVisible();
  // The notice and the timeline's edit and cleared-answer entries all name the question by its text (D-17).
  await expect(timeline.getByText(hostingQuestion).first(), 'CRITERION_5_CLEARED_ANSWER_NAMES_QUESTION').toBeVisible();
  await expect(timeline.getByText(/hosting-model/), 'UX06_TIMELINE_NEVER_SHOWS_A_QUESTION_KEY').toHaveCount(0);
  await returnedGovernance.getByRole('button', { name: 'Release questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Release this questionnaire?' }).getByRole('button', { name: 'Release questionnaire' }).click();

  await signInAs(page, 'Requestor');
  await page.goto(requestorQuestionnaireHref);
  await expectAtBothWidths(page, 'CRITERION_5_REQUESTOR_REANSWER', async () => {
    await expect(page.getByText('Some answers need completing again before you re-submit.')).toBeVisible();
    await expect(page.getByText('An answer was cleared because its question changed')).toBeVisible();
    await expect(page.getByRole('group', { name: hostingQuestion }).getByRole('radio', { name: 'Cloud final' })).not.toBeChecked();
  });
  await page.getByRole('group', { name: hostingQuestion }).getByRole('radio', { name: 'Cloud final' }).check();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Submit this questionnaire?' }).getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();

  await page.goto(requestorRequestUrl);
  await page.setViewportSize({ width: 375, height: 812 });
  const stepper = page.getByRole('heading', { name: /Current lifecycle state:/ });
  const hub = page.getByRole('heading', { name: 'Request summary' });
  await expect(stepper, 'CRITERION_8_STEPPER_REACHABLE_IN_MOBILE_READING_ORDER').toBeVisible();
  await expect(hub, 'CRITERION_8_HUB_REACHABLE_IN_MOBILE_READING_ORDER').toBeVisible();
  const questionnaireLink = page.getByRole('link', { name: /QUES-DEV-UNRELEASED-001/ });
  await questionnaireLink.focus();
  await expect(questionnaireLink, 'CRITERION_8_HUB_KEYBOARD_TARGET_HAS_VISIBLE_FOCUS_SYSTEM').toBeFocused();
  await expect(questionnaireLink, 'CRITERION_8_HUB_KEYBOARD_TARGET_HAS_FOCUS_INDICATOR').toHaveClass(/focus-visible:ring-2/);
  await expectNoHorizontalOverflow(page, 'CRITERION_8_MOBILE_SURFACES_NO_HORIZONTAL_OVERFLOW');

  /*
   * The revision timeline belongs to the questionnaire, not to the request, so
   * its mobile reading order is proved where it is rendered.
   */
  await page.goto(requestorQuestionnaireHref);
  await expect(page.getByRole('region', { name: 'Questionnaire revision timeline' }), 'CRITERION_8_TIMELINE_REACHABLE_IN_MOBILE_READING_ORDER').toBeVisible();
  await expectNoHorizontalOverflow(page, 'CRITERION_8_TIMELINE_NO_HORIZONTAL_OVERFLOW');
});
