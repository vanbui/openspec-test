import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { expectFocusNotObscured, expectFocusVisible } from './helpers/focus';
import { primaryViewport, signInAs } from './helpers/navigation';
import { labelToFieldGap } from './helpers/forms';
import { paintedPixel, rgbOf, sameColour } from './helpers/pixel';
import { settleElementWidth } from './helpers/settle';

const releasedAssessmentNumber = 'ASM-2026-33SAEN';
const releasedRiskNumber = 'RSK-RELEASED-33SAEN';
const mutableRiskNumber = 'RSK-DEV-MUTABLE-001';
const releasedNoticeHeading = 'Released assessment - read only';
// 1280 is where the filter bar becomes one row of four tracks (UI-SPEC section 4.1).
const viewportWidths = [375, 390, 430, 768, 1024, 1280, 1440] as const;
const filterLabels = ['Search Risks', 'Treatment status', 'Inherent rating', 'Residual rating'] as const;
const firstFiveRegisterColumns = ['Risk number', 'Statement', 'Inherent rating', 'Residual rating', 'Treatment status'] as const;
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

/*
 * The register's records as the width shows them (D-14): below md (768px) a labelled card list whose
 * items are articles, from md a table of rows. The other rendering is hidden, so each is read only
 * where it shows.
 */
function registerRecords(page: Page, mobile: boolean): Locator {
  return mobile
    ? page.getByRole('list', { name: 'Risk Register results' }).getByRole('listitem')
    : page.getByRole('table', { name: 'Risk Register results' }).getByRole('row');
}

/** The one record (card or row) that names this identifier. */
function registerRecordFor(page: Page, mobile: boolean, identifier: string): Locator {
  return mobile
    ? registerRecords(page, true).filter({ hasText: identifier })
    : page.getByRole('row', { name: new RegExp(identifier) });
}

async function visibleRiskNumbers(page: Page, mobile: boolean): Promise<string[]> {
  return registerRecords(page, mobile).locator('a[href^="/app/risks/"]').filter({ hasText: /^RSK-/ }).allTextContents();
}

/*
 * Each Risk the register shows, with the target dates its record displays. The register renders a
 * target date as <time datetime="YYYY-MM-DD">, so the machine-readable value is read rather than the
 * formatted text. A Risk with no target date shows none.
 */
async function visibleRiskTargetDates(page: Page, mobile: boolean): Promise<Array<{ riskNumber: string; targetDates: string[] }>> {
  return registerRecords(page, mobile)
    .filter({ has: page.locator('a[href^="/app/risks/"]') })
    .evaluateAll((records) => records.map((record) => ({
      riskNumber: Array.from(record.querySelectorAll('a[href^="/app/risks/"]'), (link) => link.textContent?.trim() ?? '').find((text) => text.startsWith('RSK-')) ?? '',
      targetDates: Array.from(record.querySelectorAll('time[datetime]'), (time) => time.getAttribute('datetime') ?? ''),
    })));
}

/*
 * The filters beyond the always-visible bar: the More filters popover from md, and below md the
 * Filters (n) sheet, which holds the search, the three core selects and the same further fields.
 * Returns the open panel and its trigger, which takes focus back on Escape.
 */
async function openFilterPanel(page: Page, mobile: boolean): Promise<{ panel: Locator; trigger: Locator }> {
  const trigger = mobile
    ? page.getByRole('button', { name: /^Filters \(\d+\)$/ })
    : page.getByRole('button', { name: 'More filters' });
  await trigger.click();
  const panel = mobile
    ? page.getByRole('dialog', { name: 'Risk Register filters' })
    : page.locator('[data-slot="popover-content"][data-state="open"]');
  await expect(panel).toBeVisible();
  return { panel, trigger };
}

async function displayedResultTotal(page: Page): Promise<number> {
  const label = await page.getByText(/^\d+ results?$/).textContent();
  const total = Number.parseInt(label ?? '', 10);
  expect(Number.isSafeInteger(total), 'Risk Register exposes a numeric authoritative result total').toBe(true);
  return total;
}

/**
 * D-29: a table's scroller is a named, focusable region exactly while the table is wider than it.
 * `data-overflow` has to follow the measured width (it flips once the page hydrates), so neither
 * branch can pass vacuously. Returns whether the table overflows.
 */
