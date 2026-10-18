import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { completeRiskForRelease, confirmRemainingToastText, expectDecisionRecorded } from './helpers/assessment-release';
import { signInAs, type SignInRole } from './helpers/navigation';
import { submitRequestFromItsPage } from './helpers/requests';

/*
 * Phase 16 end to end (D-50; 16-UI-SPEC §16 E1): risk curation and targeted AI re-runs on records this spec creates. A
 * UAT-A-like Project request for a payroll SaaS, whose answers describe unsigned payment files reconciled by hand,
 * partial segregation of duties and an untested pay-run fallback, goes through questionnaire generation, the
 * Requestor's answers and the deterministic draft. The journey then withdraws, reinstates and withdraws a Risk, asks the
 * AI for more risks and to rewrite one, decides every proposal, releases, and proves what stays and what is refused.
 * Each project (1440 and 375) creates its own records. The deterministic providers and the empty classification
 * ceiling run throughout (playwright.config.ts). API refusals are read from Strapi with the development identity, the
 * way the web's own transport sends it.
 */

/* The Risk statement the deterministic provider proposes for payment files (deterministic-risk-proposal-provider.ts). */
const paymentFileStatement = 'Unsigned payment files reconciled by hand could be altered before the pay run without detection';
const withdrawalReason = 'Proposed under the wrong Risk Type';
const reinstatementReason = 'Needed after all while the Risk Type is checked';
const releasedNotice = 'This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.';
const requestingAnalystLine = 'You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.';
const registerNotice = 'Withdrawn risks don’t count in any assessment, figure or export. Only Security Analysts see them.';

const softly = expect.configure({ soft: true });

/* The development identities Strapi seeds, as the web's transport names them (development-session-adapter.ts). */
const identities = {
  'Security Analyst': 'bob.doe@idambox.com',
  'Secondary Requestor': 'maya.requestor@idambox.com',
} as const;

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: label }).toBe(true);
}

/* Zero serious or critical axe violations, and no horizontal page scroll (16-UI-SPEC Accessibility contract). */
async function expectAccessible(page: Page, label: string): Promise<void> {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`);
  expect(serious, `${label} at ${page.viewportSize()?.width}px has no serious axe violation`).toEqual([]);
  await expectNoOverflow(page, `${label} at ${page.viewportSize()?.width}px has no horizontal overflow`);
}

async function switchTo(page: Page, role: SignInRole): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, role);
}

/* Strapi, called as the web's transport calls it: the run's API token and the development identity header. */
async function strapiAs(request: APIRequestContext, role: keyof typeof identities, method: 'GET' | 'POST', path: string, data?: unknown) {
  const origin = process.env.CSRM_E2E_STRAPI_ORIGIN;
  const token = process.env.CSRM_E2E_DEVELOPMENT_API_TOKEN;
  if (!origin || !token) throw new Error('E2E_STRAPI_API_UNAVAILABLE');
  const response = await request.fetch(`${origin}/api${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'x-csrm-dev-identity': identities[role] },
    ...(data === undefined ? {} : { data }),
  });
  return { status: response.status(), body: await response.text() };
}

function reasonOf(body: string): string | undefined {
  try {
    return (JSON.parse(body) as { error?: { details?: { reason?: string } } }).error?.details?.reason;
  } catch {
    return undefined;
  }
}

/* Picks a named record in a request relation search, pressing Enter until the chosen name is listed. */
async function chooseNamed(page: Page, label: string, name: string): Promise<void> {
  const group = page.getByRole('group', { name: label });
  const combobox = group.getByRole('combobox', { name: `Search ${label.toLowerCase()}` });
  await combobox.fill(name);
  const selected = group.getByRole('list', { name: `Selected ${label}` });
  await expect(async () => {
    await combobox.press('Enter');
    await expect(selected.getByText(name)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

type CardFacts = { id: string; number: string; statement: string };

/*
 * The editor's Risk cards in the list shown now: the active ones, or the withdrawn ones once `Withdrawn` is chosen. Both
 * lists stay mounted and the one not chosen is `hidden` (FE3-01), so only the shown list is read. A card's id is
 * `risk-{documentId}`, unencoded (FE3-12).
 */
async function cardsOf(page: Page, withdrawn = false): Promise<CardFacts[]> {
  return page.locator(`[data-risk-list="${withdrawn ? 'withdrawn' : 'active'}"]:not([hidden]) [data-risk-card]`).evaluateAll((cards) => cards.map((card) => ({
    id: card.id.replace(/^risk-/, ''),
    number: (card.querySelector('[data-slot="card-title"], h3, h4')?.textContent ?? '').trim(),
    statement: (card.querySelector('[data-slot="card-description"], p.line-clamp-2')?.textContent ?? '').trim(),
  })));
}

function cardById(page: Page, id: string): Locator {
  return page.locator(`[id="risk-${id}"]`);
}

/* The card while it is in the Active list. Both Show lists stay mounted (16-REVIEW FE3-01), so a withdrawn card is still in the DOM, in the hidden Withdrawn list. */
function activeCardById(page: Page, id: string): Locator {
  return page.locator(`[data-risk-list="active"] [id="risk-${id}"]`);
}

/*
 * A Risk card's action (16-UI-SPEC §6.1, UI-D4): a pill in the card header from 768px; below it, an item of the
 * `Actions for {risk number}` menu.
 */
async function cardAction(page: Page, card: Locator, riskNumber: string, name: string): Promise<void> {
  if (!isPhone(page)) {
    await card.getByRole('button', { name, exact: true }).click();
    return;
  }
  await card.getByRole('button', { name: `Actions for ${riskNumber}`, exact: true }).click();
  const item = page.getByRole('menu', { name: `Actions for ${riskNumber}` }).getByRole('menuitem', { name, exact: true });
  // The menu animates in beside its button; choose once it sits in view, as a person would, so the click never scrolls
  // the page while the menu is still being placed.
  await expect(item).toBeInViewport();
  await item.click();
}

function toast(page: Page, text: string): Locator {
  return page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: text });
}

async function chooseShow(page: Page, option: RegExp): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: option }).click();
}

