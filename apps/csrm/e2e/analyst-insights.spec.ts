import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Phase 7 browser proofs. Plans 05, 07 and 08 add one slice each (alerts, reports, the analyst
 * dashboard). Plan 09 adds the cross-screen analyst journey, which also opens every report, and one
 * denial matrix across every Phase 7 route for both Requestor identities.
 *
 * The fixture keys are duplicated by value from apps/backend/src/bootstrap/seed-analyst-insights.ts,
 * which reconciles them with boot-relative dates on every Strapi boot. Other specs create records
 * during a run, so these proofs assert fixture membership, actor-correct links and denial, and
 * never a global total (D-24).
 */
const fixture = {
  risks: {
    overdue: 'RSK-E2E-P7-OVERDUE-001',
    dueSoon: 'RSK-E2E-P7-DUESOON-001',
    critical: 'RSK-E2E-P7-CRITICAL-001',
    closed: 'RSK-E2E-P7-CLOSED-001',
    released: 'RSK-E2E-P7-RELEASED-001',
  },
  requests: {
    overdue: 'RAR-E2E-P7-OVERDUE-001',
    dueSoon: 'RAR-E2E-P7-DUESOON-001',
  },
  assessments: {
    released: 'ASM-E2E-P7-RELEASED-001',
  },
} as const;

/*
 * The four reports as the copy map and the served definitions name them. Together `tableSections`
 * and `alertSections` are every section a report renders. A table section's table is the text
 * equivalent of its chart (or, for the cross-tab, the section itself); an alert section lists shared
 * alert rows, so it is proved by a Phase 7 fixture row instead of a table.
 */
const reports = [
  {
    key: 'risk-exposure',
    title: 'Risk exposure',
    documentTitle: 'Risk Exposure Report | IdamBox CSRM',
    tiles: 3,
    tableSections: ['Inherent and residual rating', 'Residual rating by treatment status', 'Most exposed Information Systems'],
    alertSections: [],
  },
  {
    key: 'treatment-performance',
    title: 'Treatment performance',
    documentTitle: 'Treatment Performance Report | IdamBox CSRM',
    tiles: 3,
    tableSections: ['Due state', 'Treatment status'],
    alertSections: ['Most overdue treatments'],
  },
  {
    key: 'assessment-throughput',
    title: 'Assessment throughput',
    documentTitle: 'Assessment Throughput Report | IdamBox CSRM',
    tiles: 2,
    tableSections: ['Released per month', 'Assessment Requests by lifecycle state'],
    alertSections: [],
  },
  {
    key: 'control-effectiveness',
    title: 'Control effectiveness',
    documentTitle: 'Control Effectiveness Report | IdamBox CSRM',
    tiles: 2,
    tableSections: ['Implementation status', 'Effectiveness rating'],
    alertSections: [],
  },
] as const;

/*
 * Every Phase 7 URL a Requestor might type, with the header, the UI-SPEC §7.5 permission heading and
 * the document title each keeps when it refuses them. An invented report key is refused exactly as a
 * real one is, so nothing tells the two apart (UI-SPEC §6.3).
 */
const phase7Routes = [
  { url: '/app/review', heading: 'Analyst dashboard', permission: 'You don’t have access to the analyst dashboard', documentTitle: 'Analyst Dashboard | IdamBox CSRM' },
  { url: '/app/alerts', heading: 'Alerts', permission: 'You don’t have access to alerts', documentTitle: 'Alerts | IdamBox CSRM' },
  { url: '/app/reports', heading: 'Reports', permission: 'You don’t have access to reports', documentTitle: 'Reports | IdamBox CSRM' },
  { url: '/app/reports/risk-exposure', heading: 'Reports', permission: 'You don’t have access to reports', documentTitle: 'Reports | IdamBox CSRM' },
  { url: '/app/reports/not-a-report', heading: 'Reports', permission: 'You don’t have access to reports', documentTitle: 'Reports | IdamBox CSRM' },
] as const;

type Role = 'Requestor' | 'Secondary Requestor' | 'Security Analyst';

async function signIn(page: Page, role: Role): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);

  await page.getByRole('button', { name: `Continue as ${role}`, exact: true }).click();
  /*
   * Assert the shell, never the URL: '/sign-in?returnTo=/app' also ends in '/app', so a URL
   * check alone reports a click that never left sign-in as a success.
   */
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true }), `SIGN_IN_SHELL:${role}`).toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), `SIGN_IN_ROLE:${role}`).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, message: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message },
  ).toBe(true);
}

/**
 * The end-edge fade (X-1) must cover the visible end edge of a scroll region, and only a fade's
 * width of it, wherever the region is scrolled: a cue placed in the scrolled content would drift
 * away with the columns. The pseudo-element is decorative and pointer-transparent, so for this
 * probe alone it is made hit-testable; a hit on the fade returns the region itself.
 */