async function expectRegionFollowsOverflow(page: Page, tableName: string, message: string): Promise<boolean> {
  const table = page.getByRole('table', { name: tableName, exact: true });
  await expect(table, `${message}: ${tableName} is shown`).toBeVisible();
  const scroller = page.locator('[data-overflow]').filter({ has: table });
  await expect(scroller, `${message}: one scroller holds ${tableName}`).toHaveCount(1);
  // Right after a viewport change the table can still be reflowing: measure the settled width.
  await settleElementWidth(scroller);
  const overflows = await scroller.evaluate((element) => element.scrollWidth > element.clientWidth);
  await expect(scroller, `${message}: data-overflow follows the measured width`).toHaveAttribute('data-overflow', String(overflows));
  const region = page.getByRole('region', { name: `${tableName}, scrolls horizontally`, exact: true });
  if (overflows) {
    await expect(region, `${message}: the overflowing scroller is the named, focusable region`).toHaveAttribute('tabindex', '0');
  } else {
    await expect(region, `${message}: a table that fits exposes no region`).toHaveCount(0);
    await expect(scroller, `${message}: a table that fits is no tab stop`).not.toHaveAttribute('tabindex');
  }
  return overflows;
}

/*
 * X-1's start-edge cue (W-2): the sticky first column's end hairline is painted on the pinned column
 * itself, at rest and while the table scrolls. It is read as painted, not as declared: a collapsed
 * table border keeps its computed width while the browser draws it on the scrolling grid line, so it
 * slid under the pinned column as soon as the table scrolled. Pixel snapping may put a 1px border in
 * either column beside a fractional edge, so the columns either side of the cell's end are read.
 */