async function withdraw(page: Page, risk: CardFacts, reason: string): Promise<void> {
  await cardAction(page, cardById(page, risk.id), risk.number, `Withdraw risk ${risk.number}`);
  const form = page.getByRole('form', { name: `Withdraw ${risk.number}` });
  await expect(form.getByRole('textbox', { name: 'Reason for withdrawing' })).toBeFocused();
  await form.getByRole('textbox', { name: 'Reason for withdrawing' }).fill(reason);
  await form.getByRole('button', { name: 'Withdraw risk', exact: true }).click();
  await expectDecisionRecorded(page, `${risk.number} withdrawn.`, `Withdrawing ${risk.number}`);
}

/*
 * The `AI proposals` section (16-UI-SPEC §2): the region itself from 768px; below it, the full-screen sheet that the
 * summary card's `Review AI proposals` (or `Suggest more risks`) opens (§2.6).
 */
async function openProposals(page: Page, via: 'Review AI proposals' | 'Suggest more risks' = 'Review AI proposals'): Promise<Locator> {
  if (!isPhone(page)) return page.locator('#ai-proposals');
  const sheet = page.getByRole('dialog', { name: 'AI proposals' });
  if (await sheet.isVisible()) return sheet;
  await page.locator('#ai-proposals').getByRole('button', { name: via, exact: true }).click();
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeProposals(page: Page): Promise<void> {
  if (!isPhone(page)) return;
  const sheet = page.getByRole('dialog', { name: 'AI proposals' });
  if (!(await sheet.isVisible())) return;
  await sheet.getByRole('button', { name: 'Close AI proposals' }).click();
  await expect(sheet).toBeHidden();
}

async function readinessOutstanding(page: Page): Promise<Locator> {
  return page.getByRole('list', { name: 'Release requirements' });
}

type Draft = { requestId: string; editorPath: string; assessmentId: string };

/*
 * The UAT-A-like records (12-19's setup, with this phase's payroll answers): the Security Analyst records the systems
 * and the Restricted asset, `requester` raises and submits the request, an analyst generates and releases the
 * questionnaire, the requester answers it, and `drafter` generates the draft.
 */
async function draftUatALike(page: Page, suffix: string, requester: SignInRole, drafter: SignInRole): Promise<Draft> {
  const payroll = `Payroll SaaS ${suffix}`;
  const finance = `General ledger ${suffix}`;
  const asset = `Employee pay details ${suffix}`;
  const title = `Payroll SaaS rollout ${suffix}`;

  await switchTo(page, 'Security Analyst');
  for (const [name, internetFacing] of [[payroll, true], [finance, false]] as const) {
    await page.goto('/app/admin/information-systems/new');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill(`${name} for the Phase 16 journey.`);
    if (internetFacing) await page.getByRole('radio', { name: 'Yes, internet-facing' }).check();
    await page.getByRole('button', { name: 'Create Information System' }).click();
    await expect(page.getByText('Information System created.')).toBeVisible();
  }
  await page.goto('/app/admin/information-assets/new');
  await page.getByLabel('Name').fill(asset);
  await page.getByLabel('Description').fill('Personal and bank details used to pay employees.');
  await page.getByLabel('Data classification').selectOption('Restricted');
  await page.getByRole('group', { name: 'Contains personal data' }).getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('button', { name: 'Create Information Asset' }).click();
  await expect(page.getByText('Information Asset created.')).toBeVisible();

  await switchTo(page, requester);
  await page.goto('/app/requests/new');
  await page.getByRole('textbox', { name: 'Request title' }).fill(title);
  await page.getByRole('textbox', { name: 'Description' }).fill('Move payroll to a SaaS platform. Pay runs are uploaded to the bank as files.');
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
  await page.getByRole('textbox', { name: 'Division' }).fill('Corporate');
  await page.getByRole('textbox', { name: 'Business unit' }).fill('People and Finance');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Pay employees accurately and on time.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
  await page.getByRole('checkbox', { name: 'Third-party involvement' }).check();
  await page.getByRole('textbox', { name: 'Third-party details' }).fill('The SaaS provider runs each pay run.');
  await page.getByRole('textbox', { name: 'Regulatory requirements' }).fill('Privacy Act 1988 and tax file number obligations');
  for (const name of [payroll, finance]) await chooseNamed(page, 'Information systems', name);
  await chooseNamed(page, 'Information assets', asset);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
  const requestId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  await submitRequestFromItsPage(page);

  await switchTo(page, drafter);
  await page.goto(`/app/review/requests/${encodeURIComponent(requestId)}`);
  await page.getByRole('button', { name: 'Generate questionnaire' }).click();
  const review = page.getByRole('link', { name: 'Review generated questionnaire' });
  await expect(review).toBeVisible({ timeout: 45_000 });
  await review.click();
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
  const questionnaireId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  const governance = page.getByRole('region', { name: 'Questionnaire governance' });
  await governance.getByRole('button', { name: 'Release questionnaire' }).click();
  const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
  await release.getByRole('button', { name: 'Release questionnaire' }).click();
  await expect(release).toBeHidden();
  await expect(page.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();

  await switchTo(page, requester);
  await page.goto(`/app/questionnaires/${encodeURIComponent(questionnaireId)}`);
  await page.getByRole('textbox', { name: /^What security outcomes matter most/ }).fill('Payment files must not be altered before the bank receives them. Today the payment files are unsigned and reconciled by hand.');
  await page.getByRole('group', { name: /^Is the stated business criticality/ }).getByRole('radio', { name: 'High', exact: true }).check();
  await page.getByRole('group', { name: /^Is an external provider involved\?/ }).getByRole('radio', { name: 'Yes', exact: true }).check();
  await page.getByRole('textbox', { name: /^What does the external provider do\?/ }).fill('The SaaS provider runs each pay run and holds employee bank details.');
  await page.getByRole('textbox', { name: /^How is .* protected\?/ }).fill('Access is limited to the payroll team, with only partial segregation of duties between preparing and releasing a pay run.');
  // The pay-run fallback has never been tested, so recovery is Not sure.
  await page.getByRole('group', { name: /^Has recovery been tested\?/ }).getByRole('radio', { name: 'Not sure', exact: true }).check();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Submit this questionnaire?' }).getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();

  await switchTo(page, drafter);
  await page.goto(`/app/review/requests/${encodeURIComponent(requestId)}`);
  await page.getByRole('button', { name: 'Generate assessment draft' }).click();
  const open = page.getByRole('link', { name: 'Open assessment draft' });
  await expect(open).toBeVisible({ timeout: 60_000 });
  const editorPath = String(await open.getAttribute('href'));
  return { requestId, editorPath, assessmentId: decodeURIComponent(editorPath.split('/').at(-1)!) };
}

/* What the journey leaves for the negative tests that follow it in the same project. */
const journey: { assessmentId?: string; withdrawn?: CardFacts; active?: CardFacts } = {};

test.describe.serial('risk curation and targeted AI re-runs', () => {
  test('@journey an analyst curates a draft with withdrawal and targeted AI re-runs, then releases it', async ({ page, request }, testInfo) => {
    test.setTimeout(900_000);
    const health = await request.get(strapiHealthUrl);
    if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const suffix = `${Date.now().toString(36)}-${testInfo.project.name}`;

    const draft = await test.step('the UAT-A-like request is drafted by the deterministic provider', () => draftUatALike(page, suffix, 'Requestor', 'Security Analyst'));
    journey.assessmentId = draft.assessmentId;
    await page.goto(draft.editorPath);
    await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
    const drafted = await cardsOf(page);
    expect(drafted.length, 'the draft proposes several risks').toBeGreaterThanOrEqual(3);
    const [rewritten, , target] = drafted as [CardFacts, CardFacts, CardFacts];
    journey.withdrawn = target;
    journey.active = rewritten;

    await test.step('PH16_SC1_WITHDRAW_LEAVES_READINESS', async () => {
      const requirements = await readinessOutstanding(page);
      await expect(requirements.getByRole('link', { name: new RegExp(`^${target.number}: `) }), 'the drafted risk has its readiness row').toBeVisible();
      await cardAction(page, cardById(page, target.id), target.number, `Withdraw risk ${target.number}`);
      const form = page.getByRole('form', { name: `Withdraw ${target.number}` });
      await expect(form.getByRole('textbox', { name: 'Reason for withdrawing' })).toBeFocused();
      await expectAccessible(page, 'the withdraw form');
      await form.getByRole('textbox', { name: 'Reason for withdrawing' }).fill(withdrawalReason);
      await form.getByRole('button', { name: 'Withdraw risk', exact: true }).click();
      await expectDecisionRecorded(page, `${target.number} withdrawn.`, `Withdrawing ${target.number}`);
      await expect(activeCardById(page, target.id), 'PH16_SC1_WITHDRAW_LEAVES_READINESS the card leaves Active').toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: `Active (${drafted.length - 1})` })).toBeChecked();
      await expect(requirements.getByRole('link', { name: new RegExp(`^${target.number}: `) }), 'PH16_SC1_WITHDRAW_LEAVES_READINESS no readiness row for it').toHaveCount(0);
      softly((await page.getByRole('list', { name: 'Met release requirements', includeHidden: true }).allTextContents()).join(' '), 'no met readiness row names it').not.toContain(target.number);

      await chooseShow(page, /^Withdrawn \(1\)$/);
      await expect(page).toHaveURL(/[?&]risks=withdrawn/);
      const card = cardById(page, target.id);
      await expect(card.getByText(`Reason: “${withdrawalReason}”`), 'PH16_SC1_WITHDRAW_LEAVES_READINESS the reason').toBeVisible();
      await expect(card.getByText(/^Withdrawn by Bob Doe · /), 'PH16_SC1_WITHDRAW_LEAVES_READINESS who and when').toBeVisible();
      await expect(card.locator('time')).toHaveCount(1);
      await card.getByRole('button', { name: 'Show details' }).click();
      await expect(card.getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
      await expectAccessible(page, 'the Withdrawn list with details shown');
    });

    await test.step('PH16_SC1_HISTORY', async () => {
      const card = cardById(page, target.id);
      await card.getByRole('button', { name: `History of ${target.number}` }).click();
      const sheet = page.getByRole('dialog', { name: `History of ${target.number}` });
      await expect(sheet.getByText('Risk withdrawn', { exact: true }).filter({ visible: true }).first(), 'PH16_SC1_HISTORY the withdrawal is listed').toBeVisible();
      await expect(sheet.getByText(`Reason: “${withdrawalReason}”`).filter({ visible: true }).first(), 'PH16_SC1_HISTORY with its reason').toBeVisible();
      await expectAccessible(page, 'the history sheet');
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
    });

    await test.step('PH16_UNDO_AND_REINSTATE', async () => {
      // Reinstate with a reason from the Withdrawn list, then withdraw again from Active and undo it from the toast.
      const card = cardById(page, target.id);
      await card.getByRole('button', { name: `Reinstate risk ${target.number}` }).click();
      const reinstate = page.getByRole('form', { name: `Reinstate ${target.number}` });
      await reinstate.getByRole('textbox', { name: 'Reason for reinstating' }).fill(reinstatementReason);
      await reinstate.getByRole('button', { name: 'Reinstate risk', exact: true }).click();
      await expectDecisionRecorded(page, `${target.number} reinstated.`, `Reinstating ${target.number}`);
      await chooseShow(page, /^Active \(/);
      await expect(cardById(page, target.id), 'PH16_UNDO_AND_REINSTATE the reinstated risk is active again').toBeVisible();

      await cardAction(page, cardById(page, target.id), target.number, `Withdraw risk ${target.number}`);
      const form = page.getByRole('form', { name: `Withdraw ${target.number}` });
      await form.getByRole('textbox', { name: 'Reason for withdrawing' }).fill('Withdrawn by mistake');
      await form.getByRole('button', { name: 'Withdraw risk', exact: true }).click();
      const withdrawn = toast(page, `${target.number} withdrawn.`);
      await expect(withdrawn).toBeVisible();
      await withdrawn.hover();
      await withdrawn.getByRole('button', { name: 'Undo' }).click();
      await page.mouse.move(0, 0);
      await expectDecisionRecorded(page, `Withdrawal undone. ${target.number} is back in the assessment.`, `Undoing the withdrawal of ${target.number}`);
      await expect(cardById(page, target.id), 'PH16_UNDO_AND_REINSTATE Undo brings the card back').toBeVisible();

      await withdraw(page, target, withdrawalReason);
      await page.reload();
      await expect(page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: 'Withdrawn (1)' }), 'PH16_UNDO_AND_REINSTATE it ends withdrawn').toBeVisible();
    });

    const draftedStatements = new Set(drafted.map((risk) => risk.statement));
    let added: CardFacts | undefined;
    await test.step('PH16_SC2_SUGGEST_PAYMENT_FILE', async () => {
      let section = await openProposals(page, 'Suggest more risks');
      const instruction = section.locator('#ai-proposals-instruction');
      await instruction.fill('Risks about payment file integrity');
      await section.getByRole('button', { name: 'Suggest more risks', exact: true }).click();
      const proposals = section.locator('li[id^="ai-proposal-"]');
      const payment = proposals.filter({ hasText: paymentFileStatement });
      await expect(payment, 'PH16_SC2_SUGGEST_PAYMENT_FILE the payment-file risk is proposed').toBeVisible({ timeout: 90_000 });
      section = await openProposals(page);
      await expect(section.getByRole('button', { name: '1 left out' }), 'PH16_SC2_SUGGEST_PAYMENT_FILE the restatement is left out').toBeVisible();
      const subjects = await proposals.evaluateAll((items) => items.map((item) => (item.querySelector('p.font-medium')?.textContent ?? '').trim()));
      for (const subject of subjects) softly(draftedStatements.has(subject), `PH16_SC2_SUGGEST_PAYMENT_FILE no proposed card repeats a drafted statement (${subject})`).toBe(false);
      await expectAccessible(page, 'the AI proposals with proposed risks');
      // FE4-13: the deterministic provider's S4 rewords the first drafted risk, which the adapter keeps and flags similar.
      const compare = section.getByRole('button', { name: /^Compare with / }).first();
      await expect(compare, 'PH16_SC2_SUGGEST_PAYMENT_FILE the similar proposal offers Compare').toBeVisible();
      await compare.click();
      await expect(compare).toHaveAttribute('aria-expanded', 'true');
      await expectAccessible(page, 'the AI proposals with a compare open');

      await payment.getByRole('button', { name: `Add to assessment: ${paymentFileStatement}` }).click();
      const addedToast = toast(page, 'added to the assessment. Review its AI-proposed fields.');
      await expect(addedToast).toBeVisible({ timeout: 30_000 });
      const addedNumber = (/^(\S+) added to the assessment/.exec((await addedToast.textContent()) ?? '') ?? [])[1] ?? '';
      expect(addedNumber, 'the toast names the added risk').toMatch(/\S/);
      const openAdded = addedToast.getByRole('button', { name: `Open ${addedNumber}`, exact: true });
      await expect(openAdded, 'PH16_SC2_SUGGEST_PAYMENT_FILE the toast offers Open {risk number}').toBeVisible();
      if (!isPhone(page)) {
        // §5.5: from 768px the section sits in the page, so the toast's action lands on the new Risk card.
        await addedToast.hover();
        await openAdded.click();
        await page.mouse.move(0, 0);
        await expect(page.locator('[data-risk-card]:not([data-withdrawn])').filter({ hasText: addedNumber }).first(), 'PH16_SC2_SUGGEST_PAYMENT_FILE Open {risk number} lands on the new card').toBeInViewport({ timeout: 15_000 });
      }
      await closeProposals(page);
      await page.reload();
      added = (await cardsOf(page)).find((risk) => risk.number === addedNumber);
      expect(added, `PH16_SC2_SUGGEST_PAYMENT_FILE ${addedNumber} is an active risk`).toBeDefined();
      const card = cardById(page, added!.id);
      await expect(card.getByText(paymentFileStatement).filter({ visible: true }).first()).toBeVisible();
      const confirm = card.getByRole('button', { name: new RegExp(`^Confirm remaining \\(\\d+\\) on ${addedNumber}$`) });
      const confirmName = String(await confirm.getAttribute('aria-label'));
      await confirm.click();
      await expectDecisionRecorded(page, confirmRemainingToastText(confirmName), confirmName);
      await expect(card.getByRole('button', { name: /^Confirm remaining/ }), 'PH16_SC2_SUGGEST_PAYMENT_FILE its fields are confirmed').toHaveCount(0);
    });

    await test.step('PH16_SC3_REWRITE_DIFF', async () => {
      const card = cardById(page, rewritten.id);
      await cardAction(page, card, rewritten.number, `Rewrite this risk: ${rewritten.number}`);
      const form = page.getByRole('dialog', { name: `Rewrite ${rewritten.number}` });
      await expect(form).toBeVisible();
      await form.getByRole('button', { name: 'Rewrite risk' }).click();
      const confirmStatement = card.getByRole('button', { name: `Confirm: Risk statement on ${rewritten.number}` });
      await expect(confirmStatement, 'PH16_SC3_REWRITE_DIFF the comparison shows changes').toBeVisible({ timeout: 90_000 });
      await expectAccessible(page, 'an AI rewrite with open changes');
      await confirmStatement.click();
      await expectDecisionRecorded(page, `Risk statement confirmed on ${rewritten.number}.`, 'Confirming the rewritten statement');
      await card.getByRole('button', { name: `Reject: Risk cause on ${rewritten.number}` }).click();
      await card.getByRole('button', { name: 'Reject proposal' }).click();
      await expectDecisionRecorded(page, 'Risk cause change rejected.', 'Rejecting the rewritten cause');
      const section = card.locator(`[id="risk-${rewritten.id}-rewrite"]`);
      await expect(section.getByText(/^Confirmed/).filter({ visible: true }).first(), 'PH16_SC3_REWRITE_DIFF one change confirmed').toBeVisible();
      await expect(section.getByText(/^Rejected/).filter({ visible: true }).first(), 'PH16_SC3_REWRITE_DIFF one change rejected').toBeVisible();
      await expectAccessible(page, 'an AI rewrite with decided changes');
    });

    await test.step('PH16_READINESS_WAITS_FOR_DECISIONS', async () => {
      await page.reload();
      const requirements = await readinessOutstanding(page);
      const decisions = requirements.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Decisions on AI proposals' }) });
      await expect(decisions, 'PH16_READINESS_WAITS_FOR_DECISIONS outstanding').toBeVisible();
      await expect(decisions.getByText(/^\d+ open$/)).toBeVisible();

      // The rewrite's remaining change, then the suggestion request's remaining proposals, once each has rendered.
      const card = cardById(page, rewritten.id);
      await expect(card.getByRole('region', { name: 'AI rewrite' }), 'the rewrite still has an open change').toBeVisible();
      // FE4-13: both bulk rejections are guaranteed, so each is asserted rather than tried: the rewrite's open change, and
      // the suggestion request's S4 rewording, still open after the payment-file risk was added.
      const rewriteRemaining = card.getByRole('button', { name: /^Reject remaining \(\d+\)/ });
      await expect(rewriteRemaining, 'PH16_READINESS_WAITS_FOR_DECISIONS the rewrite offers Reject remaining').toBeVisible();
      await rewriteRemaining.click();
      await card.getByRole('button', { name: /^Reject \d+ changes?$/ }).click();
      await expectDecisionRecorded(page, 'rejected.', 'Rejecting the rewrite’s remaining changes');
      const section = await openProposals(page);
      await expect(section).toBeVisible();
      const groupRemaining = section.getByRole('button', { name: /^Reject remaining \(\d+\)/ }).first();
      await expect(groupRemaining, 'PH16_READINESS_WAITS_FOR_DECISIONS the suggestion request offers Reject remaining').toBeVisible();
      await groupRemaining.click();
      await section.getByRole('button', { name: /^Reject \d+ proposals?$/ }).click();
      await expectDecisionRecorded(page, 'rejected.', 'Rejecting the remaining proposed risks');
      await closeProposals(page);
      await page.reload();
      await expect(requirements, 'the readiness list has rendered').toBeVisible();
      await expect(page.getByRole('link', { name: 'Decisions on AI proposals' }), 'PH16_READINESS_WAITS_FOR_DECISIONS met after Reject remaining').toHaveCount(0);
    });

    await test.step('the analyst completes, confirms and releases', async () => {
      const forms = page.getByRole('region', { name: 'Identified Risks' }).locator('form');
      await expect(forms, 'every active risk has its form').toHaveCount(drafted.length);
      const count = await forms.count();
      for (let index = 0; index < count; index += 1) await completeRiskForRelease(page, index, 'Accept');
      const confirmRemaining = page.getByRole('button', { name: /^Confirm remaining \(\d+\)/ });
      for (let pass = 0; pass < 12 && await confirmRemaining.count() > 0; pass += 1) {
        const confirm = confirmRemaining.first();
        const name = String(await confirm.getAttribute('aria-label'));
        await confirm.click();
        await expectDecisionRecorded(page, confirmRemainingToastText(name), name);
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
      }
      await page.reload();
      await expect(page.getByText('All release requirements are met')).toBeVisible();
      await page.getByRole('button', { name: 'Release assessment' }).click();
      await page.getByRole('alertdialog', { name: 'Release this risk assessment?' }).getByRole('button', { name: 'Confirm release' }).click();
      await expect(page.getByText('Assessment released', { exact: true })).toBeVisible();
    });

    await test.step('PH16_SC4_RELEASED_NO_CONTROLS', async () => {
      await page.reload();
      const main = page.getByRole('main');
      // The released editor has rendered every active card before any control is proved absent.
      await expect(page.getByText(releasedNotice).filter({ visible: true }).first(), 'PH16_SC4_RELEASED_NO_CONTROLS the released line').toBeVisible();
      await expect(page.locator('[data-risk-card]:not([data-withdrawn])'), 'every active risk is shown after release').toHaveCount(drafted.length);
      await expect(cardById(page, rewritten.id).getByRole('button', { name: `History of ${rewritten.number}` })).toBeVisible();
      for (const name of [/^Withdraw risk/, /^Reinstate risk/, /^Rewrite this risk/, /^Suggest more risks$/, /^Actions for /, /^Confirm: /, /^Discard new risk$/]) {
        await softly(main.getByRole('button', { name }), `PH16_SC4_RELEASED_NO_CONTROLS no ${name}`).toHaveCount(0);
      }
      await chooseShow(page, /^Withdrawn \(1\)$/);
      await expect(cardById(page, target.id).getByRole('button', { name: `History of ${target.number}` }), 'history stays after release').toBeVisible();
      await expectAccessible(page, 'the released editor under Withdrawn');

      const refusals = [
        ['withdraw', await strapiAs(request, 'Security Analyst', 'POST', `/v1/risk_assessments/${draft.assessmentId}/risk_withdrawals`, { riskIds: [rewritten.id], reason: 'After release' })],
        ['reinstate', await strapiAs(request, 'Security Analyst', 'POST', `/v1/risk_assessments/${draft.assessmentId}/risk_reinstatements`, { riskIds: [target.id], reason: 'After release' })],
        ['suggest', await strapiAs(request, 'Security Analyst', 'POST', `/v1/risk_assessments/${draft.assessmentId}/risk_suggestions`, {})],
        ['rewrite', await strapiAs(request, 'Security Analyst', 'POST', `/v1/risks/${rewritten.id}/rewrite`, {})],
      ] as const;
      for (const [act, response] of refusals) {
        softly({ status: response.status, reason: reasonOf(response.body) }, `PH16_SC4_RELEASED_NO_CONTROLS the API refuses ${act} after release`).toEqual({ status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' });
      }
    });

    await test.step('PH16_REQUESTOR_EXCLUDES_WITHDRAWN', async () => {
      await switchTo(page, 'Requestor');
      await page.goto(`/app/assessments/${encodeURIComponent(draft.assessmentId)}`);
      const main = page.getByRole('main');
      for (const risk of drafted.filter((item) => item.id !== target.id)) {
        await softly(main.getByText(risk.number, { exact: true }).filter({ visible: true }).first(), `PH16_REQUESTOR_EXCLUDES_WITHDRAWN lists ${risk.number}`).toBeVisible();
      }
      await softly(main.getByText(added!.number, { exact: true }).filter({ visible: true }).first(), 'PH16_REQUESTOR_EXCLUDES_WITHDRAWN lists the added risk').toBeVisible();
      const text = await main.innerText();
      expect(text, 'PH16_REQUESTOR_EXCLUDES_WITHDRAWN no withdrawn risk number').not.toContain(target.number);
      expect(text, 'PH16_REQUESTOR_EXCLUDES_WITHDRAWN no withdrawn statement').not.toContain(target.statement);
      expect(text, 'PH16_REQUESTOR_EXCLUDES_WITHDRAWN no withdrawal reason').not.toContain(withdrawalReason);
      expect(text, 'PH16_REQUESTOR_EXCLUDES_WITHDRAWN no hint of a withdrawal').not.toMatch(/withdrawn/i);
      await expectAccessible(page, 'the Requestor’s released view');
    });

    await test.step('PH16_REGISTER_WITHDRAWN_FILTER', async () => {
      await switchTo(page, 'Security Analyst');
      await page.goto('/app/risks');
      if (isPhone(page)) {
        await page.getByRole('button', { name: /^Filters \(\d+\)$/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Risk register filters' });
        const state = sheet.getByRole('combobox', { name: 'Risk state' });
        await expect(state.locator('option:checked')).toHaveText('Open and closed');
        await state.selectOption('withdrawn');
        await page.keyboard.press('Escape');
      } else {
        await page.getByRole('button', { name: 'More filters' }).click();
        const state = page.getByRole('dialog', { name: 'More filters' }).getByRole('combobox', { name: 'Risk state' });
        await expect(state.locator('option:checked')).toHaveText('Open and closed');
        await state.selectOption('withdrawn');
        await page.keyboard.press('Escape');
      }
      await expect(page).toHaveURL(/[?&]state=withdrawn/);
      await expect(page.getByText('Risk state: Withdrawn', { exact: true }).filter({ visible: true }).first(), 'PH16_REGISTER_WITHDRAWN_FILTER the chip').toBeVisible();
      await expect(page.getByText(registerNotice), 'PH16_REGISTER_WITHDRAWN_FILTER the notice').toBeVisible();
      const surface = isPhone(page) ? page.locator('[data-slot="data-table-mobile"]') : page.getByRole('table', { name: 'Risk Register results' });
      const link = surface.getByRole('link', { name: target.number, exact: true });
      await expect(link, 'PH16_REGISTER_WITHDRAWN_FILTER lists the withdrawn risk').toBeVisible();
      await expectAccessible(page, 'the register under Risk state: Withdrawn');
      await link.click();

      await expect(page.getByRole('heading', { level: 1, name: target.number })).toBeVisible();
      const notice = page.getByRole('alert').filter({ hasText: 'Withdrawn risk - read only' });
      await expect(notice, 'PH16_REGISTER_WITHDRAWN_FILTER the read-only notice').toContainText(`Bob Doe withdrew this risk on`);
      await expect(notice).toContainText(`“${withdrawalReason}”`);
      const open = notice.getByRole('link', { name: /^Open / });
      await expect(open, 'PH16_REGISTER_WITHDRAWN_FILTER Open {assessment number}').toHaveAttribute('href', `/app/review/assessments/${draft.assessmentId}?risks=withdrawn#risk-${target.id}`);
      await expect(page.getByRole('button', { name: 'Show history' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit risk' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /mitigation control/i })).toHaveCount(0);
      await expectAccessible(page, 'the register’s withdrawn detail');
    });
  });

  /*
   * T-16-40: another Requestor learns nothing of the assessment. The page is the in-shell not-found state, and Strapi
   * answers its risk list and the withdrawn risk's control implementations with the same 404 a missing record gets.
   */
  test('PH16_NEG_UNRELATED_REQUESTOR @journey: an unrelated Requestor is refused the assessment and its withdrawn risk', async ({ page, request }) => {
    test.setTimeout(180_000);
    const { assessmentId, withdrawn } = journey;
    // FE4-13: a security negative fails, never skips, when the journey did not leave it its assessment and withdrawn risk.
    expect(assessmentId, 'PH16_NEG_UNRELATED_REQUESTOR needs the journey’s released assessment').toBeTruthy();
    expect(withdrawn, 'PH16_NEG_UNRELATED_REQUESTOR needs the journey’s withdrawn risk').toBeTruthy();
    await switchTo(page, 'Secondary Requestor');
    await page.goto(`/app/assessments/${encodeURIComponent(assessmentId!)}`);
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Page not found', exact: true }), 'PH16_NEG_UNRELATED_REQUESTOR the not-found page').toBeVisible();
    expect(await page.content()).not.toContain(withdrawn!.number);
    await expectAccessible(page, 'the unrelated Requestor’s not-found page');

    const risks = await strapiAs(request, 'Secondary Requestor', 'GET', `/v1/risk_assessments/${assessmentId}/risks`);
    const missingRisks = await strapiAs(request, 'Secondary Requestor', 'GET', '/v1/risk_assessments/csrm-no-such-assessment/risks');
    const controls = await strapiAs(request, 'Secondary Requestor', 'GET', `/v1/risks/${withdrawn!.id}/control_implementations`);
    const missingControls = await strapiAs(request, 'Secondary Requestor', 'GET', '/v1/risks/csrm-no-such-risk/control_implementations');
    expect(risks.status, 'PH16_NEG_UNRELATED_REQUESTOR the risk list is 404').toBe(404);
    expect(controls.status, 'PH16_NEG_UNRELATED_REQUESTOR the withdrawn risk’s control implementations are 404').toBe(404);
    expect(risks.body, 'PH16_NEG_UNRELATED_REQUESTOR the risk list refusal reads as a missing record').toBe(missingRisks.body);
    expect(controls.body, 'PH16_NEG_UNRELATED_REQUESTOR the control refusal reads as a missing record').toBe(missingControls.body);
  });
});

/*
 * §12.3 (G-1; 16-UI-SPEC §2.4): on a request the Second Security Analyst raised and Bob drafted, she sees the line that
 * another Security Analyst asks the AI, no `Suggest more risks` or `Rewrite this risk`, and can still withdraw a risk.
 */
test('PH16_NEG_REQUESTING_ANALYST @journey: the analyst who raised the request sees no targeted AI control and can still withdraw', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const suffix = `own-${Date.now().toString(36)}-${testInfo.project.name}`;
  const draft = await draftUatALike(page, suffix, 'Second Security Analyst', 'Security Analyst');

  await switchTo(page, 'Second Security Analyst');
  await page.goto(draft.editorPath);
  await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
  await expect(page.getByText(requestingAnalystLine).filter({ visible: true }).first(), 'PH16_NEG_REQUESTING_ANALYST the requesting analyst’s line').toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Suggest more risks' }), 'PH16_NEG_REQUESTING_ANALYST no Suggest more risks').toHaveCount(0);
  await expect(main.getByRole('button', { name: /^Rewrite this risk/ }), 'PH16_NEG_REQUESTING_ANALYST no Rewrite this risk').toHaveCount(0);
  const [first] = await cardsOf(page);
  if (isPhone(page)) {
    await cardById(page, first.id).getByRole('button', { name: `Actions for ${first.number}` }).click();
    await expect(page.getByRole('menuitem', { name: /^Rewrite this risk/ }), 'PH16_NEG_REQUESTING_ANALYST no Rewrite in the menu').toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: `Withdraw risk ${first.number}` })).toBeVisible();
    await expectAccessible(page, 'the requesting analyst’s actions menu');
    await page.keyboard.press('Escape');
  }
  await expectAccessible(page, 'the requesting analyst’s editor');
  await withdraw(page, first, 'Covered by another risk in this assessment');
  await expect(activeCardById(page, first.id), 'PH16_NEG_REQUESTING_ANALYST she can still withdraw').toHaveCount(0);
});

/*
 * 16-UI-SPEC §5 and §6.3: Undo, and every act after a `Show` change, keeps the analyst where they were. The `Show`
 * choice moves the page address without a navigation; the act's refreshed page must not then move the page to its top
 * or remount the editor, which would take a just-opened menu out of view (found by PH16_UNDO_AND_REINSTATE at 375).
 */
test('PH16_UNDO_KEEPS_PLACE @journey: after a Show change, Undo keeps the restored card in view and the editor in place', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const draft = await draftUatALike(page, `place-${Date.now().toString(36)}-${testInfo.project.name}`, 'Requestor', 'Security Analyst');
  await page.goto(draft.editorPath);
  await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
  const [, , target] = await cardsOf(page) as [CardFacts, CardFacts, CardFacts];
  const show = page.getByRole('radiogroup', { name: 'Show' });

  await withdraw(page, target, withdrawalReason);
  await chooseShow(page, /^Withdrawn \(1\)$/);
  await page.getByRole('button', { name: `Reinstate risk ${target.number}` }).click();
  const reinstate = page.getByRole('form', { name: `Reinstate ${target.number}` });
  await reinstate.getByRole('textbox', { name: 'Reason for reinstating' }).fill(reinstatementReason);
  await reinstate.getByRole('button', { name: 'Reinstate risk', exact: true }).click();
  await expectDecisionRecorded(page, `${target.number} reinstated.`, `Reinstating ${target.number}`);
  await page.waitForLoadState('networkidle');
  await chooseShow(page, /^Active \(/);
  await expect(page).not.toHaveURL(/[?&]risks=/);
  // §6.3: choosing an option keeps focus on it.
  await expect(show.getByRole('radio', { name: /^Active \(/ }), 'PH16_UNDO_KEEPS_PLACE choosing Active keeps focus on it').toBeFocused();

  await withdraw(page, target, 'Withdrawn by mistake');
  await page.waitForLoadState('networkidle');
  // The editor is marked, so a remount by the refreshed page shows as a lost mark; every scroll after Undo is recorded.
  await page.locator('[data-risk-show]').evaluate((node) => { node.setAttribute('data-place-probe', 'kept'); });
  await page.evaluate(() => {
    const scrolls: number[] = [];
    (window as unknown as { __placeScrolls: number[] }).__placeScrolls = scrolls;
    addEventListener('scroll', () => scrolls.push(Math.round(scrollY)));
  });
  const withdrawn = toast(page, `${target.number} withdrawn.`).last();
  await withdrawn.hover();
  await withdrawn.getByRole('button', { name: 'Undo' }).click();
  await page.mouse.move(0, 0);
  await expectDecisionRecorded(page, `Withdrawal undone. ${target.number} is back in the assessment.`, `Undoing the withdrawal of ${target.number}`);
  const card = cardById(page, target.id);
  // §6.1: the card returns and gets focus, landed on so its header (its number and actions) shows.
  await expect(card, 'PH16_UNDO_KEEPS_PLACE the restored card gets focus').toBeFocused();
  const trigger = isPhone(page)
    ? card.getByRole('button', { name: `Actions for ${target.number}`, exact: true })
    : card.getByRole('button', { name: `Withdraw risk ${target.number}`, exact: true });
  await expect(trigger, 'PH16_UNDO_KEEPS_PLACE the card’s actions are in view').toBeInViewport();
  const landed = await page.evaluate(() => window.scrollY);
  await page.waitForLoadState('networkidle');

  const scrolls = await page.evaluate(() => (window as unknown as { __placeScrolls: number[] }).__placeScrolls);
  expect(scrolls, 'PH16_UNDO_KEEPS_PLACE the refreshed page never moves to its top').not.toContain(0);
  expect(await page.evaluate(() => window.scrollY), 'PH16_UNDO_KEEPS_PLACE the page stays where Undo left it').toBe(landed);
  await expect(trigger, 'PH16_UNDO_KEEPS_PLACE the card’s actions stay in view').toBeInViewport();
  await expect(page.locator('[data-risk-show][data-place-probe="kept"]'), 'PH16_UNDO_KEEPS_PLACE the editor is not remounted').toHaveCount(1);
});
