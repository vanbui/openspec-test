import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';

const releasedAssessmentNumber = 'ASM-2026-33SAEN';
const releasedRiskNumber = 'RSK-RELEASED-33SAEN';
const mutableRiskNumber = 'RSK-DEV-MUTABLE-001';
const releasedNoticeHeading = 'Released assessment — read only';
const viewportWidths = [375, 390, 430, 768, 1024, 1440] as const;
const mutationActionName = /Edit risk|Save risk|Discard risk changes|Add mitigation control|Edit mitigation control|Save mitigation control|Remove mitigation control|close|more actions/i;

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > window.innerWidth + 1 || rect.left < -1)
      .slice(0, 5)
      .map(({ element, rect }) => `${element.tagName.toLowerCase()}${element.getAttribute('data-slot') ? `[data-slot=${element.getAttribute('data-slot')}]` : ''}:${Math.round(rect.left)}..${Math.round(rect.right)}`),
  }));
  expect(geometry.scrollWidth, `${message}; offenders: ${geometry.offenders.join(', ')}`).toBeLessThanOrEqual(geometry.viewportWidth);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

async function signIn(page: Page, role: 'Requestor' | 'Security Analyst'): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');

  if (!response?.ok()) {
    throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  }

  await page.getByRole('button', { name: `Continue as ${role}` }).click();
  await expect(page, `BASELINE_${role === 'Requestor' ? 'REQUESTOR' : 'ANALYST'}_SHELL_URL`).toHaveURL(/\/app$/);
  await expect(page.getByRole('main'), 'BASELINE_SHELL_MAIN').toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' }), 'BASELINE_DASHBOARD').toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), 'BASELINE_ACTOR_ROLE').toBeVisible();
}

async function expectFocusIsVisible(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((candidate) => candidate.offsetWidth > 0 && candidate.offsetHeight > 0);
    const index = focusable.indexOf(element as HTMLElement);
    if (index < 1) throw new Error('Focused control has no preceding keyboard stop.');
    focusable[index - 1]!.focus();
  });
  await locator.page().keyboard.press('Tab');
  await expect(locator).toBeFocused();
  const visibleFocus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
  });
  expect(visibleFocus, 'keyboard focus indicator is visible').toBe(true);
}

async function selectMatchingOptionAndWait(page: Page, combobox: Locator, label: string, key: string): Promise<void> {
  await combobox.fill(label);
  const option = page.getByRole('option', { name: label, exact: true });
  await expect(option, `${label} is returned by the authorised relation search`).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(new RegExp(`[?&]${key}=`));
}

