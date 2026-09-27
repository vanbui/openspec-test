import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { openFromNavigation, primaryViewport, signInAs } from './helpers/navigation';

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


const requestorEmail = 'jane.doe@idambox.com';

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

/*
 * My Requests renders its records as cards below md (768px) and as a table from md, and the other
 * rendering is hidden. Read the list through the one this width shows, so the proof is of populated
 * content where a person looks, never of markup CSS hides.
 */
async function expectMyRequestRecords(page: Page, width: number, message: string): Promise<Locator> {
  const cards = page.locator('[data-slot="data-table-mobile"][aria-label="My assessment requests"]');
  const table = page.locator('table[aria-label="My assessment requests"]');
  const [shown, other] = width < 768 ? [cards, table] : [table, cards];
  await expect(shown, `${message}: the ${width < 768 ? 'card list' : 'table'} renders at ${width}px`).toBeVisible();
  await expect(other, `${message}: the other rendering is in the page but hidden at ${width}px`).toHaveCount(1);
  await expect(other).toBeHidden();
  const records = width < 768
    ? page.getByRole('list', { name: 'My assessment requests' }).getByRole('listitem')
    : page.getByRole('table', { name: 'My assessment requests' }).locator('tbody').getByRole('row');
  await expect(records.first(), `${message}: at least one request is listed at ${width}px`).toBeVisible();
  return records;
}

async function expectReturnToDraftConfirmation(
  page: Page,
  actionRegion: Locator,
  viewport: 'mobile' | 'desktop',
): Promise<void> {
  const trigger = actionRegion.getByRole('button', { name: 'Return to draft' });
  await expect(trigger, `REQUEST_${viewport.toUpperCase()}_REVERSAL_TRIGGER`).toHaveCount(1);
  await expect(actionRegion.getByRole('button').first(), `REQUEST_${viewport.toUpperCase()}_REVERSAL_IS_FIRST_ACTION`).toHaveText('Return to draft');
  await expect(trigger, `REQUEST_${viewport.toUpperCase()}_REVERSAL_USES_DEFAULT_BUTTON`).toHaveAttribute('data-variant', 'default');

  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'Return this request to draft?' });
  const reason = dialog.getByLabel('Reason');
  const confirm = dialog.getByRole('button', { name: 'Return request to draft' });
  await expect(dialog, `REQUEST_${viewport.toUpperCase()}_REVERSAL_PORTAL`).toBeVisible();
  await expect(confirm, `REQUEST_${viewport.toUpperCase()}_REVERSAL_RECORD_COPY`).toBeVisible();
  await expect(reason, `REQUEST_${viewport.toUpperCase()}_REVERSAL_REASON`).toBeVisible();

  const [dialogBox, headerBox, reasonBox, footerBox] = await Promise.all([
    dialog.boundingBox(),
    dialog.locator('[data-slot="alert-dialog-header"]').boundingBox(),
    reason.boundingBox(),
    dialog.locator('[data-slot="alert-dialog-footer"]').boundingBox(),
  ]);
  expect(dialogBox, `REQUEST_${viewport.toUpperCase()}_REVERSAL_DIALOG_BOX`).not.toBeNull();
  expect(headerBox, `REQUEST_${viewport.toUpperCase()}_REVERSAL_HEADER_BOX`).not.toBeNull();
  expect(reasonBox, `REQUEST_${viewport.toUpperCase()}_REVERSAL_REASON_BOX`).not.toBeNull();
  expect(footerBox, `REQUEST_${viewport.toUpperCase()}_REVERSAL_FOOTER_BOX`).not.toBeNull();
  expect(reasonBox!.width, `REQUEST_${viewport.toUpperCase()}_REVERSAL_REASON_FULL_WIDTH`).toBeGreaterThanOrEqual(headerBox!.width - 1);
  expect(footerBox!.width, `REQUEST_${viewport.toUpperCase()}_REVERSAL_FOOTER_FULL_WIDTH`).toBeGreaterThanOrEqual(headerBox!.width - 1);
  expect(dialogBox!.width, `REQUEST_${viewport.toUpperCase()}_REVERSAL_RESPONSIVE_DIALOG`).toBeLessThanOrEqual(
    viewport === 'mobile' ? 343 : 480,
  );
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message: `REQUEST_${viewport.toUpperCase()}_REVERSAL_OVERFLOW` },
  ).toBe(true);
  await expect(dialog.locator('[data-slot="alert-dialog-footer"]')).toHaveCSS(
    'flex-direction',
    viewport === 'mobile' ? 'column-reverse' : 'row',
  );

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

