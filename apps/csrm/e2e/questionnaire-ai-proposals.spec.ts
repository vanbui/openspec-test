import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  addNote,
  analystPath,
  expectNoHorizontalOverflow,
  expectNoneNewOnNextRender,
  expectNoSeriousViolations,
  expectStrapiHealthy,
  noteWith,
  requestorPath,
  softly,
  switchTo,
  toastWith,
} from './helpers/request-collaboration';
import { createSubmittedRequest } from './helpers/requests';

/*
 * Phase 15 (QUES-11, QUES-12; D-36; 15-UI-SPEC §16 E1): steerable questionnaire AI end to end. Each test creates its own
 * uniquely titled records (the title carries the project's name), so the desktop (1440) and mobile (375) projects can
 * both run it against one database; the tests meant for 375 carry @journey. The journey's questionnaire is shared with
 * the Requestor's and the Secondary Requestor's checks that follow it, so the file runs in order.
 *
 * Every suite runs the deterministic providers (D-30): a marked note about offshore support gives three Offshore support
 * questions, and the adversarial pair (a change to an answered question and a near-duplicate) is left out by CSRM.
 */
test.describe.configure({ mode: 'serial' });

const offshoreNote = 'From next month an offshore support team with administrator access will look after the service out of hours.';
const countryQuestion = 'In which country or countries is the offshore support team based?';
const adminQuestion = 'Will the offshore support team have administrator access to your systems?';
const approvalQuestion = 'How is the offshore team\'s administrator access approved and logged?';
const editedCountryQuestion = 'Where is the offshore support team based?';
const mfaQuestion = 'Is MFA enforced for privileged and federated identities, including break-glass accounts?';
const mfaPlainQuestion = /^Is a second sign-in step \(multi-factor authentication\) enforced/;
const outcomesAnswer = 'Customer records must stay accurate and private.';
const protectionAnswer = 'Access is limited to the platform team and every change is logged.';
const providerAnswer = 'The hosting partner runs the platform and its backups.';
const longSectionTitle = `Offshore support ${'operational review '.repeat(14)}`.slice(0, 255);

type Journey = { title: string; requestId: string; requestNumber: string; questionnaireId: string };
let journey: Journey | null = null;

const questionnairePath = (documentId: string) => `/app/review/questionnaires/${encodeURIComponent(documentId)}`;
const requestorQuestionnairePath = (documentId: string) => `/app/questionnaires/${encodeURIComponent(documentId)}`;

function panelOf(page: Page): Locator {
  return page.getByRole('region', { name: 'AI proposals', exact: true });
}

function governanceOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Questionnaire governance' });
}

/** Bob starts questionnaire generation from the hub and opens the questionnaire; the deterministic job may finish at once. */
async function generateAndOpen(page: Page, label: string): Promise<string> {
  await page.getByRole('button', { name: 'Generate questionnaire' }).click();
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  const hubLink = page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ });
  await expect.poll(async () => await review.count() + await hubLink.count(), { message: `${label}: the questionnaire is generated`, timeout: 60_000 }).toBeGreaterThan(0);
  const href = await (await review.count() > 0 ? review : hubLink).first().getAttribute('href');
  expect(href, `${label}: the questionnaire review route`).toMatch(/^\/app\/review\/questionnaires\/[^/]+$/);
  return decodeURIComponent(href!.split('/').at(-1)!);
}

/** Jane answers every required question of the deterministic questionnaire and submits it. */
async function janeAnswersAndSubmits(page: Page, questionnaireId: string): Promise<void> {
  await page.goto(requestorQuestionnairePath(questionnaireId));
  await page.getByRole('textbox', { name: /^What security outcomes matter most/ }).fill(outcomesAnswer);
  await page.getByRole('group', { name: /^Is the stated business criticality/ }).getByRole('radio', { name: 'High', exact: true }).check();
  await page.getByRole('group', { name: /^Is an external provider involved\?/ }).getByRole('radio', { name: 'Yes', exact: true }).check();
  await page.getByRole('textbox', { name: /^What does the external provider do\?/ }).fill(providerAnswer);
  await page.getByRole('textbox', { name: /^How is .* protected\?/ }).fill(protectionAnswer);
  await page.getByRole('group', { name: /^Has recovery been tested\?/ }).getByRole('radio', { name: 'Not sure', exact: true }).check();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Submit this questionnaire?' }).getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();
}