async function expectFadeAtVisibleEnd(region: Locator, message: string): Promise<void> {
  const hits = await region.evaluate((element) => {
    // Hit testing only reaches points inside the viewport; this moves the page, never the region.
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    const probe = new CSSStyleSheet();
    probe.replaceSync('[data-overflow="true"][data-overflow-end="false"]::after { pointer-events: auto !important; }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, probe];
    try {
      const bounds = element.getBoundingClientRect();
      const fadeWidth = Number.parseFloat(getComputedStyle(element, '::after').width);
      const visibleEnd = bounds.left + element.clientLeft + element.clientWidth;
      const y = bounds.top + element.clientTop + element.clientHeight / 2;
      const onFade = document.elementFromPoint(visibleEnd - fadeWidth / 2, y);
      const beforeFade = document.elementFromPoint(visibleEnd - fadeWidth - 4, y);
      return {
        onFade: onFade === element,
        onFadeHit: onFade?.tagName ?? 'nothing',
        beforeFade: beforeFade !== null && beforeFade !== element,
        beforeFadeHit: beforeFade?.tagName ?? 'nothing',
      };
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== probe);
    }
  });
  expect(hits.onFade, `the fade covers the visible end edge ${message} (hit ${hits.onFadeHit})`).toBe(true);
  expect(hits.beforeFade, `the fade covers only its own width ${message} (hit ${hits.beforeFadeHit})`).toBe(true);
}