test('Requestor completes an authorised assessment request journey @journey', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) {
    throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  }

  // The journey runs at its project's width (1440 in desktop, 375 in mobile) and returns there after each sweep.
  const primary = primaryViewport(testInfo);
  // Every document it loads, the create, edit and submit routes included, runs under the production CSP (D-19).
  await attachCspCollector(page);
  await page.setViewportSize(primary);
  await signInAs(page, 'Requestor');

  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      { message: `BASELINE_PAGE_OVERFLOW_${primary.width}` },
    )
    .toBe(true);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' }), 'BASELINE_KEYBOARD_SKIP_LINK').toBeFocused();

  await page.keyboard.press('Tab');
  if (primary.width < 1024) {
    // Below 1024px the navigation lives in the Menu sheet, the next stop after the skip link.
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    const myRequests = page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'My Requests' });
    if (!(await myRequests.isVisible())) {
      throw new Error('PHASE2_RED_E2E_MISSING_MY_REQUESTS');
    }
    await myRequests.click();
  } else {
    // From 1024px the sidebar is the next stop: its home link, then the navigation.
    await expect(page.getByRole('link', { name: 'BProton, IdamBox CSRM home', exact: true }), 'BASELINE_KEYBOARD_SIDEBAR').toBeFocused();
    await openFromNavigation(page, 'My Requests');
  }

  await expect(page).toHaveURL(/\/app\/requests$/);
  await expect(page.getByRole('heading', { name: 'My Requests' })).toBeVisible();
  await expectMyRequestRecords(page, primary.width, 'MY_REQUESTS_POPULATED');

  const uniqueTitle = `E2E request ${requestorEmail} ${Date.now()}`;
  const originalDescription = 'Customer portal expansion requiring cyber risk review.';
  const editedDescription = 'Customer portal expansion with an updated external integration scope.';

  await page.locator('.page-header').getByRole('link', { name: 'New request' }).click();
  await expect(page).toHaveURL(/\/app\/requests\/new$/);
  await page.getByRole('textbox', { name: 'Request title' }).fill(uniqueTitle);
  await page.getByRole('textbox', { name: 'Description' }).fill(originalDescription);
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
  await page.getByRole('textbox', { name: 'Division' }).fill('Digital Services');
  await page.getByRole('textbox', { name: 'Business unit' }).fill('Customer Platforms');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Expand secure online customer services.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
  await chooseRelation(page, 'Information systems');
  await chooseRelation(page, 'Information assets');
  await page.getByRole('button', { name: 'Save draft' }).click();

  // `new` also satisfies a bare single-segment pattern, so the assertion could
  // pass while the redirect away from the create form was still in flight and
  // capture ".../app/requests/new" as the detail URL. Every later step then
  // derived the document id from it, which is how the analyst review step ended
  // up requesting the record "new" and getting a 404.
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
  const detailUrl = page.url();
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible();
  // The lifecycle stepper names the same states, so the status is read from the
  // header badge rather than from any element whose text happens to be "Draft".
  await expect(page.locator('[data-slot="badge"]').getByText('Draft', { exact: true })).toBeVisible();
  await expect(page.getByText(originalDescription)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible();
  await expect(page.getByText(originalDescription)).toBeVisible();

  await page.getByRole('link', { name: 'Edit request' }).click();
  await expect(page).toHaveURL(/\/app\/requests\/[^/]+\/edit$/);
  await expect(page.getByRole('textbox', { name: 'Request title' })).toHaveValue(uniqueTitle);
  // The persisted scope comes back as retained selections rather than ticks.
  for (const label of ['Information systems', 'Information assets'] as const) {
    await expect(
      page.getByRole('group', { name: label }).getByRole('list', { name: `Selected ${label}` }).getByRole('listitem'),
    ).not.toHaveCount(0);
  }
  await page.getByRole('textbox', { name: 'Description' }).fill(editedDescription);
  await page.getByRole('button', { name: 'Save draft' }).click();
  /*
   * Saving the edit form navigates back to the request detail. The edited
   * description is also the edit form's own textarea text, and the edit form
   * carries a `Submit request` trigger of its own, so neither proves the
   * navigation finished: on a production build the click landed on the edit
   * form's trigger an instant before the detail page replaced it. Wait for the
   * detail route and its actions region, and act only inside that region.
   */
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
  const requestActions = page.getByRole('region', { name: 'Request actions' });
  await expect(requestActions).toBeVisible();
  await expect(page.getByText(editedDescription)).toBeVisible();

  await requestActions.getByRole('button', { name: 'Submit request' }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Submit this assessment request?' });
  await expect(confirmation).toContainText(/cannot be undone|irreversible/i);
  await confirmation.getByRole('button', { name: 'Submit request' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Request submitted.')).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Request actions' }).getByText('Submitted', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Submitted \d{1,2} \w{3,4} \d{4}$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit request' })).toHaveCount(0);

  // Reversal uses the same production detail surface and leaves the Requestor
  // with an editable draft that can re-enter the established submission flow.
  await dismissToasts(page);
  for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expectReturnToDraftConfirmation(page, requestActions, viewport);
  }

  const requestDocumentId = decodeURIComponent(new URL(detailUrl).pathname.split('/').at(-1)!);
  await page.setViewportSize(primary);
  await page.context().clearCookies();
  await signInAs(page, 'Security Analyst');
  // Switching identity mid-test clears the session and establishes a new one, so
  // the first navigation can race the new session cookie and land back on the
  // sign-in screen. Retry the navigation rather than assuming the first lands.
  await expect(async () => {
    await page.goto(`/app/review/requests/${encodeURIComponent(requestDocumentId)}`);
    await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  for (const [width, viewport] of [[375, 'mobile'], [1440, 'desktop']] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expectReturnToDraftConfirmation(page, page.getByRole('main'), viewport);
  }

  await page.setViewportSize(primary);
  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  await page.goto(detailUrl);
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible();
  const requestTrigger = requestActions.getByRole('button', { name: 'Return to draft' });
  await requestTrigger.click();
  const revertConfirmation = page.getByRole('alertdialog', { name: 'Return this request to draft?' });
  await revertConfirmation.getByLabel('Reason').fill('Correct the changed integration scope');
  await revertConfirmation.getByRole('button', { name: 'Return request to draft' }).click();
  await expect(page.getByText('Request returned to draft.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last returned to draft' })).toBeVisible();
  await expect(page.getByText('Correct the changed integration scope')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit request' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to draft' }), 'REQUEST_DRAFT_REVERSAL_OMITTED').toHaveCount(0);

  await page.getByRole('link', { name: 'Edit request' }).click();
  const resubmitConfirmation = page.getByRole('alertdialog', { name: 'Submit this assessment request?' });
  /*
   * The edit form is a client island reached by navigation, so its submit
   * trigger can be on the page a moment before it responds to a click. Retry
   * opening the confirmation rather than assuming the first click lands.
   */
  // Scoped to the form on purpose. The confirmation is portalled outside it and
  // its confirm control carries the same name, so a page-wide `.first()` can
  // resolve to the dialog's own button once the dialog is open and the page
  // behind it is inert — which submits the request instead of opening it.
  const submitTrigger = page.locator('form').getByRole('button', { name: 'Submit request' });
  await expect(async () => {
    await dismissToasts(page);
    await submitTrigger.click();
    await expect(resubmitConfirmation).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await resubmitConfirmation.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Request submitted.')).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();

  await openFromNavigation(page, 'My Requests');
  await expect(page).toHaveURL(/\/app\/requests$/);
  // The list is newest-updated first, so the resubmitted request is on its first page, as Submitted.
  const listedRequests = await expectMyRequestRecords(page, primary.width, 'MY_REQUESTS_AFTER_RESUBMIT');
  const listedRequest = listedRequests.filter({ has: page.getByRole('link', { name: uniqueTitle, exact: true }) });
  await expect(listedRequest, `MY_REQUESTS_LISTS_THE_RESUBMITTED_REQUEST_${primary.width}`).toHaveCount(1);
  await expect(listedRequest.getByText('Submitted', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('searchbox', { name: 'Search requests' }).fill(uniqueTitle);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/q=E2E/);
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('submitted');
  await page.getByRole('button', { name: 'Sort by Updated' }).click();
  await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10');
  await expect(page.getByRole('link', { name: uniqueTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();

  await page.goto('/app');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    const lifecycleCards = page.getByRole('region', { name: 'My Assessment Requests' });
    await expect(lifecycleCards).toBeVisible();
    await expect(lifecycleCards.getByRole('list', { name: 'My Assessment Requests by lifecycle state' }).getByRole('listitem')).toHaveCount(7);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize(primary);
  await page.getByRole('region', { name: 'My Assessment Requests' }).getByRole('link', { name: /Submitted/ }).click();
  await expect(page).toHaveURL(/\/app\/requests\?status=submitted/);
  await expect(page.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('submitted');

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Draft requests', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Questionnaires in progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently released assessments' })).toBeVisible();
  await expect(page.getByRole('link', { name: uniqueTitle })).toHaveCount(0);
  const releasedAssessments = page.getByRole('region', { name: 'Recently released assessments' });
  await expect(releasedAssessments.getByRole('list', { name: 'Released assessments by rating' })).toBeVisible();
  await expect(releasedAssessments.getByText(uniqueTitle)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.context().clearCookies();
  await page.goto(detailUrl);
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  await expect(page.getByText(editedDescription)).toHaveCount(0);
  await expectNoCspViolations(page, 'the request journey');
});