/** The AI wording a Requestor must never see (D-07, D-31; 15-UI-SPEC §11.1). */
const requestorAiText = /AI proposals?|Instruction for the AI|Proposals requested from the AI|Plain-language rewrite|Rewrite in plain language|Suggest follow-up questions|Provider:|Model:|deterministic-questionnaire/;

async function expectNoAiForRequestor(page: Page, label: string): Promise<void> {
  const main = page.getByRole('main');
  await softly(page.getByRole('region', { name: 'AI proposals', exact: true }), `${label}: no AI proposals panel`).toHaveCount(0);
  await softly(main.getByText('Answered', { exact: true }), `${label}: no Answered note`).toHaveCount(0);
  await softly(main.getByRole('button', { name: /Rewrite in plain language|Suggest follow-up questions/ }), `${label}: no AI control`).toHaveCount(0);
  softly(await main.innerText(), `${label}: no AI wording`).not.toMatch(requestorAiText);
}

/*
 * Success criteria 1 to 4 (QUES-11, QUES-12; D-36): Jane's marked note about offshore support; follow-up questions on the
 * submitted questionnaire on that topic only, the answered ones untouched and the dropped attempts listed as left out;
 * the return to analyst review; confirm, edit then confirm, reject with a reason and Undo; a plain-language rewrite; the
 * release refused while a proposal is open; the timeline; and Jane's view after the release.
 */
