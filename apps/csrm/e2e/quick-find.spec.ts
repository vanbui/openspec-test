import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { signInAs } from './helpers/navigation';
import { createSubmittedRequest } from './helpers/requests';

/*
 * Quick find (UX-10; D-47 to D-52; UI-SPEC §3, §4). Ctrl+K or ⌘K, or the header's Search control, opens a dialog
 * whose one Server Action runs the viewer's own list searches; Enter opens the active option through the
 * navigation guard. Strapi scopes every read, so a result is always a record the viewer may open.
 *
 * The tests inside the `Quick find @journey` describe run in both projects against one database, desktop first
 * (playwright.config.ts): each creates its own uniquely titled record or only reads, and nothing in them depends on
 * the width. A test that proves one width only, or must run once, sits outside that describe.
 */

/*
 * The header's Search control (UI-SPEC §3): named Search at every width, from its content. Quick find is modal from the
 * moment it opens (its frame shows before its code arrives, D-52), and a modal hides the page behind it from assistive
 * technology, so the control is found with hidden elements included: its aria-expanded is read while quick find is open.
 * Counting hidden elements also counts the aria-hidden shortcut hint in the name (Search Ctrl K), so the name is matched
 * from its start.
 */
function searchControl(page: Page): Locator {
  return page.getByRole('banner', { includeHidden: true }).getByRole('button', { name: /^Search\b/, includeHidden: true });
}

/*
 * Presses Ctrl+K until quick find opens. Straight after a navigation the header may not have hydrated yet, and a
 * key pressed before then reaches no listener; the control's aria-expanded flips the moment the shortcut is
 * handled, so a press that was lost is pressed again and a press that landed is never repeated (it would close it).
 */