/** The figure a KPI tile shows, read from its display value. */
async function tileValue(tile: Locator): Promise<number> {
  const text = await tile.locator('[data-slot="kpi-tile-value"]').textContent();
  const value = Number.parseInt((text ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the tile shows a whole number, not "${text}"`).toBe(true);
  return value;
}

/** The authoritative result total a list shows beside its table ("12 results"). */
async function displayedResultTotal(page: Page): Promise<number> {
  const label = await page.getByText(/^[\d,]+ results?$/).textContent();
  const total = Number.parseInt((label ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(total), `the list shows a numeric result total, not "${label}"`).toBe(true);
  return total;
}

/** The figure a labelled bar row shows beside its label. */
async function barValue(row: Locator): Promise<number> {
  const text = await row.locator('[data-slot="bar-chart-value"]').textContent();
  const value = Number.parseInt((text ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the bar row shows a whole number, not "${text}"`).toBe(true);
  return value;
}

/** The figure a Review queue row names: "{label}: {n} {record noun}". */
async function queueRowValue(row: Locator): Promise<number> {
  const name = (await row.getAttribute('aria-label')) ?? '';
  const value = Number.parseInt((/: ([\d,]+) /.exec(name)?.[1] ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the queue row names a whole number, not "${name}"`).toBe(true);
  return value;
}

const dashboardWidgets = [
  'Review queue',
  'Risk exposure',
  'High and Critical residual Risks',
  'Treatments due',
  'Upcoming due dates',
  'Top alerts',
  'Recent activity',
] as const;

/** The desktop row whose record link is `identifier`, paging forward through the list if needed. */
async function findAlertRow(page: Page, identifier: string): Promise<Locator> {
  const table = page.getByRole('table', { name: 'Alerts' });
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    await expect(page.getByText(new RegExp(`^Page ${pageNumber} of \\d+$`)), `ALERTS_PAGE_${pageNumber}_RENDERED`).toBeVisible();
    await expect(table, `ALERTS_TABLE_VISIBLE_ON_PAGE_${pageNumber}`).toBeVisible();
    const row = table.getByRole('row').filter({ has: page.getByRole('link', { name: identifier, exact: true }) });
    if (await row.count() > 0) return row.first();
    const next = page.getByRole('button', { name: 'Next page' });
    if (await next.isDisabled()) break;
    await next.click();
  }
  throw new Error(`ALERT_FIXTURE_ROW_MISSING:${identifier}`);
}

test('analyst alerts show the Phase 7 fixture conditions with actor-correct source links', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  // The analyst reaches Alerts from the Reports navigation group.
  const reportsGroup = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('group', { name: 'Reports' });
  await reportsGroup.getByRole('link', { name: 'Alerts', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Alerts' })).toBeVisible();
  await expect(page).toHaveTitle('Alerts | IdamBox CSRM');
  await expect(reportsGroup.getByRole('link', { name: 'Alerts', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.goto('/app/alerts?kind=risk-treatment-overdue&pageSize=50');
  await expect(page.getByRole('combobox', { name: 'Filter by alert type' })).toHaveValue('risk-treatment-overdue');
  const overdueRow = await findAlertRow(page, fixture.risks.overdue);
  await expect(overdueRow.locator('[data-slot="badge"][data-urgency="overdue"]'), 'the urgency reads Overdue').toHaveText('Urgency: Overdue');
  await expect(overdueRow.getByText(/^Treatment overdue by \d+ days$/)).toBeVisible();
  // D-11: the Risk's own residual rating sits beside the urgency, never merged into it.
  await expect(overdueRow.getByLabel('Severity: high (3 of 4)')).toBeVisible();
  await expect(overdueRow.getByText('Target date', { exact: true })).toBeVisible();
  expect(await overdueRow.getByRole('link', { name: fixture.risks.overdue, exact: true }).getAttribute('href')).toMatch(/^\/app\/risks\/[^/#]+$/);
  await expect(overdueRow.getByText('Released · read-only', { exact: true })).toHaveCount(0);

  // D-27: an alert on released work says so.
  const releasedRow = await findAlertRow(page, fixture.risks.released);
  await expect(releasedRow.getByText('Released · read-only', { exact: true })).toBeVisible();
  await expect(releasedRow.getByLabel('Severity: critical (4 of 4)')).toBeVisible();

  // A Control Implementation alert opens its Risk at Mitigation controls, below the sticky header.
  await page.goto('/app/alerts?kind=control-implementation-overdue&pageSize=50');
  const controlRow = await findAlertRow(page, fixture.risks.overdue);
  await expect(controlRow.getByText(/^Control Implementation overdue by \d+ days$/)).toBeVisible();
  await expect(controlRow.getByText(/^Control Implementation · /)).toBeVisible();
  const controlLink = controlRow.getByRole('link', { name: fixture.risks.overdue, exact: true });
  expect(await controlLink.getAttribute('href')).toMatch(/^\/app\/risks\/[^/#]+#mitigation-controls$/);
  await controlLink.click();
  await expect(page).toHaveURL(/\/app\/risks\/[^/#]+#mitigation-controls$/);
  const mitigationHeading = page.getByRole('heading', { level: 2, name: 'Mitigation controls' });
  await expect(mitigationHeading).toBeVisible();
  await expect(mitigationHeading, 'the deep link lands on the Mitigation controls section').toBeInViewport();
  await expect.poll(async () => {
    const [heading, header] = await Promise.all([mitigationHeading.boundingBox(), page.getByRole('banner').boundingBox()]);
    return heading && header ? heading.y - (header.y + header.height) : Number.NEGATIVE_INFINITY;
  }, { message: 'the Mitigation controls heading is not hidden under the sticky header' }).toBeGreaterThanOrEqual(-1);

  // The urgency filter replaces the URL, shows its chip, and Clear filters removes it.
  await page.goto('/app/alerts');
  await page.getByRole('combobox', { name: 'Filter by urgency' }).selectOption({ label: 'Due soon' });
  await expect(page).toHaveURL(/[?&]urgency=due-soon(&|$)/);
  const urgencyChipRemove = page.getByRole('button', { name: 'Remove Urgency filter' });
  await expect(urgencyChipRemove).toBeVisible();
  await expect(page.locator('span', { has: urgencyChipRemove })).toHaveText('Urgency: Due soon');
  await expect(page.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('due-soon');
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/urgency=/);
  await expect(urgencyChipRemove).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('');

  // An impossible pair is a filtered empty state, never a dead end.
  await page.goto('/app/alerts?kind=request-overdue&urgency=attention');
  await expect(page.getByRole('heading', { name: 'No alerts match these filters' })).toBeVisible();
  await expect(page.locator('[data-slot="state"][data-state-kind="empty"]').getByRole('button', { name: 'Clear filters' })).toBeVisible();

  // Both widths: no horizontal page overflow, cards below md and the table from md.
  await page.goto('/app/alerts?kind=risk-treatment-overdue&pageSize=50');
  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    const mobile = page.locator('[data-slot="data-table-mobile"]');
    const desktop = page.locator('[data-slot="data-table-desktop"]');
    if (width === 375) {
      await expect(mobile, 'the list renders cards at 375px').toBeVisible();
      await expect(desktop).toBeHidden();
      const card = mobile.getByRole('listitem').filter({ has: page.getByRole('link', { name: fixture.risks.overdue, exact: true }) }).first();
      await expect(card.locator('[data-slot="alert-row"]')).toBeVisible();
      await expect(card.locator('[data-slot="badge"][data-urgency="overdue"]')).toHaveText('Urgency: Overdue');
    } else {
      await expect(desktop, 'the list renders a table at 1440px').toBeVisible();
      await expect(mobile).toBeHidden();
    }
    await expectNoHorizontalOverflow(page, `Alerts has no horizontal overflow at ${width}px`);
  }
});

test('the navigation sheet scrolls at 375×667 so every analyst item and the role switcher are reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await signIn(page, 'Security Analyst');

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Navigation' });
  await expect(sheet).toBeVisible();
  // The analyst's sheet is taller than the viewport, so the sheet itself must scroll.
  expect(await sheet.evaluate((element) => element.scrollHeight > element.clientHeight), 'the sheet overflows 667px and scrolls').toBe(true);
  await expect(sheet.getByRole('group', { name: 'Reports' }).getByRole('link', { name: 'Alerts', exact: true })).toBeVisible();

  const lastAdministrationLink = sheet.getByRole('group', { name: 'Administration' }).getByRole('link').last();
  await lastAdministrationLink.scrollIntoViewIfNeeded();
  await expect(lastAdministrationLink).toBeVisible();
  await expect(lastAdministrationLink).toBeInViewport();

  const roleSwitcher = sheet.getByRole('combobox', { name: 'Development role' });
  await roleSwitcher.scrollIntoViewIfNeeded();
  await expect(roleSwitcher).toBeVisible();
  await expect(roleSwitcher).toBeInViewport();
  await roleSwitcher.focus();
  await expect(roleSwitcher).toBeFocused();
});

/*
 * The index and the report tiles. Opening each report and reading its text equivalents is part of
 * the cross-screen analyst journey below, so it is not repeated here.
 */
test('analyst reaches the report index from Reports navigation, and report tiles equal the lists they open', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  // The analyst reaches the index from the Reports navigation group, after Alerts.
  const reportsGroup = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('group', { name: 'Reports' });
  await expect(reportsGroup.getByRole('link')).toHaveText(['Alerts', 'Reports']);
  await reportsGroup.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Reports | IdamBox CSRM');
  await expect(reportsGroup.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute('aria-current', 'page');
  const index = page.getByRole('list', { name: 'Reports' });
  await expect(index.getByRole('listitem')).toHaveCount(reports.length);
  for (const report of reports) {
    await expect(index.getByRole('link', { name: report.title, exact: true }), `${report.key} card`).toHaveAttribute('href', `/app/reports/${report.key}`);
  }

  // Risk exposure: the Critical residual tile equals the open, Critical-residual Risk Register list.
  await page.goto('/app/reports/risk-exposure');
  const criticalTile = page.getByRole('region', { name: 'Summary', exact: true }).getByRole('link', { name: /^Critical residual [\d,]+$/ });
  const criticalResidual = await tileValue(criticalTile);
  await criticalTile.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]residualRating=Critical(&|$)/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page.getByRole('heading', { name: 'Risk Register' })).toBeVisible();
  expect(await displayedResultTotal(page), 'the Critical residual tile equals its Risk Register list').toBe(criticalResidual);

  // Treatment performance: the most overdue list opens the overdue alerts, and the Overdue tile equals
  // that alert list. The journey below proves a Phase 7 fixture row is among the most overdue.
  await page.goto('/app/reports/treatment-performance');
  const mostOverdue = page.getByRole('region', { name: 'Most overdue treatments', exact: true });
  await expect(mostOverdue.getByRole('link', { name: 'View overdue treatments' })).toHaveAttribute('href', '/app/alerts?kind=risk-treatment-overdue');
  const overdueTile = page.getByRole('region', { name: 'Summary', exact: true }).getByRole('link', { name: /^Overdue [\d,]+$/ });
  const overdue = await tileValue(overdueTile);
  await overdueTile.click();
  await expect(page).toHaveURL(/\/app\/alerts\?kind=risk-treatment-overdue/);
  await expect(page.getByRole('combobox', { name: 'Filter by alert type' })).toHaveValue('risk-treatment-overdue');
  expect(await displayedResultTotal(page), 'the Overdue tile equals its alert list').toBe(overdue);

  // Assessment throughput: the keyboard switches to twelve months through the URL, and focus stays put.
  await page.goto('/app/reports/assessment-throughput');
  const period = page.getByRole('radiogroup', { name: 'Period' });
  const sixMonths = period.getByRole('radio', { name: '6 months' });
  const twelveMonths = period.getByRole('radio', { name: '12 months' });
  const monthTable = page.getByRole('table', { name: 'Released per month', exact: true });
  await expect(sixMonths).toBeChecked();
  await expect(monthTable.locator('tbody tr')).toHaveCount(6);
  await sixMonths.focus();
  // A physical key is still down when roving focus moves, and that move is what checks the radio.
  await page.keyboard.down('ArrowRight');
  await expect(twelveMonths).toBeFocused();
  await page.keyboard.up('ArrowRight');
  await expect(page).toHaveURL(/[?&]period=12(&|$)/);
  await expect(twelveMonths).toBeChecked();
  await expect(monthTable.locator('tbody tr')).toHaveCount(12);
  await expect(monthTable.locator('tbody tr').last().getByRole('rowheader')).toHaveText(/\(to date\)$/);
  await expect(twelveMonths, 'focus stays on the checked segment').toBeFocused();
  await expect(page.locator('[data-slot="report-body"]')).not.toHaveAttribute('aria-busy', 'true');
});

test('analyst sees Report not found for an unknown key', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/not-a-report');
  await expect(page.getByRole('heading', { level: 1, name: 'Report not found' })).toBeVisible();
  await expect(page.getByText('Choose a report from the Reports list.')).toBeVisible();
  const viewReports = page.getByRole('link', { name: 'View reports' });
  await expect(viewReports).toHaveAttribute('href', '/app/reports');
  await viewReports.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Reports' }).getByRole('listitem')).toHaveCount(reports.length);
});

test('reports fit 375 to 1440 without page scroll: the cross-tab scrolls in its own region and the Period control keeps its labels', async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, 'Security Analyst');

  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });

    await page.goto('/app/reports');
    await expect(page.getByRole('list', { name: 'Reports' }).getByRole('listitem')).toHaveCount(reports.length);
    await expectNoHorizontalOverflow(page, `the report index has no horizontal overflow at ${width}px`);

    await page.goto('/app/reports/risk-exposure');
    await expect(page.getByRole('table', { name: 'Inherent and residual rating', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, `risk exposure has no horizontal overflow at ${width}px`);

    if (width === 375) {
      const crossTab = page.getByRole('region', { name: 'Residual rating by treatment status, scrolls horizontally' });
      await expect(crossTab).toHaveAttribute('tabindex', '0');
      expect(await crossTab.evaluate((element) => element.scrollWidth > element.clientWidth), 'the cross-tab is wider than its region at 375px').toBe(true);
      // Columns hidden beyond the end edge are cued by a fade of the token's width (X-1).
      await expect(crossTab).toHaveAttribute('data-overflow', 'true');
      await expect(crossTab).toHaveAttribute('data-overflow-end', 'false');
      const fade = await crossTab.evaluate((element) => {
        const probe = document.createElement('div');
        probe.style.width = getComputedStyle(document.documentElement).getPropertyValue('--table-scroll-fade-width');
        document.body.append(probe);
        const tokenWidth = `${probe.getBoundingClientRect().width}px`;
        probe.remove();
        const after = getComputedStyle(element, '::after');
        return { content: after.content, width: after.width, tokenWidth, transition: after.transitionDuration };
      });
      expect(fade.content, 'the end-edge fade is drawn while columns are hidden').not.toBe('none');
      expect(fade.width, 'the end-edge fade is --table-scroll-fade-width wide').toBe(fade.tokenWidth);
      expect(fade.transition, 'the fade has no transition').toBe('0s');
      await expectFadeAtVisibleEnd(crossTab, 'before the cross-tab scrolls');
      await crossTab.focus();
      await expect(crossTab).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => crossTab.evaluate((element) => element.scrollLeft), { message: 'the region scrolls from the keyboard' }).toBeGreaterThan(0);
      // Part-way through the scroll the fade is still at the visible end edge, not carried off with the columns.
      await crossTab.evaluate((element) => { element.scrollLeft = Math.floor((element.scrollWidth - element.clientWidth) / 2); });
      await expect(crossTab).toHaveAttribute('data-overflow-end', 'false');
      await expectFadeAtVisibleEnd(crossTab, 'part-way through the scroll');
      // The rating column stays put while the counts scroll beneath it.
      const regionBox = await crossTab.boundingBox();
      const critical = crossTab.getByRole('rowheader', { name: 'Critical', exact: true });
      await expect.poll(async () => ((await critical.boundingBox())?.x ?? Number.POSITIVE_INFINITY) - (regionBox?.x ?? 0), { message: 'the first column is sticky' }).toBeLessThanOrEqual(1);
      // At the end of the scroll no column is hidden, so the cue goes.
      await crossTab.evaluate((element) => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
      await expect(crossTab, 'the cross-tab reports the end of its scroll').toHaveAttribute('data-overflow-end', 'true');
      expect(await crossTab.evaluate((element) => getComputedStyle(element, '::after').content), 'no fade once nothing is hidden').toBe('none');
      await expectNoHorizontalOverflow(page, 'scrolling the cross-tab never scrolls the page');
    } else {
      // Where the cross-tab fits it is no region and no tab stop; data-overflow follows the measured width.
      const scroller = page.locator('[data-slot="report-table-scroll"]');
      const overflows = await scroller.evaluate((element) => element.scrollWidth > element.clientWidth);
      await expect(scroller, `the cross-tab's data-overflow follows its width at ${width}px`).toHaveAttribute('data-overflow', String(overflows));
      await expect(page.getByRole('region', { name: 'Residual rating by treatment status, scrolls horizontally' })).toHaveCount(overflows ? 1 : 0);
    }
  }

  // Between md and lg the header sets the Period control beside the title; it must never be squeezed.
  for (const width of [768, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/reports/assessment-throughput');
    const period = page.getByRole('radiogroup', { name: 'Period' });
    await expect(period.getByRole('radio')).toHaveCount(2);
    for (const segment of await period.getByRole('radio').all()) {
      const label = await segment.textContent();
      expect(await segment.evaluate((element) => element.scrollWidth <= element.clientWidth), `the ${label} segment shows its whole label at ${width}px`).toBe(true);
    }
    await expectNoHorizontalOverflow(page, `assessment throughput has no horizontal overflow at ${width}px`);
  }
});

test('analyst dashboard shows what needs attention and every tile equals the list it opens', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  // The analyst reaches the dashboard from its item, directly above the review queues it heads.
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const dashboardItem = navigation.getByRole('link', { name: 'Analyst dashboard', exact: true });
  await dashboardItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Analyst dashboard' })).toBeVisible();
  await expect(page).toHaveTitle('Analyst Dashboard | IdamBox CSRM');
  await expect(dashboardItem).toHaveAttribute('aria-current', 'page');
  await expect(navigation.locator('[aria-current="page"]'), 'exactly one navigation item is current').toHaveCount(1);

  // Needs action first: four tiles, then the seven widgets in reading order.
  const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
  await expect(needsAction.locator('[data-slot="kpi-tile"]'), 'the four Needs action tiles').toHaveCount(4);
  await expect(page.locator('[data-state-kind="error"]'), 'no unit failed').toHaveCount(0);
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Needs action', ...dashboardWidgets]);

  // Requires my attention equals the default review queue it opens.
  const requiresAttentionTile = needsAction.getByRole('link', { name: /^Requires my attention [\d,]+ / });
  const requiresAttention = await tileValue(requiresAttentionTile);
  await requiresAttentionTile.click();
  await expect(page).toHaveURL(/\/app\/review\/requests(\?|$)/);
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  await expect(navigation.getByRole('link', { name: 'Assessment Requests', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(dashboardItem, 'the dashboard item is not current on a review queue').not.toHaveAttribute('aria-current', 'page');
  expect(await displayedResultTotal(page), 'the Requires my attention tile equals the review queue').toBe(requiresAttention);

  // Overdue equals the overdue alert list.
  await page.goto('/app/review');
  const overdueTile = needsAction.getByRole('link', { name: /^Overdue [\d,]+ / });
  const overdue = await tileValue(overdueTile);
  expect(overdue, 'the Phase 7 fixture holds overdue work').toBeGreaterThan(0);
  await overdueTile.click();
  await expect(page).toHaveURL(/\/app\/alerts\?/);
  await expect(page).toHaveURL(/[?&]urgency=overdue(&|$)/);
  await expect(page.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('overdue');
  expect(await displayedResultTotal(page), 'the Overdue tile equals its alert list').toBe(overdue);

  // The Critical exposure row equals the open, Critical-residual Risk Register list.
  await page.goto('/app/review');
  const criticalRow = page.getByRole('region', { name: 'Risk exposure', exact: true }).getByRole('link', { name: /^Critical: [\d,]+ open Risks? by residual rating$/ });
  const critical = await barValue(criticalRow);
  await criticalRow.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]residualRating=Critical(&|$)/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page.getByRole('heading', { name: 'Risk Register' })).toBeVisible();
  expect(await displayedResultTotal(page), 'the Critical exposure row equals its Risk Register list').toBe(critical);

  // Answers stay submitted after the Risk Assessment is drafted and released, so the Questionnaires row
  // counts finished work too. It reads Submitted, never waiting work, and equals the list it opens.
  await page.goto('/app/review');
  const reviewQueue = page.getByRole('region', { name: 'Review queue', exact: true });
  await expect(reviewQueue.getByText(/ready for review|work waiting/i), 'no queue copy calls submitted Questionnaires waiting work').toHaveCount(0);
  const submittedRow = reviewQueue.getByRole('link', { name: /^Submitted: [\d,]+ Questionnaires?$/ });
  const submitted = await queueRowValue(submittedRow);
  await submittedRow.click();
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\?(.*&)?status=submitted(&|$)/);
  await expect(page.getByRole('heading', { name: 'Questionnaire Review' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('submitted');
  expect(await displayedResultTotal(page), 'the Submitted row equals the submitted Questionnaire list').toBe(submitted);

  // Every High and Critical row's Risk is in the open register it links to. Membership only: that
  // list holds every open Risk, High and Critical first (the register has no multi-rating filter).
  await page.goto('/app/review');
  const highCritical = page.getByRole('region', { name: 'High and Critical residual Risks', exact: true });
  const highCriticalLinks = highCritical.locator('a.record-link');
  // A production build reveals a streamed widget after the document's load event, so the list is
  // awaited with a retrying assertion rather than read once straight after the navigation.
  await expect(highCriticalLinks, 'the widget lists High and Critical residual Risks').not.toHaveCount(0);
  const identifiers = await highCriticalLinks.allTextContents();
  expect(identifiers.some((identifier) => identifier.startsWith('RSK-E2E-P7-')), 'a Phase 7 fixture Risk is listed').toBe(true);
  expect(identifiers, 'a closed Risk never counts as exposure').not.toContain(fixture.risks.closed);
  await highCritical.getByRole('link', { name: 'Open Risk Register' }).click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page).toHaveURL(/[?&]sort=residualRating(:|%3A)desc(&|$)/);
  const register = page.getByRole('table', { name: 'Risk Register results' });
  await expect(register).toBeVisible();
  for (const identifier of identifiers) {
    await expect(register.getByRole('link', { name: identifier, exact: true }), `${identifier} is in the open register`).toBeVisible();
  }

  // Top alerts lists a fixture Risk; Recent activity names the Security Analyst who released a Risk Assessment.
  await page.goto('/app/review');
  const topAlerts = page.getByRole('region', { name: 'Top alerts', exact: true });
  await expect(topAlerts.locator('[data-slot="alert-row"]').first()).toBeVisible();
  await expect(topAlerts.getByRole('link', { name: /^RSK-E2E-P7-/ }).first(), 'a Phase 7 fixture Risk is among the top alerts').toBeVisible();
  const activity = page.getByRole('region', { name: 'Recent activity', exact: true });
  const released = activity.getByRole('listitem').filter({ has: page.getByRole('link', { name: fixture.assessments.released, exact: true }) }).filter({ hasText: /released by / });
  await expect(released.first(), 'the fixture release names who released it').toBeVisible();
  await expect(released.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  // A generated draft is advisory: its event phrase names no one and never says released or approved.
  // Scoped to the phrase, because a row's secondary line carries the record's own title.
  const generatedPhrases = activity.getByText(/draft generated for Security Analyst review/);
  await expect(generatedPhrases.first(), 'a generated draft is in the feed').toBeVisible();
  for (const phrase of await generatedPhrases.all()) {
    await expect(phrase).toHaveText('draft generated for Security Analyst review');
  }

  for (const width of [375, 1440] as const) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await expect(needsAction.locator('[data-slot="kpi-tile"]')).toHaveCount(4);
    await expectNoHorizontalOverflow(page, `the analyst dashboard has no horizontal overflow at ${width}px`);
    // An identifier is one token: the badge and date beside it wrap before the identifier ever breaks.
    for (const link of await highCritical.locator('a.record-link').all()) {
      const lines = await link.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
      });
      expect(lines, `${await link.textContent()} sits on one line at ${width}px`).toBe(1);
    }
  }
});

test('the Top alerts widget fails independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/review?__e2eState=populated&__e2ePartial=analyst-top-alerts-error');
  await expect(page.locator('[data-ui-state="populated"]')).toBeVisible();
  const topAlerts = page.getByRole('region', { name: 'Top alerts', exact: true });
  await expect(topAlerts.getByRole('heading', { level: 2, name: 'Top alerts' }), 'the failed widget keeps its heading').toBeVisible();
  await expect(topAlerts.getByRole('alert')).toHaveCount(1);
  await expect(topAlerts.getByRole('alert')).toContainText('We couldn’t load alerts');
  await expect(topAlerts.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(topAlerts.getByRole('link'), 'the failed widget exposes no record link').toHaveCount(0);
  // Every sibling still renders its own figures.
  await expect(page.getByRole('main').getByRole('alert'), 'only Top alerts failed').toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Needs action', exact: true }).locator('[data-slot="kpi-tile"]')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Review queue', exact: true }).getByRole('link')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Risk exposure', exact: true }).getByRole('list', { name: 'Open contextual Risks by residual rating' })).toBeVisible();
});