async function expectStickyHairlinePainted(page: Page, region: Locator, message: string): Promise<void> {
  for (const [part, selector] of [['header', 'thead tr th:first-child'], ['body', 'tbody tr td:first-child']] as const) {
    const edge = await region.evaluate((element, cellSelector) => {
      const cell = element.querySelector<HTMLElement>(cellSelector);
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return {
        xs: [...new Set([Math.floor(rect.right) - 1, Math.round(rect.right) - 1, Math.ceil(rect.right) - 1])],
        y: Math.round(rect.top + rect.height / 2),
        colour: getComputedStyle(cell).borderRightColor,
        scrollLeft: element.scrollLeft,
      };
    }, selector);
    expect(edge, `${message}: the table has a first ${part} cell`).not.toBeNull();
    const painted = await Promise.all(edge!.xs.map((x) => paintedPixel(page, x, edge!.y)));
    expect(
      painted.some((pixel) => sameColour(pixel, rgbOf(edge!.colour))),
      `${message}: the pinned ${part} cell's end edge is painted ${edge!.colour} at scrollLeft ${edge!.scrollLeft}; found ${painted.map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`).join(', ')}`,
    ).toBe(true);
  }
}

/* Every visible label-wrapped field in `container` sits 6px below its label text (direction section 4 Forms, W-5). */
async function expectLabelsSixPixelsAbove(container: Locator, message: string): Promise<void> {
  const fields = container.locator('label:visible > input, label:visible > select');
  const count = await fields.count();
  expect(count, `${message}: has labelled fields to measure`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const name = await field.getAttribute('aria-label') ?? `field ${index + 1}`;
    expect(await labelToFieldGap(field), `${message}: ${name} sits 6px below its label`).toBeCloseTo(6, 0);
  }
}

/** D-28 from md: a usable search input and four filter labels that each stay on one line. */
async function expectFilterBarGeometry(page: Page, width: number): Promise<void> {
  const search = page.locator('input[name="q"][aria-label="Search Risks"]');
  await expect(search, `the desktop Search Risks input renders at ${width}px`).toBeVisible();
  const searchBox = await search.boundingBox();
  expect(searchBox?.width ?? 0, `the Search Risks input keeps at least 200px at ${width}px`).toBeGreaterThanOrEqual(200);
  test.info().annotations.push({ type: 'Search Risks input width', description: `${width}px viewport: ${Math.round(searchBox?.width ?? 0)}px` });

  // The input starts below its one-line label text, ends before the search button and shares its bottom edge.
  const searchLayout = await search.evaluate((input) => {
    const label = input.closest('label');
    const text = Array.from(label?.childNodes ?? []).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    const range = document.createRange();
    if (text) range.selectNodeContents(text);
    const inputRect = input.getBoundingClientRect();
    const buttonRect = input.closest('form')?.querySelector('button[type="submit"]')?.getBoundingClientRect();
    return {
      textBottom: range.getBoundingClientRect().bottom,
      inputTop: inputRect.top,
      inputRight: inputRect.right,
      inputBottom: inputRect.bottom,
      buttonLeft: buttonRect?.left ?? Number.NaN,
      buttonBottom: buttonRect?.bottom ?? Number.NaN,
    };
  });
  expect(searchLayout.inputTop, `the Search Risks input sits below its label at ${width}px`).toBeGreaterThanOrEqual(searchLayout.textBottom);
  await expectLabelsSixPixelsAbove(search.locator('xpath=ancestor::form/..'), `the filter bar at ${width}px`);
  expect(searchLayout.inputRight, `the Search Risks input ends before its button at ${width}px`).toBeLessThanOrEqual(searchLayout.buttonLeft);
  expect(Math.abs(searchLayout.inputBottom - searchLayout.buttonBottom), `the Search Risks input and button share a bottom edge at ${width}px`).toBeLessThanOrEqual(1);

  const labels = await search.evaluate((input) => Array.from(input.closest('form')?.parentElement?.querySelectorAll('label') ?? []).map((label) => {
    const text = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    const range = document.createRange();
    if (text) range.selectNodeContents(text);
    return {
      text: text?.textContent?.trim() ?? '',
      lineBoxes: text ? range.getClientRects().length : 0,
      height: range.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(label).lineHeight),
      top: label.getBoundingClientRect().top,
    };
  }));
  expect(labels.map(({ text }) => text), `the desktop filter labels at ${width}px`).toEqual([...filterLabels]);
  for (const label of labels) {
    expect(label.lineBoxes, `${label.text} renders on one line at ${width}px`).toBe(1);
    expect(label.height, `${label.text} is no taller than one line at ${width}px`).toBeLessThanOrEqual(label.lineHeight);
  }
  // Two rows (the search alone, then the selects) to 1279px; one row of four tracks from 1280px.
  const [searchLabel, ...selectLabels] = labels;
  for (const selectLabel of selectLabels) {
    if (width >= 1280) expect(selectLabel.top, `${selectLabel.text} shares the search row at ${width}px`).toBeCloseTo(searchLabel.top, 0);
    else expect(selectLabel.top, `${selectLabel.text} sits below the search row at ${width}px`).toBeGreaterThan(searchLabel.top);
  }
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
    await expectLabelsSixPixelsAbove(filtersSheet, `the Filters sheet at ${width}px`);
    /*
     * The search button sits apart from the input it submits (W-5), not touching it. Read by layout
     * offsets, not client rects: a primary button lifts 1px under the pointer left where the Filters
     * trigger was clicked (direction section 4 Buttons), and a client rect includes that transform.
     */
    const sheetSearch = await filtersSheet.locator('form[role="search"]').evaluate((form) => {
      const input = form.querySelector<HTMLElement>('input[name="q"]');
      const button = form.querySelector<HTMLElement>('button[type="submit"]');
      return {
        inputBottom: input ? input.offsetTop + input.offsetHeight : Number.NaN,
        buttonTop: button ? button.offsetTop : Number.NaN,
      };
    });
    expect(sheetSearch.buttonTop - sheetSearch.inputBottom, `the Filters sheet's Search Risks button stands 8px below its input at ${width}px`).toBeGreaterThanOrEqual(8);
    await expect(filtersSheet.getByLabel('Target date from')).toBeVisible();
    await expect(filtersSheet.getByLabel('Target date to')).toBeVisible();
    await expect(filtersSheet.getByRole('button', { name: 'Clear target dates' })).toBeVisible();
    await expectFocusVisible(filtersSheet.getByLabel('Target date from'));
    await expectFocusWithin(filtersSheet);
    await page.keyboard.press('Tab');
    await expectFocusWithin(filtersSheet);
    await page.keyboard.press('Escape');
    await expect(filtersTrigger, 'filter Sheet restores focus to its trigger').toBeFocused();
  } else {
    await expect(page.getByRole('table', { name: 'Risk Register results' }), `Risk table renders at ${width}px`).toBeVisible();
    await expectFilterBarGeometry(page, width);
    const overflows = await expectRegionFollowsOverflow(page, 'Risk Register results', `Risk Register at ${width}px`);

    if (width === 768 || width === 1024) {
      expect(overflows, `the eight-column register is wider than its content at ${width}px`).toBe(true);
      const region = page.getByRole('region', { name: 'Risk Register results, scrolls horizontally', exact: true });
      await expect(region, `columns are hidden beyond the end edge at ${width}px`).toHaveAttribute('data-overflow-end', 'false');
      await expectStickyHairlinePainted(page, region, `the Risk Register at rest at ${width}px`);
      // The region is the next tab stop after the table controls, before any control inside the table.
      await page.getByRole('button', { name: /^Use (compact|default) density$/ }).focus();
      await page.keyboard.press('Tab');
      await expect(region, `Tab reaches the Risk Register region at ${width}px`).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => region.evaluate((element) => element.scrollLeft), { message: `ArrowRight scrolls the region at ${width}px` }).toBeGreaterThan(0);
      await expectStickyHairlinePainted(page, region, `the Risk Register scrolled by ArrowRight at ${width}px`);
      await region.evaluate((element) => { element.scrollLeft = Math.floor((element.scrollWidth - element.clientWidth) / 2); });
      await expectStickyHairlinePainted(page, region, `the Risk Register scrolled half way at ${width}px`);
      await region.evaluate((element) => { element.scrollLeft = 0; });
    }

    if (width === 1440) {
      const scroller = page.locator('[data-slot="data-table-desktop"]');
      const columns = await scroller.evaluate((element) => ({
        scrollLeft: element.scrollLeft,
        visibleEnd: element.getBoundingClientRect().left + element.clientLeft + element.clientWidth,
        headers: Array.from(element.querySelectorAll('thead th')).slice(0, 5).map((header) => ({
          text: header.textContent?.trim() ?? '',
          right: header.getBoundingClientRect().right,
        })),
        statementWhiteSpace: getComputedStyle(element.querySelector('tbody tr td:nth-child(2)') as Element).getPropertyValue('white-space'),
      }));
      expect(columns.scrollLeft).toBe(0);
      expect(columns.headers.map(({ text }) => text)).toEqual([...firstFiveRegisterColumns]);
      for (const header of columns.headers) {
        expect(header.right, `${header.text} is fully visible without scrolling at 1440px`).toBeLessThanOrEqual(columns.visibleEnd + 0.5);
      }
      expect(columns.statementWhiteSpace, 'the statement column wraps at 1440px').toBe('normal');
      test.info().annotations.push({
        type: 'Risk Register at 1440',
        description: `data-overflow=${overflows}; the first five columns end at ${Math.round(Math.max(...columns.headers.map(({ right }) => right)))}px of a visible edge at ${Math.round(columns.visibleEnd)}px`,
      });
    }

    const moreFilters = page.getByRole('button', { name: 'More filters' });
    await moreFilters.click();
    const filterPopover = page.locator('[data-slot="popover-content"][data-state="open"]');
    await expect(filterPopover.getByLabel('Target date from')).toBeVisible();
    await expect(filterPopover.getByLabel('Target date to')).toBeVisible();
    await expect(filterPopover.getByRole('button', { name: 'Clear target dates' })).toBeVisible();
    await expectFocusVisible(filterPopover.getByLabel('Target date from'));
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
  await expectFocusVisible(riskLink);
  if (width >= 768) {
    const classification = page.getByRole('region', { name: 'Risk statement and classification' }).locator('dl');
    const issueRow = classification.getByText('Issue statement', { exact: true }).locator('..');
    const [listBox, rowBox] = await Promise.all([classification.boundingBox(), issueRow.boundingBox()]);
    expect(listBox && rowBox && rowBox.width >= listBox.width * 0.75, `long detail fields span both columns at ${width}px`).toBe(true);
  }
}