test('QUES11_QUES12_JOURNEY @journey: Bob steers follow-up questions from Jane’s marked note, decides them, rewrites a question and releases', async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await expectStrapiHealthy(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const width = page.viewportSize()?.width ?? 0;
  const label = `QUES11_QUES12_JOURNEY at ${width}px`;
  const title = `Offshore support follow-ups ${testInfo.project.name} ${Date.now().toString(36)}`;

  await switchTo(page, 'Requestor');
  const submitted = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'High', dueDate: null });

  let questionnaireId = '';
  await test.step('Bob generates and releases the questionnaire', async () => {
    await switchTo(page, 'Security Analyst');
    await page.goto(analystPath(submitted.documentId));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    questionnaireId = await generateAndOpen(page, label);
    await page.goto(questionnairePath(questionnaireId));
    await governanceOf(page).getByRole('button', { name: 'Release questionnaire' }).click();
    const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
    await release.getByRole('button', { name: 'Release questionnaire' }).click();
    await expect(release).toBeHidden();
    await expect(page.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();
  });

  await test.step('Jane answers, submits and adds a note about offshore support', async () => {
    await switchTo(page, 'Requestor');
    await janeAnswersAndSubmits(page, questionnaireId);
    await page.goto(requestorPath(submitted.documentId));
    await addNote(page, submitted.requestNumber, offshoreNote, 'button');
  });

  await test.step('Bob marks the note as changing the AI inputs', async () => {
    await switchTo(page, 'Security Analyst');
    await page.goto(analystPath(submitted.documentId));
    const mark = noteWith(page, submitted.requestNumber, offshoreNote).getByRole('switch', { name: 'Changes the AI inputs' });
    await mark.click();
    await expect(mark).toHaveAttribute('aria-checked', 'true');
    await expect(toastWith(page, 'Note marked as changing the AI inputs.').first()).toBeVisible();
    await expectNoneNewOnNextRender(page, submitted.requestNumber, label);
  });

  const panel = panelOf(page);
  const followUps = panel.getByRole('article', { name: 'Bob Doe asked the AI for follow-up questions' });
  await test.step('Bob asks for follow-up questions on the submitted questionnaire (criterion 1)', async () => {
    await page.goto(questionnairePath(questionnaireId));
    await expect(panel).toBeVisible();
    await page.goto(analystPath(submitted.documentId));
    await expect(page.getByText('AI proposals: none open', { exact: true })).toBeVisible();
    await page.goto(questionnairePath(questionnaireId));
    // D-29: the signal offers the default task too, beside the panel's own start.
    await expect(page.getByRole('button', { name: 'Suggest follow-up questions' }), `${label}: the signal and the panel both offer the default task`).toHaveCount(2);
    await expect(panel.getByText('To confirm proposals, return the questionnaire to analyst review. You can ask the AI and reject proposals now.')).toBeVisible();
    await expectNoSeriousViolations(page, `${label}: the panel on the submitted questionnaire`);
    await panel.getByRole('button', { name: 'Suggest follow-up questions' }).click();
    await expect(panel.locator('[data-ai-proposals-job-status]')).toBeFocused();
    await expect(followUps, `${label}: the follow-up group`).toBeVisible({ timeout: 60_000 });
    for (const question of [countryQuestion, adminQuestion, approvalQuestion]) {
      await expect(followUps.getByText(question, { exact: true }).first(), `${label}: ${question}`).toBeVisible();
    }
    await expect(followUps.getByRole('button', { name: /^Confirm: / }), `${label}: nothing is confirmed on a submitted questionnaire`).toHaveCount(0);
    const leftOut = followUps.getByRole('button', { name: '2 left out' });
    expect((await leftOut.boundingBox())?.height, 'Left-out toggle has a 24px target.').toBeGreaterThanOrEqual(24);
    const fixedQuestions = panel.getByRole('button', { name: /answered questions stay as they are/ });
    expect((await fixedQuestions.boundingBox())?.height, 'Answered-question toggle has a 24px target.').toBeGreaterThanOrEqual(24);
    await leftOut.click();
    await expect(leftOut).toHaveAttribute('aria-expanded', 'true');
    await expect(followUps.getByText('A change to an answered question. Answered questions stay as they are.'), `${label}: the answered question is left alone`).toBeVisible();
    await expect(followUps.getByText('A question too close to one already asked, proposed, rejected or removed.'), `${label}: the near-duplicate is left out`).toBeVisible();
    // Only the offshore topic: no other new question is proposed.
    await expect(followUps.getByRole('button', { name: /^Reject: / })).toHaveCount(3);
  });

  await test.step('Bob returns the questionnaire to analyst review', async () => {
    await page.goto(analystPath(submitted.documentId));
    await page.getByRole('link', { name: 'AI proposals: 3 open', exact: true }).click();
    await expect(panel).toBeInViewport();
    await expect(panel).toBeFocused();
    await panel.getByRole('button', { name: 'Return to analyst review' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Return questionnaire to analyst review?' });
    await dialog.getByLabel('Reason').fill('Adding the offshore support questions Jane’s note calls for.');
    await dialog.getByRole('button', { name: 'Return to analyst review' }).click();
    await expect(dialog).toBeHidden();
    await expect(panel.locator('[data-ai-proposals-status]')).toBeFocused();
    await expect(followUps.getByRole('button', { name: `Confirm: ${adminQuestion}`, exact: true })).toBeVisible();
  });

  await test.step('Bob confirms one, edits then confirms another, and rejects one then undoes it (criterion 2)', async () => {
    const confirmAdmin = followUps.getByRole('button', { name: `Confirm: ${adminQuestion}`, exact: true });
    await confirmAdmin.focus();
    await confirmAdmin.press('Enter');
    await expect(toastWith(page, 'New question confirmed and added to Offshore support.').first()).toBeVisible();
    await expect(followUps.getByRole('button', { name: `Confirm: ${approvalQuestion}`, exact: true })).toBeFocused();

    await followUps.getByRole('button', { name: `Edit, then confirm: ${countryQuestion}`, exact: true }).click();
    const editForm = panel.getByRole('form', { name: 'Edit, then confirm' });
    await editForm.getByLabel('Question text').fill(editedCountryQuestion);
    await editForm.getByLabel('Section', { exact: true }).selectOption({ label: 'New section' });
    await editForm.getByLabel('New section title', { exact: true }).fill(longSectionTitle);
    await expectNoSeriousViolations(page, `${label}: Edit, then confirm open`);
    const confirmEdits = editForm.getByRole('button', { name: 'Confirm with edits' });
    await confirmEdits.focus();
    await confirmEdits.press('Enter');
    const editedToast = toastWith(page, `New question confirmed and added to ${longSectionTitle} with your edits.`).first();
    await expect(editedToast).toBeVisible();
    await expect(editedToast.getByRole('button', { name: 'Undo' })).toBeInViewport();
    await expectNoHorizontalOverflow(page, '255-character section-title confirmation');
    await expect(followUps.getByRole('button', { name: `Confirm: ${approvalQuestion}`, exact: true })).toBeFocused();

    await followUps.getByRole('button', { name: `Reject: ${approvalQuestion}`, exact: true }).click();
    await panel.getByLabel('Reason (optional)').fill('Covered by the vendor questions');
    await expectNoSeriousViolations(page, `${label}: the reject row open`);
    await panel.getByRole('button', { name: 'Reject proposal' }).click();
    const rejected = toastWith(page, 'Proposal rejected.').first();
    await expect(rejected).toBeVisible();
    await rejected.getByRole('button', { name: 'Undo' }).click();
    await expect(toastWith(page, 'Rejection undone. The proposal is open again.').first()).toBeVisible();
    await expect(followUps.getByRole('button', { name: `Reject: ${approvalQuestion}`, exact: true })).toBeVisible();
  });

  await test.step('Release waits for the open proposal (criterion 4)', async () => {
    const governance = governanceOf(page);
    await expect(governance.getByText('Decide the 1 open AI proposal before you release this questionnaire.'), `${label}: the release line`).toBeVisible();
    await expect(governance.getByRole('button', { name: 'Release questionnaire' }), `${label}: no Release while a proposal is open`).toHaveCount(0);
  });

  await test.step('Bob adds a question, rewrites it in plain language and confirms the rewrite (criterion 2)', async () => {
    const governance = governanceOf(page);
    await governance.getByRole('button', { name: 'Add question', exact: true }).click();
    await governance.getByLabel('Question text').fill(mfaQuestion);
    await governance.getByLabel('Section', { exact: true }).selectOption({ label: 'Request context' });
    await governance.getByRole('button', { name: 'Save question' }).click();
    await expect(governance.getByText(mfaQuestion, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Rewrite in plain language: ${mfaQuestion}`, exact: true }).click();
    const rewriteForm = width < 768
      ? page.getByRole('dialog', { name: 'Rewrite in plain language' })
      : page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Rewrite question' }) });
    await expect(rewriteForm.getByLabel('Instruction for the AI (optional)')).toBeVisible();
    await expectNoSeriousViolations(page, `${label}: the rewrite ${width < 768 ? 'sheet' : 'popover'}`);
    await rewriteForm.getByRole('button', { name: 'Rewrite question' }).click();
    const rewriteGroup = panel.getByRole('article', { name: 'Bob Doe asked the AI to rewrite a question in plain language' });
    await expect(rewriteGroup, `${label}: the rewrite group`).toBeVisible({ timeout: 60_000 });
    await rewriteGroup.getByRole('button', { name: `Confirm: ${mfaQuestion}`, exact: true }).click();
    await expect(toastWith(page, 'Question change confirmed.').first()).toBeVisible();
    await expect(governance.getByText(mfaPlainQuestion).first(), `${label}: the rewrite is applied`).toBeVisible();
  });

  await test.step('Bob rejects the remaining proposal and releases', async () => {
    await followUps.getByRole('button', { name: `Reject: ${approvalQuestion}`, exact: true }).click();
    await panel.getByRole('button', { name: 'Reject proposal' }).click();
    await expect(toastWith(page, 'Proposal rejected.').first()).toBeVisible();
    const decided = panel.getByRole('button', { name: /^Show decided proposals/ });
    await decided.click();
    await expect(panel.getByText(/^Rejected · /).first()).toBeVisible();
    await expectNoSeriousViolations(page, `${label}: the decided proposals open`);

    const governance = governanceOf(page);
    await governance.getByRole('button', { name: 'Release questionnaire' }).click();
    const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
    await release.getByRole('button', { name: 'Release questionnaire' }).click();
    await expect(release).toBeHidden();
    await expect(page.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();
  });

  await test.step('The timeline records the AI requests and each confirmed change with its source (criterion 3)', async () => {
    const timeline = page.getByRole('region', { name: 'Questionnaire revision timeline' });
    const proposals = timeline.getByRole('listitem').filter({ hasText: 'Proposals requested from the AI' }).first();
    await expect(proposals.getByText('none - the AI suggested the questions it judged still needed')).toBeVisible();
    await expect(proposals.getByText('deterministic-questionnaire-proposals · Model: 1')).toBeVisible();
    await expect(proposals.getByText(/ by Bob Doe$/)).toBeVisible();
    await expect(proposals.locator('time')).toHaveCount(1);
    await expect(timeline.getByText('Plain-language rewrite requested from the AI', { exact: true })).toBeVisible();
    await expect(timeline.getByText('AI proposal, confirmed').first()).toBeVisible();
    await expect(timeline.getByText('AI proposal, edited before confirming').first()).toBeVisible();
    await expectNoSeriousViolations(page, `${label}: the timeline`);
    await expectNoHorizontalOverflow(page, `${label}: the analyst’s questionnaire`);
  });

  await test.step('Jane sees the new questions after the release, with her answers unchanged and no AI wording (criterion 4)', async () => {
    await switchTo(page, 'Requestor');
    await page.goto(requestorQuestionnairePath(questionnaireId));
    await expect(page.getByRole('textbox', { name: new RegExp(`^${editedCountryQuestion.replace(/[?]/g, '\\?')}`) })).toBeVisible();
    await expect(page.getByRole('group', { name: new RegExp(`^${adminQuestion.replace(/[?]/g, '\\?')}`) })).toBeVisible();
    await expect(page.getByRole('textbox', { name: mfaPlainQuestion })).toBeVisible();
    await expect(page.getByText(approvalQuestion), `${label}: the rejected proposal never reaches Jane`).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /^What security outcomes matter most/ })).toHaveValue(outcomesAnswer);
    await expect(page.getByRole('textbox', { name: /^How is .* protected\?/ })).toHaveValue(protectionAnswer);
    await expect(page.getByRole('textbox', { name: /^What does the external provider do\?/ })).toHaveValue(providerAnswer);
    await expectNoAiForRequestor(page, `${label}: Jane’s questionnaire`);
    await expectNoSeriousViolations(page, `${label}: Jane’s questionnaire`);
    await expectNoHorizontalOverflow(page, `${label}: Jane’s questionnaire`);
  });

  journey = { title, requestId: submitted.documentId, requestNumber: submitted.requestNumber, questionnaireId };
});

/** The journey's records; a test that follows it is skipped in serial mode when the journey failed. */
function journeyRecords(): Journey {
  if (!journey) throw new Error('QUES11_QUES12_JOURNEY did not finish, so there is no questionnaire to check');
  return journey;
}

/*
 * D-31 (15-CONTEXT authorisation; T-15 register): the Secondary Requestor reaches none of Jane's questionnaire or its AI
 * surfaces. Strapi's refusals are proven by 15-06 to 15-09's tests and matrix rows; this is the browser's view of them.
 */
test('QUES12_SECONDARY_REQUESTOR_REFUSED @journey: the Secondary Requestor is refused Jane’s questionnaire and every AI surface', async ({ page }) => {
  test.setTimeout(120_000);
  const { questionnaireId, requestId } = journeyRecords();
  const label = `QUES12_SECONDARY_REQUESTOR_REFUSED at ${page.viewportSize()?.width}px`;
  await switchTo(page, 'Secondary Requestor');

  await page.goto(requestorQuestionnairePath(questionnaireId));
  await expect(page.getByText('You don’t have permission to view this questionnaire'), `${label}: the Requestor route refuses`).toBeVisible();
  await expect(page.getByText(offshoreNote)).toHaveCount(0);
  await expect(page.getByText(editedCountryQuestion)).toHaveCount(0);
  await expectNoAiForRequestor(page, `${label}: the Requestor route`);

  await page.goto(questionnairePath(questionnaireId));
  await expect(page.getByText('You don’t have permission to review this questionnaire'), `${label}: the analyst route refuses`).toBeVisible();
  await expect(page.getByText(editedCountryQuestion)).toHaveCount(0);
  await expectNoAiForRequestor(page, `${label}: the analyst route`);

  await page.goto(analystPath(requestId));
  await expect(page.getByText('You don’t have permission to review this request'), `${label}: the hub refuses`).toBeVisible();
  await expectNoAiForRequestor(page, `${label}: the hub`);
  await expectNoSeriousViolations(page, `${label}: the refused hub`);
});

/*
 * D-07, D-31 (15-UI-SPEC §11.1): Jane sees no AI proposal, instruction, Answered note or AI event anywhere: on her
 * questionnaire, in its history and on her request.
 */
test('QUES12_REQUESTOR_SEES_NO_AI @journey: the Requestor sees no AI proposal, instruction, Answered note or AI event', async ({ page }) => {
  test.setTimeout(120_000);
  const { questionnaireId, requestId } = journeyRecords();
  const label = `QUES12_REQUESTOR_SEES_NO_AI at ${page.viewportSize()?.width}px`;
  await switchTo(page, 'Requestor');

  await page.goto(requestorQuestionnairePath(questionnaireId));
  await expect(page.getByRole('textbox', { name: new RegExp(`^${editedCountryQuestion.replace(/[?]/g, '\\?')}`) })).toBeVisible();
  await expectNoAiForRequestor(page, `${label}: her questionnaire`);
  const history = page.getByRole('region', { name: 'Questionnaire revision timeline' });
  await expect(history).toBeVisible();
  for (const entry of ['Proposals requested from the AI', 'Plain-language rewrite requested from the AI', 'AI proposal, confirmed', 'Instruction']) {
    await softly(history.getByText(entry), `${label}: her history shows no ${entry}`).toHaveCount(0);
  }

  await page.goto(requestorPath(requestId));
  await expect(page.getByRole('main')).toBeVisible();
  await softly(page.getByRole('region', { name: 'AI proposals', exact: true }), `${label}: no panel on her request`).toHaveCount(0);
  await softly(page.getByText(/AI proposals?:|Instruction for the AI|Suggest follow-up questions|Proposals requested from the AI/), `${label}: no AI wording on her request`).toHaveCount(0);
  await expectNoSeriousViolations(page, `${label}: her request`);
});

/*
 * D-32 (15-UI-SPEC §12): a Security Analyst on a request they raised sees no AI-steering control. Bob raises and submits
 * a request; his hub's Generate card shows §12's caption and no instruction field; the second analyst generates its
 * questionnaire; Bob's questionnaire page says another Security Analyst handles the AI, with no rewrite or start.
 */
test('QUES11_REQUESTING_ANALYST @journey: a requesting analyst sees no AI-steering control and the line saying another Security Analyst handles it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const label = `QUES11_REQUESTING_ANALYST at ${page.viewportSize()?.width}px`;
  const title = `Bob’s own request ${testInfo.project.name} ${Date.now().toString(36)}`;

  await switchTo(page, 'Security Analyst');
  const own = await createSubmittedRequest(page, { title, assessmentType: 'BAU', businessCriticality: 'Moderate', dueDate: null });
  await page.goto(analystPath(own.documentId));
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate questionnaire' })).toBeVisible();
  await expect(page.getByText('You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.'), `${label}: §12’s caption on Generate`).toBeVisible();
  await expect(page.getByLabel('Instruction for the AI (optional)'), `${label}: no instruction field`).toHaveCount(0);
  await expectNoSeriousViolations(page, `${label}: the hub card`);

  await switchTo(page, 'Second Security Analyst');
  await page.goto(analystPath(own.documentId));
  const questionnaireId = await generateAndOpen(page, label);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(own.documentId));
  await expect(page.getByText('You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.')).toBeVisible();
  await page.getByRole('button', { name: 'Replace questionnaire', exact: true }).click();
  const replaceDialog = page.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
  await expect(replaceDialog.getByText('You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.')).toBeVisible();
  await expect(replaceDialog.getByLabel('Instruction for the AI (optional)')).toHaveCount(0);
  await replaceDialog.getByRole('button', { name: 'Keep this questionnaire', exact: true }).click();
  await page.goto(questionnairePath(questionnaireId));
  const panel = panelOf(page);
  await expect(panel.getByText('You raised this request, so another Security Analyst handles the AI for it.'), `${label}: §12’s line in the panel`).toBeVisible();
  await expect(page.getByRole('button', { name: /^Rewrite in plain language/ }), `${label}: no rewrite`).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suggest follow-up questions' }), `${label}: no start`).toHaveCount(0);
  await expect(panel.getByLabel('Instruction for the AI (optional)'), `${label}: no instruction field`).toHaveCount(0);
  await expectNoSeriousViolations(page, `${label}: the questionnaire`);

  await page.goto(analystPath(own.documentId));
  await expect(page.getByText(/^AI proposals: /), `${label}: no proposals line on the hub`).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suggest follow-up questions' }), `${label}: no start on the hub`).toHaveCount(0);
  await expect(page.getByLabel('Instruction for the AI (optional)'), `${label}: no instruction field on the hub`).toHaveCount(0);
  await expectNoHorizontalOverflow(page, `${label}: the hub`);
});

/* D6 + FE-01/02: the Requestor's real server action is refused after an analyst take-back;
 * both refresh and reload must restore the same tab's text without touching another actor's records. */
test('QUES12_TAKE_BACK_RECOVERY @journey: a refused answer survives soft refresh and reload after re-release', async ({ page, browser }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await switchTo(page, 'Requestor');
  const request = await createSubmittedRequest(page, {
    title: `Take-back recovery ${testInfo.project.name} ${Date.now().toString(36)}`,
    assessmentType: 'Project', businessCriticality: 'High', dueDate: null,
  });
  const analystContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, baseURL: testInfo.project.use.baseURL });
  const analyst = await analystContext.newPage();
  await analyst.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await switchTo(analyst, 'Security Analyst');
    await analyst.goto(analystPath(request.documentId));
    const questionnaireId = await generateAndOpen(analyst, 'take-back recovery');
    await analyst.goto(questionnairePath(questionnaireId));
    const release = async () => {
      await governanceOf(analyst).getByRole('button', { name: 'Release questionnaire' }).click();
      const dialog = analyst.getByRole('alertdialog', { name: 'Release this questionnaire?' });
      await dialog.getByRole('button', { name: 'Release questionnaire' }).click();
      await expect(dialog).toBeHidden();
      await expect(analyst.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();
    };
    const takeBack = async () => {
      await governanceOf(analyst).getByRole('button', { name: 'Return to analyst review' }).click();
      const dialog = analyst.getByRole('alertdialog', { name: 'Return questionnaire to analyst review?' });
      await dialog.getByLabel('Reason').fill('Updating the questionnaire while retaining the Requestor’s draft answers.');
      await dialog.getByRole('button', { name: 'Return to analyst review' }).click();
      await expect(dialog).toBeHidden();
      await expect(governanceOf(analyst).getByRole('button', { name: 'Release questionnaire' })).toBeVisible();
    };
    await release();
    await page.goto(requestorQuestionnairePath(questionnaireId));
    const answer = page.getByRole('textbox', { name: /^What security outcomes matter most/ });
    await expect(answer).toBeVisible();
    for (const mode of ['soft refresh', 'reload'] as const) {
      // D-25 only restores a kept value into an empty question. Clear the value
      // persisted by the first pass before testing the second recovery route.
      if (mode === 'reload') {
        await answer.fill('');
        await answer.press('Tab');
        await expect(page.locator('[data-save-status="saved"]').first()).toBeVisible();
      }
      await takeBack();
      const text = `Unsaved ${mode} answer ${testInfo.project.name}: keep the platform records private.`;
      await answer.fill(text);
      await answer.press('Tab');
      await expect(page.getByText('A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.').first()).toBeVisible();
      await expect(answer).toHaveValue(text);
      await release();
      if (mode === 'soft refresh') await page.getByRole('button', { name: 'Refresh page', exact: true }).click();
      else await page.reload();
      await expect(answer).toHaveValue(text);
      await expect(page.getByText(/unsaved answer(?:s)? (?:was|were) restored from earlier in this session/).first()).toBeVisible();
      await expect(page.locator('[data-save-status="saved"]').first()).toBeVisible();
      await page.reload();
      await expect(answer, 'The restored value was acknowledged by Strapi, not only held in the DOM.').toHaveValue(text);
    }
    await expectNoSeriousViolations(page, 'take-back recovery Requestor');
    await expectNoHorizontalOverflow(page, 'take-back recovery Requestor');
  } finally {
    await analystContext.close();
  }
});

/* D2: a submitted questionnaire's hub retains its proposal count, focused job holder and review link. */
test('QUES12_SUBMITTED_HUB_JOB @journey: follow-up work stays visible on the submitted questionnaire hub', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await switchTo(page, 'Requestor');
  const request = await createSubmittedRequest(page, {
    title: `Submitted hub job ${testInfo.project.name} ${Date.now().toString(36)}`,
    assessmentType: 'Project', businessCriticality: 'High', dueDate: null,
  });
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(request.documentId));
  const questionnaireId = await generateAndOpen(page, 'submitted hub job');
  await page.goto(questionnairePath(questionnaireId));
  await governanceOf(page).getByRole('button', { name: 'Release questionnaire' }).click();
  const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
  await release.getByRole('button', { name: 'Release questionnaire' }).click();
  await expect(release).toBeHidden();
  await switchTo(page, 'Requestor');
  await janeAnswersAndSubmits(page, questionnaireId);
  await page.goto(requestorPath(request.documentId));
  await addNote(page, request.requestNumber, offshoreNote, 'button');
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(request.documentId));
  const mark = noteWith(page, request.requestNumber, offshoreNote).getByRole('switch', { name: 'Changes the AI inputs' });
  await mark.click();
  await expect(mark).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('AI proposals: none open', { exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: 'Suggest follow-up questions', exact: true });
  await start.focus();
  await start.press('Enter');
  await expect(page.locator('[data-ai-proposals-job-status]')).toBeFocused();
  const review = page.getByRole('link', { name: 'Review AI proposals', exact: true });
  await expect(review).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('AI proposals: 3 open', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, 'submitted hub completed job');
  await expectNoHorizontalOverflow(page, 'submitted hub completed job');
  await review.click();
  await expect(panelOf(page)).toBeInViewport();
  await expect(panelOf(page)).toBeFocused();
  await expect(panelOf(page).getByText(countryQuestion, { exact: true }).first()).toBeVisible();
});
