import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { expectFocusNotObscured, expectFocusVisible } from './helpers/focus';
import { primaryViewport, signInAs } from './helpers/navigation';
import { labelToFieldGap } from './helpers/forms';
import { paintedPixel, rgbOf, sameColour } from './helpers/pixel';
import { settleElementWidth, settleScrollPosition } from './helpers/settle';

const releasedAssessmentNumber = 'ASM-2026-33SAEN';
const releasedRiskNumber = 'RSK-RELEASED-33SAEN';
const mutableRiskNumber = 'RSK-DEV-MUTABLE-001';
/*
 * FE3-15: the register search (risk number or statement) that finds the two stable fixtures and, as seeded, no other
 * Risk: the mutable fixture's number and statement, and the released fixture's statement ("…immutable register…").
 * Earlier specs keep adding Risks to the shared run database, so proofs that read one page read only these.
 */
const fixtureSearch = 'mutable';
const releasedNoticeHeading = 'Released assessment - read only';
// The mutable Risk's assessment and its request's title, which the Related assessment picker shows beside it (D-32, X-4).
const mutableAssessmentNumber = 'ASM-DEV-RISK-001';
const mutableAssessmentRequestTitle = 'Customer portal penetration test findings';
// 1280 is where the filter bar becomes one row of four tracks (UI-SPEC section 4.1).
const viewportWidths = [375, 390, 430, 768, 1024, 1280, 1440] as const;
const filterLabels = ['Search Risks', 'Treatment status', 'Inherent rating', 'Residual rating'] as const;
const firstFiveRegisterColumns = ['Risk number', 'Statement', 'Inherent rating', 'Residual rating', 'Treatment status'] as const;
const mutationActionName = /Edit risk|Save risk|Discard risk changes|Add mitigation control|Edit mitigation control|Save mitigation control|Remove mitigation control|close|more actions/i;
/*
 * D-40, D-44: the seeded Phase 7 Risks (seed-analyst-insights.ts). Four sit under the in-review assessment and one,
 * a Critical Risk in treatment, under the released assessment. Their numbers share a prefix the register's search
 * matches, so the proofs find them by search rather than by their place on a page other journeys add Risks to.
 */
const phase7RiskSearch = 'RSK-E2E-P7';
const phase7UnderAssessmentRiskNumbers = ['RSK-E2E-P7-OVERDUE-001', 'RSK-E2E-P7-DUESOON-001', 'RSK-E2E-P7-CRITICAL-001', 'RSK-E2E-P7-CLOSED-001'] as const;
const phase7ReleasedRiskNumber = 'RSK-E2E-P7-RELEASED-001';
// D-35: the seeded overdue Risk (target 30 days ago) and due-soon Risk (target 7 days ahead), both open and in treatment.
const phase7OverdueRiskNumber = 'RSK-E2E-P7-OVERDUE-001';
const phase7DueSoonRiskNumber = 'RSK-E2E-P7-DUESOON-001';

test('UX09_DESKTOP_FILTERS_SCROLL: every More filters control remains reachable on a short desktop', async ({ page }) => {
  await signInAs(page, 'Security Analyst');
  for (const height of [900, 600]) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto('/app/risks');
    const { panel } = await openFilterPanel(page, false);
    const bounds = await panel.boundingBox();
    expect(bounds, 'desktop filter panel exists').not.toBeNull();
    expect(bounds!.y, 'filter panel starts inside viewport').toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height, 'filter panel fits viewport').toBeLessThanOrEqual(height);
    await panel.getByLabel('Target date from', { exact: true }).fill('2026-01-01');
    const last = panel.getByRole('button', { name: 'Clear target dates', exact: true });
    await last.focus();
    const box = await last.boundingBox();
    expect(box, 'final control has a box').not.toBeNull();
    expect(box!.y + box!.height, 'final control scrolls into viewport on focus').toBeLessThanOrEqual(height);
    await last.click();
    await page.keyboard.press('Escape');
  }
});

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