test.describe.configure({ mode: 'serial' });

test('Bob filters the Risk Register, maintains mitigation, and Jane learns no Risk facts @journey', async ({ page, request }, testInfo) => {
  test.setTimeout(600_000);

  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) {
    throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  }

  // The journey runs at its project's width: the table and More filters at 1440, the cards and the Filters sheet at 375.
  const primary = primaryViewport(testInfo);
  const mobile = primary.width < 768;
  // Every document the journey loads, for both actors, runs under the production CSP with no violation (D-19).
  await attachCspCollector(page);
  await page.setViewportSize(primary);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signInAs(page, 'Security Analyst');

  await page.goto('/app/risks');
  await expect(
    page.getByRole('heading', { name: 'Risk Register' }),
    'Expected /app/risks Risk Register heading to be visible',
  ).toBeVisible();
  await expect(page.getByText('Search and manage contextual Risks across authorised assessments.')).toBeVisible();
  await expect(page.getByRole('link', { name: mutableRiskNumber }).first(), 'Risk rows finish hydrating before the total/row consistency proof').toBeVisible();
  const initialTotal = await displayedResultTotal(page);
  const initialRiskNumbers = await visibleRiskNumbers(page, mobile);
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
  /*
   * Equal inclusive bounds guarantee the stable dated Risk and no Risk dated otherwise, not that it is
   * the only one: the Phase 7 fixtures are dated relative to the run day, so on some days one of them
   * shares this date. The step asserts what holds on every run day.
   */
  await expect(registerRecordFor(page, mobile, mutableRiskNumber), 'equal inclusive bounds return the stable dated Risk').toBeVisible();
  const boundedRisks = await visibleRiskTargetDates(page, mobile);
  const boundedTotal = await displayedResultTotal(page);
  expect(boundedRisks.map(({ riskNumber }) => riskNumber), 'equal inclusive bounds return the stable dated Risk').toContain(mutableRiskNumber);
  expect(new Set(boundedRisks.map(({ riskNumber }) => riskNumber)).size, 'the authoritative total matches the distinct Risks shown').toBe(boundedTotal);
  expect(boundedTotal, 'the target-date bounds narrow the register').toBeLessThan(initialTotal);
  expect(
    boundedRisks.filter(({ targetDates }) => targetDates.length !== 1 || targetDates[0] !== currentMutableTargetDate),
    'every Risk shown carries the bounded target date',
  ).toEqual([]);

  let filterPanel = await openFilterPanel(page, mobile);
  await expect(filterPanel.panel.getByLabel('Target date from')).toHaveValue(currentMutableTargetDate);
  await expect(filterPanel.panel.getByLabel('Target date to')).toHaveValue(currentMutableTargetDate);
  await expectFocusVisible(filterPanel.panel.getByLabel('Target date from'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Remove Target date from filter' }).click();
  await expect(page).not.toHaveURL(/targetDateFrom=/);
  await expect(page).not.toHaveURL(/unknown=/);
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  filterPanel = await openFilterPanel(page, mobile);
  const clearInitialTargetDates = filterPanel.panel.getByRole('button', { name: 'Clear target dates' });
  await clearInitialTargetDates.focus();
  await expect(clearInitialTargetDates).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  await expect(page).toHaveURL(/pageSize=25/);
  expect(await displayedResultTotal(page)).toBe(initialTotal);
  await page.keyboard.press('Escape');

  // From md the search and the three core selects sit in the filter bar; below md they are in the Filters sheet.
  if (mobile) filterPanel = await openFilterPanel(page, mobile);
  const coreFilters = mobile ? filterPanel.panel : page.getByRole('main');
  const search = coreFilters.getByRole('search').filter({ has: page.getByLabel('Search Risks') });
  await search.getByLabel('Search Risks').fill('unauthorised access');
  await search.getByRole('button', { name: 'Search Risks' }).click();
  await expect(page).toHaveURL(/q=unauthorised(?:\+|%20)access/);
  await coreFilters.getByRole('combobox', { name: 'Treatment status', exact: true }).selectOption('In Progress');
  await expect(page).toHaveURL(/treatmentStatus=In(?:\+|%20)Progress/);
  await coreFilters.getByRole('combobox', { name: 'Inherent rating', exact: true }).selectOption('High');
  await expect(page).toHaveURL(/inherentRating=High/);
  await coreFilters.getByRole('combobox', { name: 'Residual rating', exact: true }).selectOption('Moderate');
  await expect(page).toHaveURL(/residualRating=Moderate/);
  if (!mobile) filterPanel = await openFilterPanel(page, mobile);
  const furtherFilters = filterPanel.panel;
  await selectMatchingOptionAndWait(page, furtherFilters.getByRole('combobox', { name: 'Risk owner', exact: true }), 'Bob Doe', 'riskOwner');
  await selectMatchingOptionAndWait(page, furtherFilters.getByRole('combobox', { name: 'Treatment owner', exact: true }), 'Bob Doe', 'treatmentOwner');
  await selectMatchingOptionAndWait(page, furtherFilters.getByRole('combobox', { name: 'Related assessment', exact: true }), 'ASM-DEV-RISK-001', 'assessment');
  await selectMatchingOptionAndWait(page, furtherFilters.getByRole('combobox', { name: 'Impacted system', exact: true }), 'Customer portal', 'system');
  await selectMatchingOptionAndWait(page, furtherFilters.getByRole('combobox', { name: 'Impacted asset', exact: true }), 'Customer records', 'asset');
  await furtherFilters.getByRole('combobox', { name: 'Mitigation-control status', exact: true }).selectOption('Planned');
  await expect(page).toHaveURL(/mitigationStatus=Planned/);
  await furtherFilters.getByLabel('Target date from').fill(currentMutableTargetDate);
  await expect(page).toHaveURL(new RegExp(`targetDateFrom=${currentMutableTargetDate}`));
  await furtherFilters.getByLabel('Target date to').fill(currentMutableTargetDate);
  await expect(page).toHaveURL(new RegExp(`targetDateTo=${currentMutableTargetDate}`));
  await page.keyboard.press('Escape');
  await expect(filterPanel.trigger, 'the filter panel restores focus to its trigger').toBeFocused();
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

  filterPanel = await openFilterPanel(page, mobile);
  const clearComposedTargetDates = filterPanel.panel.getByRole('button', { name: 'Clear target dates' });
  await clearComposedTargetDates.focus();
  await expect(clearComposedTargetDates).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/treatmentStatus=In(?:\+|%20)Progress/);
  await expect(page).toHaveURL(/mitigationStatus=Planned/);
  await expect(page.getByText('1 result', { exact: true }), 'clearing dates retains the composed non-date filters').toBeVisible();
  await filterPanel.panel.getByLabel('Target date from').fill('2027-01-01');
  await expect(page).toHaveURL(/targetDateFrom=2027-01-01/);
  await filterPanel.panel.getByLabel('Target date to').fill('2027-01-01');
  await expect(page).toHaveURL(/targetDateTo=2027-01-01/);
  await expect(page.getByText('0 results', { exact: true }), 'valid no-match range has an authoritative zero total').toBeVisible();
  // The sheet is modal, so the page behind it leaves the accessibility tree until the sheet closes.
  if (mobile) {
    await page.keyboard.press('Escape');
    await expect(filterPanel.panel).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: 'No Risks match these filters' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/q=|treatmentStatus=|inherentRating=|residualRating=|riskOwner=|treatmentOwner=|assessment=|system=|asset=|mitigationStatus=|targetDateFrom=|targetDateTo=/);
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  await expect(page).toHaveURL(/pageSize=25/);
  expect(await displayedResultTotal(page)).toBe(initialTotal);

  if (mobile) {
    // The cards have no sort headers, so both sort orders are requested through the URL they would set.
    await page.goto('/app/risks?sort=targetDate%3Adesc&pageSize=25');
    await expect(registerRecordFor(page, mobile, mutableRiskNumber)).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Sort by Target date' }).click();
  }
  await expect(page).toHaveURL(/sort=targetDate%3Adesc/);
  const descendingRisks = await visibleRiskNumbers(page, mobile);
  expect(descendingRisks.indexOf(mutableRiskNumber), 'descending target date keeps the dated fixture before the null fixture').toBeLessThan(descendingRisks.indexOf(releasedRiskNumber));
  if (mobile) {
    await page.goto('/app/risks?sort=targetDate%3Aasc&pageSize=25');
    await expect(registerRecordFor(page, mobile, mutableRiskNumber)).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Sort by Target date' }).click();
  }
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  const ascendingRisks = await visibleRiskNumbers(page, mobile);
  expect(ascendingRisks.indexOf(mutableRiskNumber), 'ascending target date keeps the dated fixture before the null fixture').toBeLessThan(ascendingRisks.indexOf(releasedRiskNumber));
  if (!mobile) {
    const targetSort = page.getByRole('button', { name: 'Sort by Target date' });
    await expectFocusVisible(targetSort);
    const sortBox = await targetSort.boundingBox();
    expect(sortBox && sortBox.y >= 0 && sortBox.y + sortBox.height <= primary.height, 'sticky-header focus remains visible').toBe(true);
    await expectFocusNotObscured(page, targetSort, 'the focused Target date sort');
  }

  const releasedRecord = registerRecordFor(page, mobile, releasedAssessmentNumber);
  const releasedRiskLink = releasedRecord.getByRole('link', { name: releasedRiskNumber }).first();
  const releasedRiskHref = await releasedRiskLink.getAttribute('href');
  expect(releasedRiskHref).toMatch(/^\/app\/risks\/[^/]+$/);
  await releasedRiskLink.click();
  await expect(page.getByText(releasedNoticeHeading, { exact: true })).toBeVisible();
  await expect(page.getByText('This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.', { exact: true })).toBeVisible();
  // The notice keeps the page's section rhythm above the first section (direction section 3.9, W-12).
  const releasedNotice = page.getByRole('main').getByRole('alert').filter({ hasText: releasedNoticeHeading });
  const [noticeBox, firstSectionBox] = await Promise.all([
    releasedNotice.boundingBox(),
    page.getByRole('region', { name: 'Risk statement and classification' }).boundingBox(),
  ]);
  expect((firstSectionBox?.y ?? 0) - ((noticeBox?.y ?? 0) + (noticeBox?.height ?? 0)), 'the released notice sits a section gap above the first section').toBeGreaterThanOrEqual(24);
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
  /*
   * Both values are past dates, so the Overdue proof below holds on every pass. The journey runs twice
   * against one database (desktop, then mobile): toggling to the seeded 2026-12-01 on the second pass
   * would put the target date in the future. Both also sit before the window the Phase 7 fixtures date
   * relative to the run (40 days back to 7 ahead), so the equal-bounds filter above keeps matching the
   * mutable Risk alone.
   */
  const persistedTargetDate = currentMutableTargetDate === '2026-06-30' ? '2026-07-31' : '2026-06-30';
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
  const mutableRecord = registerRecordFor(page, mobile, mutableRiskNumber);
  const overdue = mutableRecord.getByText('Overdue', { exact: true });
  await expect(overdue, 'past target date has exact Overdue text').toBeVisible();
  await expect(overdue.locator('svg'), 'Overdue treatment includes its warning icon').toHaveCount(1);
  const persistedTargetLabel = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${persistedTargetDate}T00:00:00.000Z`));
  await expect(mutableRecord.getByText(persistedTargetLabel, { exact: true })).toBeVisible();

  await page.goto(mutableRiskHref!);

  await page.getByRole('button', { name: 'Add mitigation control' }).click();
  const addForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').last();
  await expectFocusVisible(addForm.getByRole('textbox', { name: 'Search reusable Controls' }));
  await addForm.getByRole('button', { name: 'Discard mitigation changes' }).click();
  await expect(page.getByRole('button', { name: 'Add mitigation control' })).toBeVisible();

  for (const width of viewportWidths) {
    await expectRegisterGeometry(page, width);
    await expectDetailGeometry(page, mutableRiskHref!, width);
  }

  // Alerts at 768 (D-29): its scroller is the named region exactly while the table overflows.
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/app/alerts');
  const alertsOverflow = await expectRegionFollowsOverflow(page, 'Alerts', 'Alerts at 768px');
  if (alertsOverflow) {
    const alertsRegion = page.getByRole('region', { name: 'Alerts, scrolls horizontally', exact: true });
    await page.getByRole('button', { name: /^Use (compact|default) density$/ }).focus();
    await page.keyboard.press('Tab');
    await expect(alertsRegion, 'Tab reaches the Alerts region at 768px').toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => alertsRegion.evaluate((element) => element.scrollLeft), { message: 'ArrowRight scrolls the Alerts region' }).toBeGreaterThan(0);
  }
  test.info().annotations.push({ type: 'Alerts at 768', description: `data-overflow=${alertsOverflow}` });

  // A table that fits exposes no region and no tab stop (UI-SPEC section 5.5).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/requests');
  expect(await expectRegionFollowsOverflow(page, 'My assessment requests', 'My Requests at 1440px'), 'the analyst’s own request list fits at 1440px').toBe(false);

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
  await signInAs(page, 'Requestor');
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
  await expectNoCspViolations(page, 'the Risk Register journey');
});