async function expectFocusWithin(container: Locator): Promise<void> {
  await expect.poll(() => container.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

async function visibleRiskNumbers(page: Page): Promise<string[]> {
  return page.getByRole('table', { name: 'Risk Register results' }).getByRole('row').locator('a[href^="/app/risks/"]').filter({ hasText: /^RSK-/ }).allTextContents();
}

async function displayedResultTotal(page: Page): Promise<number> {
  const label = await page.getByText(/^\d+ results?$/).textContent();
  const total = Number.parseInt(label ?? '', 10);
  expect(Number.isSafeInteger(total), 'Risk Register exposes a numeric authoritative result total').toBe(true);
  return total;
}

async function expectRegisterGeometry(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/app/risks');
  await expect(page.getByRole('heading', { name: 'Risk Register' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveCount(1);
  await expectNoHorizontalOverflow(page, `Risk Register has no horizontal overflow at ${width}px`);

  if (width < 768) {
    const cards = page.locator('[data-slot="data-table-mobile"]');
    await expect(cards, `Risk cards render at ${width}px`).toBeVisible();
    await expect(cards.getByRole('article')).toHaveCount(await displayedResultTotal(page));
    const filtersTrigger = page.getByRole('button', { name: /Filters \(\d+\)/ });
    await filtersTrigger.click();
    const filtersSheet = page.getByRole('dialog', { name: 'Risk Register filters' });
    await expect(filtersSheet).toBeVisible();
    await expect(filtersSheet.getByLabel('Target date from')).toBeVisible();
    await expect(filtersSheet.getByLabel('Target date to')).toBeVisible();
    await expect(filtersSheet.getByRole('button', { name: 'Clear target dates' })).toBeVisible();
    await expectFocusIsVisible(filtersSheet.getByLabel('Target date from'));
    await expectFocusWithin(filtersSheet);
    await page.keyboard.press('Tab');
    await expectFocusWithin(filtersSheet);
    await page.keyboard.press('Escape');
    await expect(filtersTrigger, 'filter Sheet restores focus to its trigger').toBeFocused();
  } else {
    await expect(page.getByRole('table', { name: 'Risk Register results' }), `Risk table renders at ${width}px`).toBeVisible();
    const moreFilters = page.getByRole('button', { name: 'More filters' });
    await moreFilters.click();
    const filterPopover = page.locator('[data-slot="popover-content"][data-state="open"]');
    await expect(filterPopover.getByLabel('Target date from')).toBeVisible();
    await expect(filterPopover.getByLabel('Target date to')).toBeVisible();
    await expect(filterPopover.getByRole('button', { name: 'Clear target dates' })).toBeVisible();
    await expectFocusIsVisible(filterPopover.getByLabel('Target date from'));
    await expectFocusWithin(filterPopover);
    await page.keyboard.press('Escape');
    await expect(moreFilters, 'filter popover restores focus to its trigger').toBeFocused();
  }
}

async function expectDetailGeometry(page: Page, riskHref: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(riskHref);
  await expect(page.getByRole('region', { name: 'Risk statement and classification' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ratings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ownership and treatment' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mitigation controls' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Related records' })).toBeVisible();
  await expectNoHorizontalOverflow(page, `Risk detail has no horizontal overflow at ${width}px`);

  const definitionList = page.getByRole('region', { name: 'Ratings' }).locator('dl');
  const columns = await definitionList.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns, `Risk detail definition-list columns at ${width}px`).toBe(width < 768 ? 1 : 2);
  const riskLink = page.getByRole('region', { name: 'Related records' }).getByRole('link').first();
  await expectFocusIsVisible(riskLink);
  if (width >= 768) {
    const classification = page.getByRole('region', { name: 'Risk statement and classification' }).locator('dl');
    const issueRow = classification.getByText('Issue statement', { exact: true }).locator('..');
    const [listBox, rowBox] = await Promise.all([classification.boundingBox(), issueRow.boundingBox()]);
    expect(listBox && rowBox && rowBox.width >= listBox.width * 0.75, `long detail fields span both columns at ${width}px`).toBe(true);
  }
}

test.describe.configure({ mode: 'serial' });

test('Bob filters the Risk Register, maintains mitigation, and Jane learns no Risk facts', async ({ page, request }) => {
  test.setTimeout(600_000);

  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) {
    throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signIn(page, 'Security Analyst');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/risks');
  await expect(
    page.getByRole('heading', { name: 'Risk Register' }),
    'Expected /app/risks Risk Register heading to be visible',
  ).toBeVisible();
  await expect(page.getByText('Search and manage contextual Risks across authorised assessments.')).toBeVisible();
  await expect(page.getByRole('link', { name: mutableRiskNumber }).first(), 'Risk rows finish hydrating before the total/row consistency proof').toBeVisible();
  const initialTotal = await displayedResultTotal(page);
  const initialRiskNumbers = await visibleRiskNumbers(page);
  expect(initialTotal, 'Risk Register contains both stable acceptance fixtures').toBeGreaterThanOrEqual(2);
  expect(new Set(initialRiskNumbers).size, 'authoritative total matches distinct rendered Risks').toBe(initialTotal);
  expect(initialRiskNumbers).toEqual(expect.arrayContaining([mutableRiskNumber, releasedRiskNumber]));

  const initialMutableHref = await page.getByRole('link', { name: mutableRiskNumber }).first().getAttribute('href');
  expect(initialMutableHref).toMatch(/^\/app\/risks\/[^/]+$/);
  await page.goto(initialMutableHref!);
  await page.getByRole('button', { name: 'Edit risk' }).click();
  const currentMutableTargetDate = await page.getByRole('form', { name: 'Edit Risk' }).getByLabel('Target date').inputValue();
  expect(currentMutableTargetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole('form', { name: 'Edit Risk' }).getByRole('button', { name: 'Discard risk changes' }).click();

  await page.goto(`/app/risks?targetDateFrom=${currentMutableTargetDate}&targetDateTo=${currentMutableTargetDate}&unknown=discard-me&sort=targetDate%3Aasc&pageSize=25`);
  await expect(page).toHaveURL(new RegExp(`targetDateFrom=${currentMutableTargetDate}`));
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  await expect(page.getByText('1 result', { exact: true }), 'equal inclusive bounds return the stable dated Risk with an authoritative total').toBeVisible();
  expect(await visibleRiskNumbers(page)).toEqual([mutableRiskNumber]);

  const moreFilters = page.getByRole('button', { name: 'More filters' });
  await moreFilters.click();
  let popover = page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(popover).toBeVisible();
  await expect(popover.getByLabel('Target date from')).toHaveValue(currentMutableTargetDate);
  await expect(popover.getByLabel('Target date to')).toHaveValue(currentMutableTargetDate);
  await expectFocusIsVisible(popover.getByLabel('Target date from'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Remove Target date from filter' }).click();
  await expect(page).not.toHaveURL(/targetDateFrom=/);
  await expect(page).not.toHaveURL(/unknown=/);
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  await moreFilters.click();
  popover = page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(popover).toBeVisible();
  const clearInitialTargetDates = popover.getByRole('button', { name: 'Clear target dates' });
  await clearInitialTargetDates.focus();
  await expect(clearInitialTargetDates).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  await expect(page).toHaveURL(/pageSize=25/);
  expect(await displayedResultTotal(page)).toBe(initialTotal);
  await page.keyboard.press('Escape');

  const search = page.getByRole('search').filter({ has: page.getByLabel('Search Risks') });
  await search.getByLabel('Search Risks').fill('unauthorised access');
  await search.getByRole('button', { name: 'Search Risks' }).click();
  await expect(page).toHaveURL(/q=unauthorised(?:\+|%20)access/);
  await page.getByRole('combobox', { name: 'Treatment status', exact: true }).selectOption('In Progress');
  await expect(page).toHaveURL(/treatmentStatus=In(?:\+|%20)Progress/);
  await page.getByRole('combobox', { name: 'Inherent rating', exact: true }).selectOption('High');
  await expect(page).toHaveURL(/inherentRating=High/);
  await page.getByRole('combobox', { name: 'Residual rating', exact: true }).selectOption('Moderate');
  await expect(page).toHaveURL(/residualRating=Moderate/);
  await moreFilters.click();
  popover = page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(popover).toBeVisible();
  await selectMatchingOptionAndWait(page, popover.getByRole('combobox', { name: 'Risk owner', exact: true }), 'Bob Doe', 'riskOwner');
  await selectMatchingOptionAndWait(page, popover.getByRole('combobox', { name: 'Treatment owner', exact: true }), 'Bob Doe', 'treatmentOwner');
  await selectMatchingOptionAndWait(page, popover.getByRole('combobox', { name: 'Related assessment', exact: true }), 'ASM-DEV-RISK-001', 'assessment');
  await selectMatchingOptionAndWait(page, popover.getByRole('combobox', { name: 'Impacted system', exact: true }), 'Customer portal', 'system');
  await selectMatchingOptionAndWait(page, popover.getByRole('combobox', { name: 'Impacted asset', exact: true }), 'Customer records', 'asset');
  await popover.getByRole('combobox', { name: 'Mitigation-control status', exact: true }).selectOption('Planned');
  await expect(page).toHaveURL(/mitigationStatus=Planned/);
  await popover.getByLabel('Target date from').fill(currentMutableTargetDate);
  await expect(page).toHaveURL(new RegExp(`targetDateFrom=${currentMutableTargetDate}`));
  await popover.getByLabel('Target date to').fill(currentMutableTargetDate);
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  await page.keyboard.press('Escape');
  await expect(moreFilters, 'filter popover restores focus').toBeFocused();
  await expect(page).toHaveURL(/treatmentStatus=In(?:\+|%20)Progress/);
  await expect(page).toHaveURL(/inherentRating=High/);
  await expect(page).toHaveURL(/residualRating=Moderate/);
  await expect(page).toHaveURL(/riskOwner=/);
  await expect(page).toHaveURL(/treatmentOwner=/);
  await expect(page).toHaveURL(/assessment=/);
  await expect(page).toHaveURL(/system=/);
  await expect(page).toHaveURL(/asset=/);
  await expect(page).toHaveURL(/mitigationStatus=Planned/);
  await expect(page).toHaveURL(new RegExp(`targetDateFrom=${currentMutableTargetDate}`));
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  await expect(page).toHaveURL(/pageSize=25/);
  await expect(page.getByText('1 result', { exact: true }), 'combined filter total remains authoritative').toBeVisible();

  await moreFilters.click();
  popover = page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(popover).toBeVisible();
  const clearComposedTargetDates = popover.getByRole('button', { name: 'Clear target dates' });
  await clearComposedTargetDates.focus();
  await expect(clearComposedTargetDates).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/treatmentStatus=In(?:\+|%20)Progress/);
  await expect(page).toHaveURL(/mitigationStatus=Planned/);
  await expect(page.getByText('1 result', { exact: true }), 'clearing dates retains the composed non-date filters').toBeVisible();
  await popover.getByLabel('Target date from').fill('2027-01-01');
  await expect(page).toHaveURL(/targetDateFrom=2027-01-01/);
  await popover.getByLabel('Target date to').fill('2027-01-01');
  await expect(page).toHaveURL(/targetDateTo=2027-01-01/);
  await expect(page.getByText('0 results', { exact: true }), 'valid no-match range has an authoritative zero total').toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Risks match these filters' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/q=|treatmentStatus=|inherentRating=|residualRating=|riskOwner=|treatmentOwner=|assessment=|system=|asset=|mitigationStatus=|targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  await expect(page).toHaveURL(/pageSize=25/);
  expect(await displayedResultTotal(page)).toBe(initialTotal);

  await page.getByRole('button', { name: 'Sort by Target date' }).click();
  await expect(page).toHaveURL(/sort=targetDate%3Adesc/);
  const descendingRisks = await visibleRiskNumbers(page);
  expect(descendingRisks.indexOf(mutableRiskNumber), 'descending target date keeps the dated fixture before the null fixture').toBeLessThan(descendingRisks.indexOf(releasedRiskNumber));
  await page.getByRole('button', { name: 'Sort by Target date' }).click();
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  const ascendingRisks = await visibleRiskNumbers(page);
  expect(ascendingRisks.indexOf(mutableRiskNumber), 'ascending target date keeps the dated fixture before the null fixture').toBeLessThan(ascendingRisks.indexOf(releasedRiskNumber));
  const targetSort = page.getByRole('button', { name: 'Sort by Target date' });
  await expectFocusIsVisible(targetSort);
  const sortBox = await targetSort.boundingBox();
  expect(sortBox && sortBox.y >= 0 && sortBox.y + sortBox.height <= 900, 'sticky-header focus remains visible').toBe(true);

  const releasedRow = page.getByRole('row', { name: new RegExp(releasedAssessmentNumber) });
  const releasedRiskLink = releasedRow.getByRole('link', { name: releasedRiskNumber }).first();
  const releasedRiskHref = await releasedRiskLink.getAttribute('href');
  expect(releasedRiskHref).toMatch(/^\/app\/risks\/[^/]+$/);
  await releasedRiskLink.click();
  await expect(page.getByText(releasedNoticeHeading, { exact: true })).toBeVisible();
  await expect(page.getByText('This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: mutationActionName })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: mutationActionName })).toHaveCount(0);
  await expect(page.getByRole('main').locator('form')).toHaveCount(0);
  await expect(page.locator(`link[rel="prefetch"][href*="${releasedRiskHref}"]`), 'released Risk has no mutation prefetch').toHaveCount(0);
  await expectNoSeriousAxeViolations(page);

  await page.goto('/app/risks');
  const mutableRiskLink = page.getByRole('link', { name: mutableRiskNumber }).first();
  const mutableRiskHref = await mutableRiskLink.getAttribute('href');
  expect(mutableRiskHref).toMatch(/^\/app\/risks\/[^/]+$/);
  await mutableRiskLink.click();

  await page.getByRole('button', { name: 'Edit risk' }).click();
  const riskForm = page.getByRole('form', { name: 'Edit Risk' });
  const persistedTargetDate = currentMutableTargetDate === '2026-08-30' ? '2026-12-01' : '2026-08-30';
  await riskForm.getByLabel('Target date').fill(persistedTargetDate);
  const comments = riskForm.getByLabel('Comments');
  const currentComments = await comments.inputValue();
  const persistedComment = currentComments === 'Phase 5 browser Risk persistence evidence A.'
    ? 'Phase 5 browser Risk persistence evidence B.'
    : 'Phase 5 browser Risk persistence evidence A.';
  await comments.fill(persistedComment);
  await riskForm.getByRole('button', { name: 'Save risk' }).click();
  await expect(page.getByText('Risk changes saved.', { exact: true })).toBeAttached();
  await page.reload();
  await expect(page.getByText(persistedComment, { exact: true }), 'Risk edit persists after authoritative reload').toBeVisible();

  await page.getByRole('button', { name: 'Edit mitigation control' }).first().click();
  const mitigationForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').first();
  const evidence = mitigationForm.getByRole('textbox', { name: 'Evidence' });
  const currentEvidence = await evidence.inputValue();
  const persistedEvidence = currentEvidence === 'Phase 5 browser verification evidence A.'
    ? 'Phase 5 browser verification evidence B.'
    : 'Phase 5 browser verification evidence A.';
  await evidence.fill(persistedEvidence);
  await mitigationForm.getByRole('button', { name: 'Save mitigation control' }).click();
  await expect(page.getByText('Mitigation control changes saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(persistedEvidence, { exact: true }), 'mitigation evidence persists after authoritative reload').toBeVisible();

  await page.goto('/app/risks?sort=targetDate%3Aasc&pageSize=25');
  const mutableRow = page.getByRole('row', { name: new RegExp(mutableRiskNumber) });
  const overdue = mutableRow.getByText('Overdue', { exact: true });
  await expect(overdue, 'past target date has exact Overdue text').toBeVisible();
  await expect(overdue.locator('svg'), 'Overdue treatment includes its warning icon').toHaveCount(1);
  const persistedTargetLabel = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${persistedTargetDate}T00:00:00.000Z`));
  await expect(mutableRow.getByText(persistedTargetLabel, { exact: true })).toBeVisible();

  await page.goto(mutableRiskHref!);

  await page.getByRole('button', { name: 'Add mitigation control' }).click();
  const addForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').last();
  await expectFocusIsVisible(addForm.getByRole('textbox', { name: 'Search reusable Controls' }));
  await addForm.getByRole('button', { name: 'Discard mitigation changes' }).click();
  await expect(page.getByRole('button', { name: 'Add mitigation control' })).toBeVisible();

  for (const width of viewportWidths) {
    await expectRegisterGeometry(page, width);
    await expectDetailGeometry(page, mutableRiskHref!, width);
  }

  await page.setViewportSize({ width: 720, height: 450 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await page.goto('/app/risks');
  await expectNoHorizontalOverflow(page, 'Risk Register has no horizontal overflow at 200% zoom');
  await expectNoSeriousAxeViolations(page);
  await page.goto(mutableRiskHref!);
  await expectNoHorizontalOverflow(page, 'Risk detail has no horizontal overflow at 200% zoom');
  await expectNoSeriousAxeViolations(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1';
  });

  await page.context().clearCookies();
  await signIn(page, 'Requestor');
  await page.goto('/app/risks');
  await expect(page.getByRole('heading', { name: 'You don’t have access to the Risk Register' })).toBeVisible();
  await expect(page.getByText(/\d+ results?/), 'Jane receives no Risk Register count').toHaveCount(0);
  await expect(page.getByText(/RSK-/), 'Jane receives no Risk number').toHaveCount(0);
  await expect(page.getByLabel(/Target date from|Target date to/i), 'Jane receives no date-filter control').toHaveCount(0);
  await expect(page.getByRole('button', { name: /Clear target dates|Clear filters|More filters|Filters \(\d+\)/ }), 'Jane receives no filter affordance').toHaveCount(0);
  const listDenial = await page.getByRole('main').innerText();
  expect(listDenial).not.toMatch(/\d+ results?|RSK-|ASM-|target date|filters/i);

  const arbitraryRiskHref = '/app/risks/not-a-risk-document-id';
  const detailDenialCopy = 'You don’t have permission to view the Risk Register';
  await page.goto(releasedRiskHref!);
  await expect(page.getByRole('alert').getByText(detailDenialCopy, { exact: true })).toBeVisible();
  await expect(page.getByText(/RSK-|ASM-2026-33SAEN/), 'existing Risk denial contains no identity clue').toHaveCount(0);
  const existingDenial = await page.getByRole('main').innerText();
  expect(existingDenial).not.toMatch(/\d+ results?|RSK-|ASM-|released|mutable/i);
  await page.goto(arbitraryRiskHref);
  await expect(page.getByRole('alert').getByText(detailDenialCopy, { exact: true })).toBeVisible();
  expect(await page.getByRole('main').innerText()).toBe(existingDenial);
  await expect(page.getByText(/RSK-|ASM-2026-33SAEN/), 'arbitrary Risk denial contains no existence clue').toHaveCount(0);
});