async function selectMatchingOptionAndWait(page: Page, combobox: Locator, label: string, key: string, optionLabel = label): Promise<void> {
  await combobox.fill(label);
  const option = page.getByRole('option', { name: optionLabel, exact: true });
  await expect(option, `${optionLabel} is returned by the authorised relation search`).toBeVisible();
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
 *
 * A pixel speaks for the hairline only where nothing else can be drawn. First the region's and the page's
 * scroll positions must hold still: ArrowRight scrolls the region smoothly, so the poll that sees it move
 * returns mid-animation. Then both pinned cells must lie in the window, clear of the sticky application
 * header. Tab's focus scroll does not stop at the root's scroll padding as scrollIntoView does, so it leaves a
 * register taller than the window with its header row under that header. In the full suite's mobile pass the
 * register lists 22 Risks (8 when this file runs alone), and every full run read the header's translucent
 * background there. Only the page is then scrolled to the region's top; the region keeps the scroll position
 * under test, and the cell must be what the browser shows at every sampled point before its colour is read.
 */
async function expectStickyHairlinePainted(page: Page, region: Locator, message: string): Promise<void> {
  await settleScrollPosition(region);
  const pinnedCellsOutOfView = await region.evaluate((element) => {
    const header = element.querySelector('thead tr th:first-child');
    const body = element.querySelector('tbody tr td:first-child');
    // A missing cell is reported by the checks below.
    if (!header || !body) return false;
    const appHeaderBottom = document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0;
    return header.getBoundingClientRect().top < appHeaderBottom || body.getBoundingClientRect().bottom > document.documentElement.clientHeight;
  });
  if (pinnedCellsOutOfView) {
    // scrollIntoView moves the region's scroll ancestors, never the region's own scroll position.
    await region.evaluate((element) => element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' }));
    await settleScrollPosition(region);
    test.info().annotations.push({ type: 'Sticky hairline', description: `${message}: the page was scrolled to the region's top to bring the pinned cells into view below the application header` });
  }
  for (const [part, selector] of [['header', 'thead tr th:first-child'], ['body', 'tbody tr td:first-child']] as const) {
    const edge = await region.evaluate((element, cellSelector) => {
      const cell = element.querySelector<HTMLElement>(cellSelector);
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      const xs = [...new Set([Math.floor(rect.right) - 1, Math.round(rect.right) - 1, Math.ceil(rect.right) - 1])];
      const y = Math.round(rect.top + rect.height / 2);
      return {
        xs,
        y,
        colour: getComputedStyle(cell).borderRightColor,
        scrollLeft: element.scrollLeft,
        // What the browser shows at each sampled point: the cell itself, or whatever is drawn over it.
        shown: xs.map((x) => {
          const top = document.elementFromPoint(x, y);
          if (!top) return 'nothing (outside the viewport)';
          return top === cell || cell.contains(top) ? 'the cell' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]}`;
        }),
      };
    }, selector);
    expect(edge, `${message}: the table has a first ${part} cell`).not.toBeNull();
    expect(edge!.shown, `${message}: the pinned ${part} cell is what the browser shows at its end edge at scrollLeft ${edge!.scrollLeft}`).toEqual(edge!.xs.map(() => 'the cell'));
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
  await page.goto('/app/risks?pageSize=50');
  await expect(page.getByRole('heading', { name: 'Risk Register' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveCount(1);
  await expectNoHorizontalOverflow(page, `Risk Register has no horizontal overflow at ${width}px`);

  if (width < 768) {
    const cards = page.locator('[data-slot="data-table-mobile"]');
    await expect(cards, `Risk cards render at ${width}px`).toBeVisible();
    // One card per row of this page (pageSize=50): the shared register can outgrow one page across runs (19-15 gate).
    await expect(cards.getByRole('article')).toHaveCount(Math.min(await displayedResultTotal(page), 50));
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

  await page.goto('/app/risks?pageSize=50');
  await expect(
    page.getByRole('heading', { name: 'Risk Register' }),
    'Expected /app/risks Risk Register heading to be visible',
  ).toBeVisible();
  // The page header is read in <main>: until React reveals the streamed list, its hidden copy sits outside it (19-15 gate).
  await expect(page.getByRole('main').getByText('Search and manage Risks from released risk assessments and from those still under assessment.')).toBeVisible();
  await expect(page.getByText(/^\d+ results?$/), 'the register shows its authoritative total').toBeVisible();
  // The whole register's total, which the filters below narrow and Clear filters restores.
  const initialTotal = await displayedResultTotal(page);
  expect(initialTotal, 'Risk Register contains both stable acceptance fixtures').toBeGreaterThanOrEqual(2);

  // FE3-15: the total/row proof reads its own fixtures, so it holds however many Risks earlier specs added.
  await page.goto(`/app/risks?q=${fixtureSearch}&pageSize=50`);
  await expect(page.getByRole('link', { name: mutableRiskNumber }).first(), 'Risk rows finish hydrating before the total/row consistency proof').toBeVisible();
  const fixtureTotal = await displayedResultTotal(page);
  const fixtureRiskNumbers = await visibleRiskNumbers(page, mobile);
  expect(fixtureTotal, 'the fixture search finds both stable acceptance fixtures').toBeGreaterThanOrEqual(2);
  expect(fixtureTotal, 'the fixture search fits one 50-row page').toBeLessThanOrEqual(50);
  expect(new Set(fixtureRiskNumbers).size, 'authoritative total matches distinct rendered Risks').toBe(fixtureTotal);
  expect(fixtureRiskNumbers).toEqual(expect.arrayContaining([mutableRiskNumber, releasedRiskNumber]));

  const initialMutableHref = await page.getByRole('link', { name: mutableRiskNumber }).first().getAttribute('href');
  expect(initialMutableHref).toMatch(/^\/app\/risks\/[^/]+$/);
  await page.goto(initialMutableHref!);
  await page.getByRole('button', { name: 'Edit risk' }).click();
  const currentMutableTargetDate = await page.getByRole('form', { name: 'Edit Risk' }).getByLabel('Target date').inputValue();
  expect(currentMutableTargetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole('form', { name: 'Edit Risk' }).getByRole('button', { name: 'Discard risk changes' }).click();

  await page.goto(`/app/risks?targetDateFrom=${currentMutableTargetDate}&targetDateTo=${currentMutableTargetDate}&unknown=discard-me&sort=targetDate%3Aasc&pageSize=50`);
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
  await expect(page).toHaveURL(/pageSize=50/);
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
  await selectMatchingOptionAndWait(
    page,
    furtherFilters.getByRole('combobox', { name: 'Related assessment', exact: true }),
    mutableAssessmentNumber,
    'assessment',
    `${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`,
  );
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
  await expect(page).toHaveURL(/pageSize=50/);
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
  await expect(page).toHaveURL(/pageSize=50/);
  expect(await displayedResultTotal(page)).toBe(initialTotal);

  // FE3-15: both orders are read within the fixture search, so the two fixtures share one page however large the register.
  if (mobile) {
    // The cards have no sort headers, so both sort orders are requested through the URL they would set.
    await page.goto(`/app/risks?q=${fixtureSearch}&sort=targetDate%3Adesc&pageSize=50`);
    await expect(registerRecordFor(page, mobile, mutableRiskNumber)).toBeVisible();
  } else {
    await page.goto(`/app/risks?q=${fixtureSearch}&sort=targetDate%3Aasc&pageSize=50`);
    await expect(registerRecordFor(page, mobile, mutableRiskNumber)).toBeVisible();
    await page.getByRole('button', { name: 'Sort by Target date' }).click();
  }
  await expect(page).toHaveURL(/sort=targetDate%3Adesc/);
  const descendingRisks = await visibleRiskNumbers(page, mobile);
  expect(descendingRisks, 'both fixtures share the searched page').toEqual(expect.arrayContaining([mutableRiskNumber, releasedRiskNumber]));
  expect(descendingRisks.indexOf(mutableRiskNumber), 'descending target date keeps the dated fixture before the null fixture').toBeLessThan(descendingRisks.indexOf(releasedRiskNumber));
  if (mobile) {
    await page.goto(`/app/risks?q=${fixtureSearch}&sort=targetDate%3Aasc&pageSize=50`);
    await expect(registerRecordFor(page, mobile, mutableRiskNumber)).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Sort by Target date' }).click();
  }
  await expect(page).toHaveURL(/sort=targetDate%3Aasc/);
  const ascendingRisks = await visibleRiskNumbers(page, mobile);
  expect(ascendingRisks, 'both fixtures share the searched page').toEqual(expect.arrayContaining([mutableRiskNumber, releasedRiskNumber]));
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

  await page.goto(`/app/risks?q=${fixtureSearch}`);
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

  await page.goto(`/app/risks?q=${fixtureSearch}&sort=targetDate%3Aasc&pageSize=50`);
  const mutableRecord = registerRecordFor(page, mobile, mutableRiskNumber);
  const overdue = mutableRecord.getByText('Overdue', { exact: true });
  await expect(overdue, 'past target date has exact Overdue text').toBeVisible();
  await expect(overdue.locator('svg'), 'Overdue treatment includes its warning icon').toHaveCount(1);
  const persistedTargetLabel = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${persistedTargetDate}T00:00:00.000Z`));
  await expect(mutableRecord.getByText(persistedTargetLabel, { exact: true })).toBeVisible();

  await page.goto(mutableRiskHref!);

  await page.getByRole('button', { name: 'Add mitigation control' }).click();
  const addForm = page.getByRole('region', { name: 'Mitigation controls' }).locator('form').last();
  // E16 (UI-SPEC §13.1): the new form opens with focus in its Control picker, which does the searching.
  await expectFocusVisible(addForm.getByRole('combobox', { name: 'Control', exact: true }));
  await addForm.getByRole('button', { name: 'Discard mitigation changes' }).click();
  await expect(page.getByRole('button', { name: 'Add mitigation control' })).toBeVisible();
  // X-5 (walkthrough fix 6): discarding returns focus to the control that opened the form.
  await expect(page.getByRole('button', { name: 'Add mitigation control' }), 'RISK_DISCARD_RETURNS_FOCUS').toBeFocused();

  /*
   * ASSESS06_SYSTEM_PAST_FIRST_PAGE (D-28, UAT-010): a system the old 25-row option list could never show is
   * found by typing. The proof brings its own fixture (D-39): 26 uniquely named Information Systems imported
   * through the Administration CSV import. A prefix search fills one 25-row page, leaving one of them out; typing
   * its name finds it. The edit is then discarded by reloading, so the shared mutable Risk is unchanged.
   */
  const pickerSuffix = Date.now().toString(36);
  const pickerSystemName = (index: number) => `Picker proof ${pickerSuffix} ${String(index).padStart(2, '0')}`;
  const pickerCsv = ['name,description', ...Array.from({ length: 26 }, (_, index) => `${pickerSystemName(index + 1)},Record picker proof system`)].join('\r\n');
  await page.goto('/app/admin/information-systems/import');
  await expect(page.getByRole('heading', { level: 1, name: 'Import Information Systems', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose file' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `picker-proof-${pickerSuffix}.csv`, mimeType: 'text/csv', buffer: Buffer.from(pickerCsv) });
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(page.getByRole('button', { name: 'Create (26)' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to confirmation' }).click();
  await page.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }).click();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeFocused();
  await expect(page.getByText('Created 26', { exact: true })).toBeVisible();

  await page.goto(mutableRiskHref!);
  await page.getByRole('button', { name: 'Edit risk' }).click();
  const pickerRiskForm = page.getByRole('form', { name: 'Edit Risk' });
  const systemPicker = pickerRiskForm.getByRole('combobox', { name: 'Information system impacted', exact: true });
  await systemPicker.fill(`Picker proof ${pickerSuffix}`);
  await expect(page.getByText('Showing the first 25 matches. Keep typing to narrow the list.', { exact: true }), 'the prefix fills one bounded page').toBeVisible();
  /*
   * IN-407: the search sends no sort, so which proof system misses the page is the server's choice. The page holds
   * exactly 25 of the 26, and the one it leaves out is found by typing its name.
   */
  await expect(page.getByRole('option', { name: new RegExp(`^Picker proof ${pickerSuffix} [0-9]{2}$`) }), 'the page holds 25 of the 26 proof systems').toHaveCount(25);
  const pageMisses: string[] = [];
  for (let index = 1; index <= 26; index += 1) {
    if (await page.getByRole('option', { name: pickerSystemName(index), exact: true }).count() === 0) pageMisses.push(pickerSystemName(index));
  }
  expect(pageMisses, 'one proof system is past the first page').toHaveLength(1);
  const pastFirstPageName = pageMisses[0]!;
  await systemPicker.fill(pastFirstPageName);
  const pastFirstPage = page.getByRole('option', { name: pastFirstPageName, exact: true });
  await expect(pastFirstPage, 'typing its name finds the system past the first page').toBeVisible();
  await pastFirstPage.click();
  await expect(pickerRiskForm.getByText(`Selected system: ${pastFirstPageName}`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit risk' })).toBeVisible();
  await expect(page.getByText(pastFirstPageName), 'the discarded choice left the shared Risk unchanged').toHaveCount(0);

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

  // A table that fits exposes no region and no tab stop (UI-SPEC section 5.5). My requests gained the Next step column
  // (11-11, D-34) and may now be wider than 1440px allows, which Phase 11 UI-SPEC §7 permits: its scroller still follows
  // its measured width. The four-column My released risk assessments, whose request title wraps, is the table that fits.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/requests');
  await expectRegionFollowsOverflow(page, 'My assessment requests', 'My Requests at 1440px');
  await page.goto('/app/assessments');
  expect(await expectRegionFollowsOverflow(page, 'My released risk assessments', 'My risk assessments at 1440px'), 'the analyst’s own released assessment list fits at 1440px').toBe(false);

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
  const detailDenialCopy = 'You don’t have permission to view the Risk register';
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

/*
 * D-40, D-44 and UAT-060: the register says which Risks are released and which are still under assessment, and
 * filters by both. As the Security Analyst at 1440, the seeded in-review assessment's Risks list under
 * stage=under-assessment with "Under assessment" under each Related assessment link, the seeded released Critical
 * Risk lists under stage=released with "Released", and the two stage totals sum to the unfiltered total: nothing
 * leaves the register. Desktop only: the journey below proves the card markers at 375.
 */
test('DASH03_REGISTER_STAGE: the Risk register lists and marks released and under-assessment Risks, and the stages sum to the register', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'Security Analyst');

  await page.goto(`/app/risks?stage=under-assessment&q=${phase7RiskSearch}&pageSize=50`);
  await expect(registerRecordFor(page, false, phase7UnderAssessmentRiskNumbers[0]), 'the filtered register has hydrated').toBeVisible();
  await expect(page.getByText('Stage: Under assessment', { exact: true }), 'DASH03_STAGE_CHIP').toBeVisible();
  const underAssessment = await visibleRiskNumbers(page, false);
  expect(underAssessment, 'DASH03_UNDER_ASSESSMENT_LISTS_THE_IN_REVIEW_RISKS').toEqual(expect.arrayContaining([...phase7UnderAssessmentRiskNumbers]));
  expect(underAssessment, 'DASH03_UNDER_ASSESSMENT_OMITS_THE_RELEASED_RISK').not.toContain(phase7ReleasedRiskNumber);
  for (const riskNumber of underAssessment) {
    const row = registerRecordFor(page, false, riskNumber);
    await expect(row.getByText('Under assessment', { exact: true }), `DASH03_ROW_MARKER_${riskNumber}`).toBeVisible();
    await expect(row.getByText('Released', { exact: true }), `DASH03_ROW_ONE_STAGE_${riskNumber}`).toHaveCount(0);
  }

  await page.goto(`/app/risks?stage=released&q=${phase7RiskSearch}&pageSize=50`);
  await expect(registerRecordFor(page, false, phase7ReleasedRiskNumber), 'DASH03_RELEASED_LISTS_THE_RELEASED_RISK').toBeVisible();
  const released = await visibleRiskNumbers(page, false);
  for (const riskNumber of phase7UnderAssessmentRiskNumbers) expect(released, `DASH03_RELEASED_OMITS_${riskNumber}`).not.toContain(riskNumber);
  for (const riskNumber of released) {
    await expect(registerRecordFor(page, false, riskNumber).getByText('Released', { exact: true }), `DASH03_ROW_MARKER_${riskNumber}`).toBeVisible();
  }

  // The whole register: each Risk in scope is in exactly one stage, so the two totals sum to the unfiltered total.
  const totalAt = async (path: string) => {
    await page.goto(path);
    await expect(page.getByText(/^\d+ results?$/), `${path} shows its total`).toBeVisible();
    return displayedResultTotal(page);
  };
  const registerTotal = await totalAt('/app/risks');
  const releasedTotal = await totalAt('/app/risks?stage=released');
  const underAssessmentTotal = await totalAt('/app/risks?stage=under-assessment');
  expect(releasedTotal, 'DASH03_RELEASED_TOTAL').toBeGreaterThan(0);
  expect(underAssessmentTotal, 'DASH03_UNDER_ASSESSMENT_TOTAL').toBeGreaterThan(0);
  expect(releasedTotal + underAssessmentTotal, 'DASH03_STAGES_SUM_TO_THE_REGISTER').toBe(registerTotal);
});

/*
 * D-44, UI-SPEC section 9.5 at 375: each card names its Risk's stage after the Related assessment link, and the
 * Filters sheet holds the Stage control with the active value.
 */
test('DASH03_REGISTER_STAGE_CARDS: Risk register cards name each Risk’s stage at 375 @journey', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'Security Analyst');

  await page.goto(`/app/risks?stage=under-assessment&q=${phase7RiskSearch}&pageSize=50`);
  for (const riskNumber of phase7UnderAssessmentRiskNumbers) {
    const card = registerRecordFor(page, true, riskNumber);
    await expect(card.getByText('Under assessment', { exact: true }), `DASH03_CARD_MARKER_${riskNumber}`).toBeVisible();
  }
  const { panel } = await openFilterPanel(page, true);
  await expect(panel.getByRole('combobox', { name: 'Stage', exact: true }), 'DASH03_SHEET_STAGE').toHaveValue('under-assessment');
  await expect(panel.getByText('Search and filter Risks.', { exact: true }), 'D-54 sheet description').toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(`/app/risks?stage=released&q=${phase7RiskSearch}&pageSize=50`);
  const releasedCard = registerRecordFor(page, true, phase7ReleasedRiskNumber);
  await expect(releasedCard.getByText('Released', { exact: true }), 'DASH03_CARD_MARKER_RELEASED').toBeVisible();
  await expect(releasedCard.getByRole('link', { name: phase7ReleasedRiskNumber }), 'the card opens its Risk').toBeVisible();
});

/*
 * D-32 and UAT-048: the Related assessment picker searches on the server by request title. A word that appears
 * only in the seeded assessment's request title (not in its number or summary) lists it as {number} · {title}.
 * Desktop only: it reads and changes nothing, and the journey above proves the picker at 375.
 */
test('UX09_PICKER_FINDS_BY_REQUEST_TITLE: the Related assessment picker finds an assessment by its request title', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'Security Analyst');
  await page.goto('/app/risks');
  await expect(page.getByRole('link', { name: mutableRiskNumber }).first(), 'the register has hydrated').toBeVisible();

  const { panel } = await openFilterPanel(page, false);
  const picker = panel.getByRole('combobox', { name: 'Related assessment', exact: true });
  await picker.fill('penetration');
  const option = page.getByRole('option', { name: `${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`, exact: true });
  await expect(option, 'UX09_PICKER_FINDS_BY_REQUEST_TITLE').toBeVisible();
  await option.click();
  await expect(page, 'UX09_PICKER_SELECTS_THE_ASSESSMENT').toHaveURL(/[?&]assessment=/);
  await expect(registerRecordFor(page, false, mutableRiskNumber), 'UX09_PICKER_FILTERS_THE_REGISTER').toBeVisible();
});

/*
 * D-02 item 3, D-35, UX-09 criterion 2, UI-SPEC section 9.5: the register lists the Risks behind each figure. As
 * the Security Analyst at 1440: dueState=overdue lists the seeded overdue Risk and not the due-soon one, with the
 * chip "Due state: Overdue", and dueState=due-soon the reverse; Any mitigation control and No impacted system, chosen
 * in More filters, show their chips and a total that Clear filters restores; and the Related assessment chip names
 * the chosen assessment by its number and request title (D-32). The seeded Risks are found by search, never by
 * their place on a page other journeys add Risks to. Desktop only: the journey below proves the phone sheet.
 */
test('UX09_REGISTER_FIGURE_FILTERS: the Risk register lists the Risks behind each due state, mitigation and system figure', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, 'Security Analyst');

  await page.goto(`/app/risks?dueState=overdue&q=${phase7RiskSearch}&pageSize=50`);
  await expect(registerRecordFor(page, false, phase7OverdueRiskNumber), 'UX09_DUE_STATE_OVERDUE_LISTS_THE_OVERDUE_RISK').toBeVisible();
  await expect(page.getByText('Due state: Overdue', { exact: true }), 'UX09_DUE_STATE_CHIP').toBeVisible();
  expect(await visibleRiskNumbers(page, false), 'UX09_DUE_STATE_OVERDUE_OMITS_THE_DUE_SOON_RISK').not.toContain(phase7DueSoonRiskNumber);

  await page.goto(`/app/risks?dueState=due-soon&q=${phase7RiskSearch}&pageSize=50`);
  await expect(registerRecordFor(page, false, phase7DueSoonRiskNumber), 'UX09_DUE_STATE_DUE_SOON_LISTS_THE_DUE_SOON_RISK').toBeVisible();
  await expect(page.getByText('Due state: Due soon', { exact: true }), 'UX09_DUE_SOON_CHIP').toBeVisible();
  expect(await visibleRiskNumbers(page, false), 'UX09_DUE_STATE_DUE_SOON_OMITS_THE_OVERDUE_RISK').not.toContain(phase7OverdueRiskNumber);

  // Any mitigation control and No impacted system narrow the whole register; Clear filters restores its total.
  await page.goto('/app/risks');
  await expect(page.getByText(/^\d+ results?$/), 'the register shows its total').toBeVisible();
  const registerTotal = await displayedResultTotal(page);
  let filterPanel = await openFilterPanel(page, false);
  await filterPanel.panel.getByRole('combobox', { name: 'Mitigation-control status', exact: true }).selectOption({ label: 'Any mitigation control' });
  await expect(page, 'UX09_ANY_MITIGATION_IN_THE_URL').toHaveURL(/[?&]mitigationStatus=any(?:&|$)/);
  await filterPanel.panel.getByRole('checkbox', { name: 'No impacted system' }).click();
  await expect(page, 'UX09_NO_IMPACTED_SYSTEM_IN_THE_URL').toHaveURL(/[?&]impactedSystem=none(?:&|$)/);
  await page.keyboard.press('Escape');
  await expect(filterPanel.trigger, 'More filters restores focus to its trigger').toBeFocused();
  await expect(page.getByText('Mitigation-control status: Any mitigation control', { exact: true }), 'UX09_ANY_MITIGATION_CHIP').toBeVisible();
  await expect(page.getByText('Impacted system: None', { exact: true }), 'UX09_NO_IMPACTED_SYSTEM_CHIP').toBeVisible();
  const narrowedTotal = await displayedResultTotal(page);
  expect(narrowedTotal, 'UX09_FIGURE_FILTERS_ONLY_NARROW: seeded impacted-system Risks are excluded').toBeLessThan(registerTotal);
  await page.goto(`/app/risks?mitigationStatus=any&impactedSystem=none&q=${encodeURIComponent(phase7OverdueRiskNumber)}`);
  await expect(registerRecordFor(page, false, phase7OverdueRiskNumber), 'no-system excludes the known impacted-system Risk').toHaveCount(0);
  await page.goto('/app/risks?mitigationStatus=any&impactedSystem=none');
  /*
   * Clear filters is server-rendered, so a click before the register hydrates reaches no handler, and hydration takes
   * longer the more rows this view lists (the Phase 12 journey plans controls on three Risks with no impacted system).
   * The click is repeated only while the filters are still in the URL, never once it has landed.
   */
  const clearFilters = page.getByRole('button', { name: 'Clear filters' }).first();
  await expect(async () => {
    if (/mitigationStatus=|impactedSystem=/.test(page.url())) await clearFilters.click({ timeout: 2_000 });
    await expect(page).not.toHaveURL(/mitigationStatus=|impactedSystem=/, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText(`${registerTotal} ${registerTotal === 1 ? 'result' : 'results'}`, { exact: true }), 'UX09_CLEAR_FILTERS_RESTORES_THE_TOTAL').toBeVisible();

  // D-32, UI-SPEC section 7.4: the Related assessment chip reads {number} · {request title}.
  filterPanel = await openFilterPanel(page, false);
  await filterPanel.panel.getByRole('combobox', { name: 'Related assessment', exact: true }).fill('penetration');
  await page.getByRole('option', { name: `${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`, exact: true }).click();
  await expect(page).toHaveURL(/[?&]assessment=/);
  await page.keyboard.press('Escape');
  await expect(
    page.getByText(`Related assessment: ${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`, { exact: true }),
    'UX09_RELATED_ASSESSMENT_CHIP_NAMES_THE_REQUEST_TITLE',
  ).toBeVisible();
  await expect(registerRecordFor(page, false, mutableRiskNumber), 'the assessment filters the register').toBeVisible();
});

/*
 * D-35, UI-SPEC section 9.5 at 375: the phone Filters sheet holds Due state, which lists the seeded overdue Risk's
 * card with its chip; the sheet scrolls to reach it.
 */
test('UX09_REGISTER_FIGURE_FILTERS_SHEET: the phone Filters sheet sets Due state at 375 @journey', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'Security Analyst');

  await page.goto(`/app/risks?q=${phase7RiskSearch}&pageSize=50`);
  await expect(registerRecordFor(page, true, phase7OverdueRiskNumber), 'the searched register has hydrated').toBeVisible();
  const { panel } = await openFilterPanel(page, true);
  const dueState = panel.getByRole('combobox', { name: 'Due state', exact: true });
  await dueState.scrollIntoViewIfNeeded();
  await expect(dueState, 'UX09_SHEET_DUE_STATE_REACHABLE').toBeInViewport();
  await dueState.selectOption({ label: 'Overdue' });
  await expect(page, 'UX09_SHEET_DUE_STATE_IN_THE_URL').toHaveURL(/[?&]dueState=overdue(?:&|$)/);
  await expect(dueState, 'the sheet keeps the active value').toHaveValue('overdue');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(registerRecordFor(page, true, phase7OverdueRiskNumber), 'UX09_SHEET_DUE_STATE_LISTS_THE_OVERDUE_CARD').toBeVisible();
  await expect(registerRecordFor(page, true, phase7DueSoonRiskNumber), 'UX09_SHEET_DUE_STATE_OMITS_THE_DUE_SOON_CARD').toHaveCount(0);
  await expect(page.getByText('Due state: Overdue', { exact: true }), 'UX09_SHEET_DUE_STATE_CHIP').toBeVisible();
  await expectNoHorizontalOverflow(page, 'UX09_SHEET_NO_HORIZONTAL_OVERFLOW');

  // UI-SPEC UI Considerations (register filters, long text): the long Related assessment chip wraps inside its box.
  const sheet = (await openFilterPanel(page, true)).panel;
  await sheet.getByRole('combobox', { name: 'Related assessment', exact: true }).fill('penetration');
  await page.getByRole('option', { name: `${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`, exact: true }).click();
  await expect(page).toHaveURL(/[?&]assessment=/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  const longChip = page.getByText(`Related assessment: ${mutableAssessmentNumber} · ${mutableAssessmentRequestTitle}`, { exact: true });
  await expect(longChip, 'UX09_SHEET_LONG_CHIP').toBeVisible();
  const chipGeometry = await longChip.evaluate((element) => {
    const chip = element.closest('.rounded-md') ?? element;
    return { scrollHeight: chip.scrollHeight, clientHeight: chip.clientHeight, right: chip.getBoundingClientRect().right, viewport: window.innerWidth };
  });
  expect(chipGeometry.scrollHeight, 'UX09_SHEET_LONG_CHIP_WRAPS_INSIDE_ITS_BOX').toBeLessThanOrEqual(chipGeometry.clientHeight + 1);
  expect(chipGeometry.right, 'UX09_SHEET_LONG_CHIP_WITHIN_THE_VIEWPORT').toBeLessThanOrEqual(chipGeometry.viewport + 1);
  await expectNoHorizontalOverflow(page, 'UX09_SHEET_LONG_CHIP_NO_HORIZONTAL_OVERFLOW');
});