async function openQuickFindWithShortcut(page: Page): Promise<Locator> {
  await expect(async () => {
    if ((await searchControl(page).getAttribute('aria-expanded')) !== 'true') await page.keyboard.press('Control+K');
    await expect(searchControl(page)).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
  }).toPass();
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Quick find @journey', () => {
  test('UX10_FIND_AND_OPEN: a Requestor presses Ctrl+K, types a request number and opens the request with Enter', async ({ page }, testInfo) => {
    const title = `Quick find ${testInfo.project.name}${Date.now().toString(36)}`;
    await signInAs(page, 'Requestor');
    const { requestNumber, documentId } = await createSubmittedRequest(page, { title, assessmentType: 'BAU', businessCriticality: 'Moderate', dueDate: null });

    // Start from Home, so opening the result is a real navigation away from the page the shortcut was pressed on.
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();

    const dialog = await openQuickFindWithShortcut(page);
    const input = dialog.getByRole('combobox', { name: 'Search by number or title' });
    await expect(input, 'UX10_FIND_AND_OPEN: focus starts in the input').toBeFocused();
    await input.pressSequentially(requestNumber);

    const option = dialog.getByRole('group', { name: /^My requests/ }).getByRole('option', { name: `${requestNumber} · ${title}` });
    await expect(option, 'UX10_FIND_AND_OPEN: the request shows as {number} · {title}').toBeVisible();
    await expect(option).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await expect(page, 'UX10_FIND_AND_OPEN: Enter lands on the request page').toHaveURL(new RegExp(`/app/requests/${documentId}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
  });

  test('UX10_SCOPE_SECONDARY_REQUESTOR: the Secondary Requestor searches the Requestor’s request by number and by title and finds nothing, told what was searched', async ({ page }, testInfo) => {
    // A word only this request's title holds, so a match could only be this request (T-11-46).
    const word = `Qs${testInfo.project.name}${Date.now().toString(36)}`;
    const title = `Quick find scope ${word}`;
    await signInAs(page, 'Requestor');
    const { requestNumber } = await createSubmittedRequest(page, { title, assessmentType: 'BAU', businessCriticality: 'Low', dueDate: null });

    await page.context().clearCookies();
    await signInAs(page, 'Secondary Requestor');
    const dialog = await openQuickFindWithShortcut(page);
    const input = dialog.getByRole('combobox', { name: 'Search by number or title' });
    for (const term of [requestNumber, word]) {
      await input.fill(term);
      await expect(dialog.getByText(`No matches for “${term}”`, { exact: true }), `UX10_SCOPE_SECONDARY_REQUESTOR: "${term}" finds nothing`).toBeVisible();
      await expect(dialog.getByText('Check the number, or try a word from the title. Only records you can open are searched.', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('option'), `UX10_SCOPE_SECONDARY_REQUESTOR: no option for "${term}"`).toHaveCount(0);
    }

    // The same term finds the request for the Requestor who raised it, so the empty answer above is scope, not a miss.
    await page.context().clearCookies();
    await signInAs(page, 'Requestor');
    const own = await openQuickFindWithShortcut(page);
    await own.getByRole('combobox', { name: 'Search by number or title' }).fill(word);
    await expect(
      own.getByRole('group', { name: /^My requests/ }).getByRole('option', { name: `${requestNumber} · ${title}` }),
      'UX10_SCOPE_SECONDARY_REQUESTOR: the Requestor finds their own request by the same word',
    ).toBeVisible();
  });
  test('UX10_KEYBOARD_PHONE: at 375 the icon-only Search control opens the full-screen sheet, and a request opens by its number with Enter', async ({ page }, testInfo) => {
    // It claims 375, so it sets 375 itself: the desktop run proves the same width (Playwright projects).
    await page.setViewportSize({ width: 375, height: 812 });
    const title = `Quick find phone ${testInfo.project.name}${Date.now().toString(36)}`;
    await signInAs(page, 'Requestor');
    const { requestNumber, documentId } = await createSubmittedRequest(page, { title, assessmentType: 'BAU', businessCriticality: 'Moderate', dueDate: null });
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();

    const control = searchControl(page);
    await expect(control.getByText('Search', { exact: true }), 'UX10_KEYBOARD_PHONE: the control is icon-only, its label visually hidden').toHaveCSS('clip-path', 'inset(50%)');
    // By keyboard: focus the control and press Enter; the press is repeated only until the hydrated control answers.
    await expect(async () => {
      await control.focus();
      if ((await control.getAttribute('aria-expanded')) !== 'true') await page.keyboard.press('Enter');
      await expect(control).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 });
    }).toPass();

    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('heading', { name: 'Search', exact: true }), 'UX10_KEYBOARD_PHONE: the sheet shows its Search heading').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close search', exact: true }), 'UX10_KEYBOARD_PHONE: the sheet has Close').toBeVisible();
    const box = await dialog.boundingBox();
    expect(box, 'UX10_KEYBOARD_PHONE: the sheet fills the screen').toEqual({ x: 0, y: 0, width: 375, height: 812 });

    const input = dialog.getByRole('combobox', { name: 'Search by number or title' });
    await expect(input, 'UX10_KEYBOARD_PHONE: focus starts in the input').toBeFocused();
    await page.keyboard.type(requestNumber);
    const option = dialog.getByRole('group', { name: /^My requests/ }).getByRole('option', { name: `${requestNumber} · ${title}` });
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');

    await expect(page, 'UX10_KEYBOARD_PHONE: Enter opens the request').toHaveURL(new RegExp(`/app/requests/${documentId}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
    await expect(control, 'UX10_KEYBOARD_PHONE: focus rests on the header Search control (UI-D13)').toBeFocused();
  });

  test('UX10_AXE_OPEN_DIALOG: quick find open with a result shown has no serious or critical axe violation at 1440 and 375', async ({ page }) => {
    // Jane's seeded request, found by its number: one result, so the list fits and the scan reads it whole. It only reads.
    const term = 'RAR-E2E-NAV-OWNER-001';
    await signInAs(page, 'Requestor');
    const findings: string[] = [];
    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await page.goto('/app');
      await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
      const dialog = await openQuickFindWithShortcut(page);
      await dialog.getByRole('combobox', { name: 'Search by number or title' }).fill(term);
      await expect(dialog.getByRole('group', { name: /^My requests/ }).getByRole('option', { name: new RegExp(`^${term} · `) })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      const ran = [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(({ id }) => id);
      expect(ran, 'UX10_AXE_OPEN_DIALOG runs aria-dialog-name and Label in Name').toEqual(expect.arrayContaining(['aria-dialog-name', 'label-content-name-mismatch']));
      const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      const summary = results.violations.map(({ id, impact, nodes }) => `${id} (${impact}, ${nodes.length})`).join(', ') || 'none';
      expect(blocking, `UX10_AXE_OPEN_DIALOG at ${width}px: ${summary}`).toEqual([]);
      findings.push(`${width}px: ${summary}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
    }
    test.info().annotations.push({ type: 'quick find axe', description: findings.join('; ') });
    console.log(`quick find axe: ${findings.join('; ')}`);
  });
});

/*
 * Outside the @journey describe, so only the desktop project runs these, at 1440: each proves that width alone, and
 * UX10_SHOW_ALL lands on the Risk register, whose filters sit in a phone sheet below 768px.
 */

/** Opens quick find from the header's Search control, as a pointer user would. */
async function openQuickFindFromHeader(page: Page): Promise<Locator> {
  await searchControl(page).click();
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Search by number or title' })).toBeFocused();
  return dialog;
}

test('UX10_IDENTITY_SWITCH: switching to Secondary Requestor without reloading discards the prior private search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'Requestor');
  const term = 'RAR-E2E-NAV-OWNER-001';
  const dialog = await openQuickFindFromHeader(page);
  await dialog.getByRole('combobox', { name: 'Search by number or title' }).fill(term);
  const option = dialog.getByRole('option', { name: new RegExp(`^${term} · `) });
  await expect(option).toBeVisible();
  const privateLabel = await option.textContent();
  await page.keyboard.press('Escape');

  const navigations: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
  });
  await page.getByRole('combobox', { name: 'Development role' }).selectOption('Secondary Requestor');
  await expect(page.getByRole('banner').getByText('Secondary Requestor', { exact: true })).toBeVisible();
  const reopened = await openQuickFindFromHeader(page);
  const input = reopened.getByRole('combobox', { name: 'Search by number or title' });
  await expect(input).toHaveValue('');
  await expect(reopened.getByRole('option')).toHaveCount(0);
  if (!privateLabel) throw new Error('Expected the private request display fields');
  await expect(reopened).not.toContainText(privateLabel);
  await input.fill(term);
  await expect(reopened.getByText(`No matches for “${term}”`, { exact: true })).toBeVisible();
  expect(navigations, 'the supported role switch refreshes React state without a full document navigation').toEqual([]);
});

test('UX10_ANALYST_GROUPS: the Security Analyst finds requests by a word of their title, moves through them and opens one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const word = `Qf${Date.now().toString(36)}`;
  const titles = [`Quick find ${word} alpha`, `Quick find ${word} beta`];
  await signInAs(page, 'Requestor');
  const requests: { title: string; requestNumber: string; documentId: string }[] = [];
  for (const title of titles) {
    requests.push({ title, ...(await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'High', dueDate: null })) });
  }

  await page.context().clearCookies();
  await signInAs(page, 'Security Analyst');
  const dialog = await openQuickFindFromHeader(page);
  const input = dialog.getByRole('combobox', { name: 'Search by number or title' });
  await input.pressSequentially(word);

  // Every request in review scope, so both show in Requests; the analyst raised neither, so My requests is absent.
  const group = dialog.getByRole('group', { name: 'Requests, 2 matches', exact: true });
  await expect(group, 'UX10_ANALYST_GROUPS: Requests names its total').toBeVisible();
  for (const request of requests) {
    const option = group.getByRole('option', { name: `${request.requestNumber} · ${request.title}` });
    await expect(option).toBeVisible();
    // 13 D-13 (13-UI-SPEC §4, §16 E3): line 2 says who holds the request; nobody has picked these up yet.
    await expect(option.getByText('Submitted · Not picked up', { exact: true }), 'UX10_ANALYST_GROUPS: line 2 names the holder').toBeVisible();
  }
  await expect(dialog.getByRole('group', { name: /^My requests\b/ })).toHaveCount(0);

  const options = group.getByRole('option');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  const firstActive = await input.getAttribute('aria-activedescendant');
  expect(firstActive, 'UX10_ANALYST_GROUPS: the input names the active option').toBe(await options.first().getAttribute('id'));

  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(input, 'UX10_ANALYST_GROUPS: ArrowDown moves the active option').not.toHaveAttribute('aria-activedescendant', firstActive ?? '');
  await expect(input).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id')) ?? '');

  const activeName = (await options.nth(1).textContent()) ?? '';
  const opened = requests.find((request) => activeName.includes(request.requestNumber));
  expect(opened, 'UX10_ANALYST_GROUPS: the active option is one of the two requests').toBeDefined();
  await page.keyboard.press('Enter');
  await expect(page, 'UX10_ANALYST_GROUPS: Enter opens the request in review').toHaveURL(new RegExp(`/app/review/requests/${opened!.documentId}$`));
  await expect(page.getByRole('heading', { level: 1, name: opened!.title })).toBeVisible();
});

test('UX10_SHOW_ALL: a group holding more than five ends with Show all, which opens its list filtered by the term, holding exactly that total', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Words every seeded analyst-insights Risk statement holds (seed-analyst-insights.ts): six Risks, so more than five.
  const term = 'Phase 7';
  await signInAs(page, 'Security Analyst');
  const dialog = await openQuickFindFromHeader(page);
  await dialog.getByRole('combobox', { name: 'Search by number or title' }).pressSequentially(term);

  const group = dialog.getByRole('group', { name: /^Risk register, [\d,]+ matches$/ });
  await expect(group).toBeVisible();
  const showAll = group.getByRole('option', { name: /^Show all [\d,]+ in Risk register$/ });
  await expect(showAll, 'UX10_SHOW_ALL: the group ends with Show all').toBeVisible();
  await expect(group.getByRole('option')).toHaveCount(6);
  const total = Number(((await showAll.textContent()) ?? '').replace(/[^\d]/g, ''));
  expect(total, 'UX10_SHOW_ALL: Show all appears only above five').toBeGreaterThan(5);

  await showAll.click();
  await expect(page, 'UX10_SHOW_ALL: Show all opens the Risk register filtered by the term').toHaveURL(/\/app\/risks\?q=Phase(?:%20|\+)7$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Risk register', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
  const listed = page.getByRole('main').getByText(/^[\d,]+ results?$/);
  await expect(listed).toBeVisible();
  expect(Number(((await listed.textContent()) ?? '').replace(/[^\d]/g, '')), 'UX10_SHOW_ALL: the list holds exactly the group total').toBe(total);
});

test('UX10_ESCAPE_RESTORES_FOCUS: Escape closes quick find and returns focus to the sidebar link focused before it opened', async ({ page }) => {
  // The sidebar shows from 1024px, so this proves 1440 alone, outside the @journey describe.
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'Requestor');
  const link = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: /^My requests\b/ }).first();
  await link.focus();
  await expect(link).toBeFocused();

  const dialog = await openQuickFindWithShortcut(page);
  await expect(dialog.getByRole('combobox', { name: 'Search by number or title' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden();
  await expect(link, 'UX10_ESCAPE_RESTORES_FOCUS: the same link is focused').toBeFocused();
});

/*
 * UX10_GUARD_BLOCKS (D-51, UI-SPEC §4.6): with a questionnaire's latest answers unsaved, opening a quick-find result
 * opens the leave warning above quick find. The guard blocks only while a save waits or has failed, so the save must
 * really fail while quick find keeps working: both are Server Actions posting to the questionnaire's own URL, so only
 * the POST carrying the save's Next-Action id, captured from a successful autosave, is aborted (QUES09_LEAVE_WARNING's
 * failSaves, which aborts every POST, would stop quick find too). The questionnaire is this test's own, generated and
 * released here (D-56), never the seeded one-shot draft. It builds a questionnaire each run and proves 1440 alone, so
 * it sits outside the @journey describe and runs once.
 */
test('UX10_GUARD_BLOCKS: with the latest answers unsaved, opening a result opens the leave warning above quick find; Keep answering returns to the input', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const title = `Quick find guard ${Date.now().toString(36)}`;
  await signInAs(page, 'Requestor');
  const { requestNumber, documentId } = await createSubmittedRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });

  // 1. The Security Analyst generates the questionnaire and releases it.
  await page.context().clearCookies();
  await signInAs(page, 'Security Analyst');
  await page.goto(`/app/review/requests/${documentId}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Generate questionnaire' }).click();
  await expect(page.getByText('Questionnaire generation is ready for review').first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole('link', { name: 'Review generated questionnaire' }).click();
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
  const questionnaireId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  await page.getByRole('region', { name: 'Questionnaire governance' }).getByRole('button', { name: 'Release questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Release this questionnaire?' }).getByRole('button', { name: 'Release questionnaire' }).click();
  await expect(page.getByRole('region', { name: 'Questionnaire revision timeline' }).getByText('Released', { exact: true })).toBeVisible();

  // The Requestor opens it; its first question is the Long-text security objectives.
  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  const questionnairePath = `/app/questionnaires/${questionnaireId}`;
  await page.goto(questionnairePath);
  const answer = page.getByRole('textbox', { name: /^What security outcomes matter most for/ });
  await expect(answer).toBeVisible();
  const completion = page.getByRole('region', { name: 'Questionnaire completion' });

  // 2. A successful autosave gives the save's Next-Action id.
  const savedMarker = `guard-saved-${Date.now()}`;
  const autosave = page.waitForRequest((sent) => sent.method() === 'POST' && sent.headers()['next-action'] !== undefined && (sent.postData() ?? '').includes(savedMarker));
  await answer.fill(`Protect customer records (${savedMarker}).`);
  const saveActionId = (await autosave).headers()['next-action'];
  expect(saveActionId, 'UX10_GUARD_BLOCKS: the autosave carries a Next-Action id').toBeTruthy();
  await expect(completion.getByRole('status')).toContainText('Saved at');

  // 3. Only the save fails from here; every other request, quick find's included, goes through.
  const questionnairePage = (url: URL) => url.pathname === questionnairePath;
  const failTheSave = (route: Route) => {
    const sent = route.request();
    return sent.method() === 'POST' && sent.headers()['next-action'] === saveActionId ? route.abort() : route.continue();
  };
  await page.route(questionnairePage, failTheSave);
  await answer.fill(`Protect customer records and payments (guard-unsaved-${Date.now()}).`);
  await expect(completion.getByRole('alert'), 'UX10_GUARD_BLOCKS: the save has really failed').toContainText('Your latest answers weren’t saved.');

  // 4. Quick find still answers, through its own Server Action.
  const dialog = await openQuickFindWithShortcut(page);
  const quickFindAnswer = page.waitForResponse((response) => {
    const sent = response.request();
    const action = sent.headers()['next-action'];
    return sent.method() === 'POST' && action !== undefined && action !== saveActionId && (sent.postData() ?? '').includes(requestNumber);
  });
  const input = dialog.getByRole('combobox', { name: 'Search by number or title' });
  await input.fill(requestNumber);
  expect((await quickFindAnswer).ok(), 'UX10_GUARD_BLOCKS: quick find’s Server Action answers').toBe(true);
  const option = dialog.getByRole('option', { name: `${requestNumber} · ${title}` });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute('aria-selected', 'true');

  // 5. The leave warning opens above quick find.
  await page.keyboard.press('Enter');
  const leaveWarning = page.getByRole('alertdialog', { name: 'Leave this questionnaire?' });
  await expect(leaveWarning, 'UX10_GUARD_BLOCKS: the guard blocks').toBeVisible();
  await expect(leaveWarning).toContainText('Your latest answers weren’t saved. If you leave now, they’ll be lost.');
  // The leave warning hides the page beneath it from assistive technology, quick find included, so it is read as hidden.
  await expect(page.getByRole('dialog', { name: 'Search', includeHidden: true }), 'UX10_GUARD_BLOCKS: quick find stays open beneath').toBeVisible();
  // A click, so Playwright's actionability check proves nothing covers it.
  await leaveWarning.getByRole('button', { name: 'Keep answering' }).click();
  await expect(leaveWarning).toHaveCount(0);
  await expect(input, 'UX10_GUARD_BLOCKS: Keep answering returns focus to the quick-find input').toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${questionnairePath}$`));

  await page.keyboard.press('Enter');
  await expect(leaveWarning).toBeVisible();
  await leaveWarning.getByRole('button', { name: 'Leave questionnaire' }).click();
  await expect(page, 'UX10_GUARD_BLOCKS: Leave questionnaire opens the request').toHaveURL(new RegExp(`/app/requests/${documentId}$`));
  await expect(page.getByRole('dialog', { name: 'Search', includeHidden: true }), 'UX10_GUARD_BLOCKS: quick find closed').toHaveCount(0);

  // 6.
  await page.unroute(questionnairePage, failTheSave);
});