/*
 * D-25: the phase's promise in one browser journey. The analyst goes from the dashboard to an alert,
 * and from the alert to its source record through the analyst route. They open a tile's list and
 * find the tile's own figure as its total, then open every report and read its text equivalents.
 * Each check is fixture membership or an equality read inside this test, never a global total.
 */
test('a Security Analyst goes from the dashboard to an alert to its source record, and from a tile to its equal list', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const dashboardItem = navigation.getByRole('link', { name: 'Analyst dashboard', exact: true });

  // The dashboard, then every alert through the Top alerts footer.
  await dashboardItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Analyst dashboard' })).toBeVisible();
  const topAlerts = page.getByRole('region', { name: 'Top alerts', exact: true });
  await expect(topAlerts.locator('[data-slot="alert-row"]').first(), 'Top alerts lists the most urgent alerts').toBeVisible();
  await topAlerts.getByRole('link', { name: 'View all alerts', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/alerts$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Alerts' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Alerts' }), 'every alert is listed').toBeVisible();

  // An alert opens its source record: filter to overdue treatments, then open the fixture Risk.
  await page.getByRole('combobox', { name: 'Filter by alert type' }).selectOption({ label: 'Treatment overdue' });
  await expect(page).toHaveURL(/[?&]kind=risk-treatment-overdue(&|$)/);
  // The chip is rendered from the server's reading of the new URL, so the rows beside it are the filtered list.
  await expect(page.getByRole('button', { name: 'Remove Alert type filter' })).toBeVisible();
  const overdueRow = await findAlertRow(page, fixture.risks.overdue);
  await expect(overdueRow.getByText(/^Treatment overdue by \d+ days$/), 'the row is the treatment alert, not its Control Implementation').toBeVisible();
  const sourceLink = overdueRow.getByRole('link', { name: fixture.risks.overdue, exact: true });
  const sourceHref = (await sourceLink.getAttribute('href')) ?? '';
  expect(sourceHref, 'the alert links to the analyst Risk route').toMatch(/^\/app\/risks\/[^/?#]+$/);
  await sourceLink.click();
  await expect.poll(() => new URL(page.url()).pathname, { message: 'the analyst lands on the Risk the alert names' }).toBe(sourceHref);
  await expect(page.getByRole('heading', { level: 1, name: fixture.risks.overdue, exact: true }), 'the Risk detail shows the alert’s Risk').toBeVisible();

  // A tile opens a list whose total is the tile's own figure: Needs attention.
  await dashboardItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Analyst dashboard' })).toBeVisible();
  const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
  await expect(needsAction.locator('[data-slot="kpi-tile"]'), 'the four Needs action tiles').toHaveCount(4);
  await expect(page.locator('[data-state-kind="error"]'), 'no dashboard unit failed').toHaveCount(0);
  const attentionTile = needsAction.getByRole('link', { name: /^Needs attention [\d,]+ / });
  const attention = await tileValue(attentionTile);
  expect(attention, 'the Phase 7 fixture holds alerts that need attention').toBeGreaterThan(0);
  await attentionTile.click();
  await expect(page).toHaveURL(/\/app\/alerts\?/);
  await expect(page).toHaveURL(/[?&]urgency=attention(&|$)/);
  await expect(page.getByRole('button', { name: 'Remove Urgency filter' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('attention');
  expect(await displayedResultTotal(page), 'the Needs attention tile equals its alert list').toBe(attention);
  // Membership, never a total: the fixture's untreated Critical Risk is on that list.
  const criticalRow = await findAlertRow(page, fixture.risks.critical);
  await expect(criticalRow.locator('[data-slot="badge"][data-urgency="attention"]'), 'the fixture row needs attention').toHaveText('Urgency: Needs attention');

  // Every report opens with its text equivalents, from Reports navigation and back through the breadcrumb.
  await navigation.getByRole('group', { name: 'Reports' }).getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports', exact: true })).toBeVisible();
  const index = page.getByRole('list', { name: 'Reports' });
  await expect(index.getByRole('listitem')).toHaveCount(reports.length);
  for (const report of reports) {
    await index.getByRole('link', { name: report.title, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: report.title, exact: true }), `${report.key} heading`).toBeVisible();
    await expect(page).toHaveTitle(report.documentTitle);
    await expect(page.getByText(/^Computed from current records as at \d{1,2} [A-Z][a-z]{2,4} \d{4}\.$/), `${report.key} as-at line`).toBeVisible();
    await expect(page.getByRole('region', { name: 'Summary', exact: true }).getByRole('listitem'), `${report.key} KPI strip`).toHaveCount(report.tiles);
    await expect(page.locator('[data-state-kind="error"]'), `${report.key} renders no error state`).toHaveCount(0);
    await expect(page.locator('[data-slot="report-section"]'), `${report.key} renders every section`).toHaveCount(report.tableSections.length + report.alertSections.length);
    for (const name of report.tableSections) {
      const section = page.getByRole('region', { name, exact: true });
      await expect(section.getByRole('table', { name, exact: true }), `${report.key} · ${name} has a visible table`).toBeVisible();
    }
    for (const name of report.alertSections) {
      const section = page.getByRole('region', { name, exact: true });
      await expect(section.locator('[data-slot="alert-row"]').first(), `${report.key} · ${name} lists alert rows`).toBeVisible();
      await expect(section.getByRole('link', { name: /^RSK-E2E-P7-/ }).first(), `${report.key} · ${name} lists a Phase 7 fixture Risk`).toBeVisible();
    }
    const breadcrumbReports = page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link', { name: 'Reports', exact: true });
    await expect(breadcrumbReports).toHaveAttribute('href', '/app/reports');
    await breadcrumbReports.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Reports', exact: true })).toBeVisible();
    await expect(index.getByRole('listitem')).toHaveCount(reports.length);
  }
});

/*
 * D-16, D-25 and UI-SPEC §6.3: neither Requestor identity sees analyst navigation, and every Phase 7
 * URL refuses them with its page header and the permission state alone. Each URL is also requested
 * with the guarded populated fixture, because a fixture that resolved before authorisation would
 * render a boundary around the real screen.
 */
test('Requestor and Secondary Requestor see no analyst navigation and are refused every Phase 7 route', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const role of ['Requestor', 'Secondary Requestor'] as const) {
    await signIn(page, role);
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(navigation.getByRole('link', { name: 'Workspace', exact: true }), `${role} navigation rendered`).toBeVisible();
    for (const item of ['Analyst dashboard', 'Alerts', 'Reports'] as const) {
      await expect(navigation.getByRole('link', { name: item, exact: true }), `${role} has no ${item} link`).toHaveCount(0);
    }
    await expect(navigation.getByRole('group', { name: 'Reports' }), `${role} has no Reports group`).toHaveCount(0);

    for (const route of phase7Routes) {
      for (const url of [route.url, `${route.url}?__e2eState=populated`]) {
        await page.goto(url);
        const main = page.getByRole('main');
        await expect(page.getByRole('heading', { level: 1, name: route.heading, exact: true }), `${role} ${url} keeps its page header`).toBeVisible();
        const alert = main.getByRole('alert');
        await expect(alert, `${role} ${url} shows exactly one alert`).toHaveCount(1);
        await expect(alert.getByRole('heading', { name: route.permission, exact: true }), `${role} is refused ${url}`).toBeVisible();
        await expect(alert.getByRole('link', { name: 'Return to workspace', exact: true })).toHaveAttribute('href', '/app');
        // One title for a real and an invented report key, so nothing tells them apart.
        await expect(page, `${role} ${url} title`).toHaveTitle(route.documentTitle);
        // No table, count, record link, filter, tile, widget, section, breadcrumb or fixture boundary.
        await expect(page.getByRole('table'), `${role} sees no table on ${url}`).toHaveCount(0);
        await expect(main.getByText(/^[\d,]+ results?$/), `${role} sees no result count on ${url}`).toHaveCount(0);
        await expect(
          page.locator('a[href^="/app/risks/"], a[href^="/app/review/requests/"], a[href^="/app/review/assessments/"]'),
          `${role} sees no analyst record link on ${url}`,
        ).toHaveCount(0);
        await expect(page.getByRole('combobox', { name: /^Filter by / }), `${role} sees no filter on ${url}`).toHaveCount(0);
        await expect(
          page.locator('[data-slot="kpi-tile"], [data-slot="dashboard-widget"], [data-slot="report-section"]'),
          `${role} sees no tile, widget or report section on ${url}`,
        ).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: 'breadcrumb' }), `${role} sees no breadcrumb on ${url}`).toHaveCount(0);
        await expect(page.getByText('Risk exposure', { exact: true }), `${role} sees no report or widget title on ${url}`).toHaveCount(0);
        await expect(page.locator('[data-ui-state]'), `${role} sees no fixture boundary on ${url}`).toHaveCount(0);
      }
    }
  }
});
