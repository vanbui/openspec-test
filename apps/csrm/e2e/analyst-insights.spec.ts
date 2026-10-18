import { expect, test, type Locator, type Page } from '@playwright/test';

import { createSubmittedRequest } from './helpers/requests';

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
    /** D-45: the one released, open Risk whose treatment action is Accept, rated Moderate. */
    accepted: 'RSK-E2E-P7-ACCEPTED-001',
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
 * The four reports as the copy map and the served definitions name them. Together `tableSections`,
 * `alertSections` and `coverageSections` are every section a report renders. A table section's table
 * is the text equivalent of its chart (or, for the cross-tab, the section itself); an alert section
 * lists shared alert rows, so it is proved by a Phase 7 fixture row instead of a table. A coverage
 * section ranks records that may not exist: the most exposed Information Systems count released
 * High and Critical Risks only (D-42), and the seed's one released Critical Risk impacts no system,
 * so the section shows either its table or its coverage note.
 */
const reports = [
  {
    key: 'risk-exposure',
    title: 'Risk exposure',
    documentTitle: 'Risk Exposure Report | IdamBox CSRM',
    tiles: 5,
    tableSections: ['Inherent and residual rating', 'Residual rating by treatment status', 'Under assessment'],
    alertSections: [],
    coverageSections: ['Most exposed Information Systems'],
  },
  {
    key: 'treatment-performance',
    title: 'Treatment performance',
    documentTitle: 'Treatment Performance Report | IdamBox CSRM',
    tiles: 3,
    tableSections: ['Due state', 'Treatment status'],
    alertSections: ['Most overdue treatments'],
    coverageSections: [],
  },
  {
    key: 'assessment-throughput',
    title: 'Assessment throughput',
    documentTitle: 'Assessment Throughput Report | IdamBox CSRM',
    tiles: 2,
    tableSections: ['Released per month', 'Assessment Requests by lifecycle state'],
    alertSections: [],
    coverageSections: [],
  },
  {
    key: 'control-effectiveness',
    title: 'Control effectiveness',
    documentTitle: 'Control Effectiveness Report | IdamBox CSRM',
    tiles: 2,
    tableSections: ['Implementation status', 'Effectiveness rating'],
    alertSections: [],
    coverageSections: [],
  },
] as const;

/*
 * Every Phase 7 URL a Requestor might type, with the header, the UI-SPEC §7.5 permission heading and
 * the document title each keeps when it refuses them. An invented report key is refused exactly as a
 * real one is, so nothing tells the two apart (UI-SPEC §6.3).
 */
const phase7Routes = [
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

/* The analyst Home's widgets after Needs action, in D-18 order, ending with Your own requests (UI-SPEC §5.3, E6). */
const dashboardWidgets = [
  'Review queue',
  'Treatments due',
  'Upcoming due dates',
  'Top alerts',
  'Risk exposure',
  'High and Critical residual Risks',
  'Recent activity',
  'Your own requests',
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

  // The analyst reaches Alerts from the Oversight navigation section.
  const oversight = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('group', { name: 'Oversight' });
  await oversight.getByRole('link', { name: /^Alerts\b/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Alerts' })).toBeVisible();
  await expect(page).toHaveTitle('Alerts | IdamBox CSRM');
  await expect(oversight.getByRole('link', { name: /^Alerts\b/ })).toHaveAttribute('aria-current', 'page');

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
  await expect(sheet.getByRole('group', { name: 'Oversight' }).getByRole('link', { name: /^Alerts\b/ })).toBeVisible();

  const lastReferenceDataLink = sheet.getByRole('group', { name: 'Reference data' }).getByRole('link').last();
  await lastReferenceDataLink.scrollIntoViewIfNeeded();
  await expect(lastReferenceDataLink).toBeVisible();
  await expect(lastReferenceDataLink).toBeInViewport();

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

  // The analyst reaches the index from the Oversight navigation section: Risk register, Alerts, then Reports.
  const oversight = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('group', { name: 'Oversight' });
  // Alerts carries the overdue count in its text and name when alerts are overdue (D-10), so it is anchored.
  await expect(oversight.getByRole('link')).toHaveText(['Risk register', /^Alerts(, [\d,]+ overdue)?$/, 'Reports']);
  for (const name of ['Risk register', /^Alerts\b/, 'Reports'] as const) {
    await expect(oversight.getByRole('link', typeof name === 'string' ? { name, exact: true } : { name }), `Oversight holds ${name}`).toBeVisible();
  }
  await oversight.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Reports | IdamBox CSRM');
  await expect(oversight.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute('aria-current', 'page');
  const index = page.getByRole('list', { name: 'Reports' });
  await expect(index.getByRole('listitem')).toHaveCount(reports.length);
  for (const report of reports) {
    await expect(index.getByRole('link', { name: report.title, exact: true }), `${report.key} card`).toHaveAttribute('href', `/app/reports/${report.key}`);
  }

  // Risk exposure: the Critical residual tile equals the released, open, Critical-residual Risk Register list (D-42).
  await page.goto('/app/reports/risk-exposure');
  const criticalTile = page.getByRole('region', { name: 'Summary', exact: true }).getByRole('link', { name: /^Critical residual [\d,]+ Released open Risks$/ });
  const criticalResidual = await tileValue(criticalTile);
  await criticalTile.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]residualRating=Critical(&|$)/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page).toHaveURL(/[?&]stage=released(&|$)/);
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
  /*
   * WR-603: Bob picks up a request Jane has just submitted, so his Needs your action holds work and its figure is
   * compared with the list it opens, never read only at zero.
   */
  await signIn(page, 'Requestor');
  const held = await createSubmittedRequest(page, { title: `Dashboard assigned work ${Date.now().toString(36)}`, assessmentType: 'BAU', businessCriticality: 'Low', dueDate: null });
  await page.context().clearCookies();
  await signIn(page, 'Security Analyst');
  await page.goto(`/app/review/requests/${encodeURIComponent(held.documentId)}`);
  const assignment = page.getByRole('region', { name: 'Assignment' });
  await assignment.getByRole('button', { name: `Pick up ${held.requestNumber}`, exact: true }).click();
  await expect(assignment.getByText('Assigned to Bob Doe', { exact: true }), 'Bob holds a request that needs him').toBeVisible();

  // The analyst's Home is the review summary (D-16); the Home item reaches it from anywhere.
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const homeItem = navigation.getByRole('link', { name: 'Home', exact: true });
  await homeItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Home | IdamBox CSRM');
  await expect(homeItem).toHaveAttribute('aria-current', 'page');
  await expect(navigation.locator('[aria-current="page"]'), 'exactly one navigation item is current').toHaveCount(1);

  // Needs action first: four tiles, then the eight widgets in reading order, Your own requests last.
  const needsAction = page.getByRole('region', { name: 'Needs action', exact: true });
  await expect(needsAction.locator('[data-slot="kpi-tile"]'), 'the four Needs action tiles').toHaveCount(4);
  await expect(page.locator('[data-state-kind="error"]'), 'no unit failed').toHaveCount(0);
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Needs action', ...dashboardWidgets]);

  // E1 (Phase 13 D-15, changed deliberately): Needs your action is the viewer's own work and equals Assigned to me
  // under Requires attention, the list it opens, which holds the request Bob picked up (WR-603).
  const needsYourActionTile = needsAction.getByRole('link', { name: /^Needs your action [\d,]+ Requests assigned to you that need analyst action$/ });
  const needsYourAction = await tileValue(needsYourActionTile);
  expect(needsYourAction, 'the request Bob picked up needs him').toBeGreaterThanOrEqual(1);
  // WR-603: the team's Requires attention row keeps the proof E1 replaced: it equals the Requests queue it opens.
  const teamRow = page.getByRole('region', { name: 'Review queue', exact: true }).getByRole('link', { name: /^Requires attention: [\d,]+ / });
  await expect(teamRow, 'the team’s Requires attention row').toHaveCount(1);
  await expect(teamRow).toHaveAttribute('href', '/app/review/requests');
  const teamRequiresAttention = await queueRowValue(teamRow);
  await needsYourActionTile.click();
  await expect(page).toHaveURL(/\/app\/review\/assigned\?queue=requires-attention$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Assigned to me', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  await expect(navigation.getByRole('link', { name: /^Assigned to me\b/ })).toHaveAttribute('aria-current', 'page');
  await expect(homeItem, 'the Home item is not current on a review queue').not.toHaveAttribute('aria-current', 'page');
  expect(await displayedResultTotal(page), 'the Needs your action tile equals Assigned to me under Requires attention').toBe(needsYourAction);
  await expect(page.getByRole('main').getByRole('link', { name: held.requestNumber, exact: true }), 'Assigned to me holds the request Bob picked up').toHaveCount(1);

  await page.goto('/app');
  await teamRow.click();
  await expect(page).toHaveURL(/\/app\/review\/requests$/);
  await expect(page.getByRole('combobox', { name: 'Filter by queue' })).toHaveValue('requires-attention');
  expect(await displayedResultTotal(page), 'the team’s Requires attention row equals the Requests queue it opens').toBe(teamRequiresAttention);

  // Overdue equals the overdue alert list.
  await page.goto('/app');
  const overdueTile = needsAction.getByRole('link', { name: /^Overdue [\d,]+ / });
  const overdue = await tileValue(overdueTile);
  expect(overdue, 'the Phase 7 fixture holds overdue work').toBeGreaterThan(0);
  await overdueTile.click();
  await expect(page).toHaveURL(/\/app\/alerts\?/);
  await expect(page).toHaveURL(/[?&]urgency=overdue(&|$)/);
  await expect(page.getByRole('combobox', { name: 'Filter by urgency' })).toHaveValue('overdue');
  expect(await displayedResultTotal(page), 'the Overdue tile equals its alert list').toBe(overdue);

  // E22 (D-42): the Critical exposure row equals the released, open, Critical-residual Risk register list.
  await page.goto('/app');
  const criticalRow = page.getByRole('region', { name: 'Risk exposure', exact: true }).getByRole('link', { name: /^Critical: [\d,]+ released open Risks? by residual rating$/ });
  const critical = await barValue(criticalRow);
  await criticalRow.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]residualRating=Critical(&|$)/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page).toHaveURL(/[?&]stage=released(&|$)/);
  await expect(page.getByRole('heading', { name: 'Risk Register' })).toBeVisible();
  expect(await displayedResultTotal(page), 'the Critical exposure row equals its Risk Register list').toBe(critical);

  // Answers stay submitted after the Risk Assessment is drafted and released, so the Questionnaires row
  // counts finished work too. It reads Submitted, never waiting work, and equals the list it opens.
  await page.goto('/app');
  const reviewQueue = page.getByRole('region', { name: 'Review queue', exact: true });
  await expect(reviewQueue.getByText(/ready for review|work waiting/i), 'no queue copy calls submitted Questionnaires waiting work').toHaveCount(0);
  const submittedRow = reviewQueue.getByRole('link', { name: /^Submitted: [\d,]+ Questionnaires?$/ });
  const submitted = await queueRowValue(submittedRow);
  await submittedRow.click();
  await expect(page).toHaveURL(/\/app\/review\/questionnaires\?(.*&)?status=submitted(&|$)/);
  await expect(page.getByRole('heading', { level: 1, name: 'Questionnaires', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('submitted');
  expect(await displayedResultTotal(page), 'the Submitted row equals the submitted Questionnaire list').toBe(submitted);

  // E23 (D-42, D-37): every High and Critical row's Risk is in the released open list of its rating,
  // which the footer's View Critical Risks and View High Risks open. Membership, read from the two lists.
  await page.goto('/app');
  const highCritical = page.getByRole('region', { name: 'High and Critical residual Risks', exact: true });
  const highCriticalLinks = highCritical.locator('a.record-link');
  // A production build reveals a streamed widget after the document's load event, so the list is
  // awaited with a retrying assertion rather than read once straight after the navigation.
  await expect(highCriticalLinks, 'the widget lists High and Critical residual Risks').not.toHaveCount(0);
  const identifiers = await highCriticalLinks.allTextContents();
  expect(identifiers.some((identifier) => identifier.startsWith('RSK-E2E-P7-')), 'a Phase 7 fixture Risk is listed').toBe(true);
  expect(identifiers, 'a closed Risk never counts as exposure').not.toContain(fixture.risks.closed);
  // The seeded Critical Risk is under assessment, so the released list never shows it (D-42).
  expect(identifiers, 'a Risk under assessment is never in the released list').not.toContain(fixture.risks.critical);
  await expect(highCritical.getByRole('link', { name: 'Open Risk Register' }), 'E23: the footer no longer opens every open Risk').toHaveCount(0);
  // Each row's rating, from its badge, so each identifier is looked for in the list of its own rating.
  const rowsByRating: Record<'Critical' | 'High', string[]> = { Critical: [], High: [] };
  for (const item of await highCritical.getByRole('list').getByRole('listitem').all()) {
    const identifier = ((await item.locator('a.record-link').textContent()) ?? '').trim();
    const rating = (await item.getByLabel(/^Severity: critical/).count()) > 0 ? 'Critical' : 'High';
    rowsByRating[rating].push(identifier);
  }
  expect([...rowsByRating.Critical, ...rowsByRating.High].sort(), 'every row has a rating').toEqual(identifiers.map((identifier) => identifier.trim()).sort());
  for (const rating of ['Critical', 'High'] as const) {
    await page.goto('/app');
    await highCritical.getByRole('link', { name: `View ${rating} Risks`, exact: true }).click();
    await expect(page).toHaveURL(/\/app\/risks\?/);
    await expect(page).toHaveURL(new RegExp(`[?&]residualRating=${rating}(&|$)`));
    await expect(page).toHaveURL(/[?&]state=open(&|$)/);
    await expect(page).toHaveURL(/[?&]stage=released(&|$)/);
    // A rating with no row may have an empty list, which renders no table: nothing to look for.
    if (rowsByRating[rating].length === 0) continue;
    // The released open list of one rating holds a few Risks; one page of 50 reads all of them.
    await page.goto(`${page.url()}&pageSize=50`);
    const register = page.getByRole('table', { name: 'Risk Register results' });
    await expect(register).toBeVisible();
    expect(await displayedResultTotal(page), `the released ${rating} list fits on one page`).toBeLessThanOrEqual(50);
    const listed = (await register.locator('a.record-link').allTextContents()).map((identifier) => identifier.trim());
    for (const identifier of rowsByRating[rating]) {
      expect(listed, `${identifier} is in the released open ${rating} list`).toContain(identifier);
    }
  }

  // Top alerts lists a fixture Risk; Recent activity names the Security Analyst who released a Risk Assessment.
  await page.goto('/app');
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

  await page.goto('/app?__e2eState=populated&__e2ePartial=analyst-top-alerts-error');
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
  // Phase 13 (D-15): the Assigned to you group's four rows and Waiting for pick-up join the six team rows.
  await expect(page.getByRole('region', { name: 'Review queue', exact: true }).getByRole('link')).toHaveCount(11);
  await expect(page.getByRole('region', { name: 'Risk exposure', exact: true }).getByRole('list', { name: 'Released open Risks by residual rating' })).toBeVisible();
});

/*
 * DASH-03 (D-41, D-42, UI-SPEC §9.2): the open Risks under assessment are counted apart from the released
 * rows, say why, and equal the register's under-assessment list. At 1440, desktop only.
 */
test('DASH03_UNDER_ASSESSMENT_APART: the analyst Home counts the Risks under assessment apart, equal to their list', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  const exposure = page.getByRole('region', { name: 'Risk exposure', exact: true });
  await expect(exposure.getByText('Released Risks only. Open Risks by residual rating, with accepted Risks marked.', { exact: true })).toBeVisible();
  const released = exposure.getByRole('list', { name: 'Released open Risks by residual rating' });
  await expect(released).toBeVisible();
  const underAssessment = exposure.getByRole('link', { name: /^Under assessment: [\d,]+ open Risks? not yet released$/ });
  await expect(underAssessment, 'DASH03_UNDER_ASSESSMENT_ROW').toBeVisible();
  await expect(exposure.getByText('Not yet released, so not counted above.', { exact: true }), 'DASH03_UNDER_ASSESSMENT_CAPTION').toBeVisible();
  // Apart: the row sits below the released list, outside it, so the two stages are never one total.
  await expect(released.getByRole('link', { name: /^Under assessment/ }), 'DASH03_UNDER_ASSESSMENT_OUTSIDE_THE_RELEASED_LIST').toHaveCount(0);
  const [listBox, rowBox] = await Promise.all([released.boundingBox(), underAssessment.boundingBox()]);
  expect(rowBox!.y, 'DASH03_UNDER_ASSESSMENT_BELOW_THE_RELEASED_ROWS').toBeGreaterThanOrEqual(listBox!.y + listBox!.height - 1);
  // The seeded in-review assessment holds open Risks, so the figure is above zero.
  const count = await queueRowValue(underAssessment);
  expect(count, 'DASH03_UNDER_ASSESSMENT_COUNTS_THE_SEEDED_RISKS').toBeGreaterThan(0);

  await underAssessment.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  await expect(page).toHaveURL(/[?&]state=open(&|$)/);
  await expect(page).toHaveURL(/[?&]stage=under-assessment(&|$)/);
  await expect(page.getByText('Stage: Under assessment', { exact: true }), 'DASH03_UNDER_ASSESSMENT_CHIP').toBeVisible();
  expect(await displayedResultTotal(page), 'DASH03_UNDER_ASSESSMENT_EQUALS_ITS_LIST').toBe(count);
});

/*
 * D-41, D-45 (UI-SPEC §9.2, §9.5): the seeded released, open, accepted Moderate Risk is counted in the Moderate
 * row's accepted link, which opens exactly the accepted released list, and the register marks it Released and
 * Accepted. At 1440 the accepted link sits on its row's line.
 */
test('DASH03_ACCEPTED_SEED: the accepted seed Risk is in its rating’s accepted link and marked Released and Accepted', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  const exposure = page.getByRole('region', { name: 'Risk exposure', exact: true });
  const moderateRow = exposure.getByRole('link', { name: /^Moderate: [\d,]+ released open Risks? by residual rating$/ });
  const accepted = exposure.getByRole('link', { name: /^[\d,]+ accepted Moderate Risks?$/ });
  await expect(accepted, 'DASH03_ACCEPTED_LINK').toBeVisible();
  await expect(accepted).toHaveText(/^[\d,]+ accepted$/);
  const acceptedCount = Number.parseInt(((await accepted.textContent()) ?? '').replace(/,/g, ''), 10);
  expect(acceptedCount, 'DASH03_ACCEPTED_COUNTS_THE_SEED').toBeGreaterThan(0);
  expect(acceptedCount, 'DASH03_ACCEPTED_IS_PART_OF_ITS_ROW').toBeLessThanOrEqual(await barValue(moderateRow));
  // UI-SPEC §9.2 at 1440: the accepted link holds its row's line.
  const [rowBox, acceptedBox] = await Promise.all([moderateRow.boundingBox(), accepted.boundingBox()]);
  expect(acceptedBox!.y, 'DASH03_ACCEPTED_ON_ITS_ROW_LINE_AT_1440').toBeLessThan(rowBox!.y + rowBox!.height);
  expect(acceptedBox!.y + acceptedBox!.height, 'DASH03_ACCEPTED_ON_ITS_ROW_LINE_AT_1440').toBeGreaterThan(rowBox!.y);
  expect(acceptedBox!.x, 'DASH03_ACCEPTED_AFTER_ITS_ROW_AT_1440').toBeGreaterThanOrEqual(rowBox!.x + rowBox!.width - 1);

  await accepted.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  for (const parameter of [/[?&]residualRating=Moderate(&|$)/, /[?&]state=open(&|$)/, /[?&]stage=released(&|$)/, /[?&]treatmentAction=Accept(&|$)/]) {
    await expect(page).toHaveURL(parameter);
  }
  expect(await displayedResultTotal(page), 'DASH03_ACCEPTED_EQUALS_ITS_LIST').toBe(acceptedCount);
  const register = page.getByRole('table', { name: 'Risk Register results' });
  const seededRow = register.getByRole('row').filter({ has: page.getByRole('link', { name: fixture.risks.accepted, exact: true }) });
  await expect(seededRow, 'DASH03_ACCEPTED_SEED_LISTED').toHaveCount(1);
  await expect(seededRow.getByText('Released', { exact: true }), 'DASH03_ACCEPTED_SEED_RELEASED').toBeVisible();
  await expect(seededRow.getByText('Accepted', { exact: true }), 'DASH03_ACCEPTED_SEED_ACCEPTED').toBeVisible();
});

/*
 * D-38, D-42 (UI-SPEC §9.3, §9.4): the Risk exposure report's Released open Risks, Accepted and Under assessment
 * tiles each equal the register list of their own stage, and the treatment report's due window is the product's
 * 14 days, its figure equal to the due-soon alert list.
 */
test('DASH03_REPORT_SCOPE: the exposure report counts each stage apart and the treatment report reads the 14-day window, each equal to its list', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  const stageTiles = [
    { name: /^Released open Risks [\d,]+ Released Risks only$/, parameters: [/[?&]state=open(&|$)/, /[?&]stage=released(&|$)/], chip: 'Stage: Released' },
    {
      name: /^Accepted [\d,]+ Released Risks with the treatment action Accept$/,
      parameters: [/[?&]state=open(&|$)/, /[?&]stage=released(&|$)/, /[?&]treatmentAction=Accept(&|$)/],
      chip: 'Treatment action: Accept',
    },
    { name: /^Under assessment [\d,]+ Not yet released$/, parameters: [/[?&]state=open(&|$)/, /[?&]stage=under-assessment(&|$)/], chip: 'Stage: Under assessment' },
  ] as const;
  for (const stage of stageTiles) {
    await page.goto('/app/reports/risk-exposure');
    const summary = page.getByRole('region', { name: 'Summary', exact: true });
    await expect(summary.getByRole('listitem'), 'DASH03_REPORT_FIVE_TILES').toHaveCount(5);
    const tile = summary.getByRole('link', { name: stage.name });
    await expect(tile, `DASH03_REPORT_TILE ${stage.chip}`).toBeVisible();
    const value = await tileValue(tile);
    // The seed holds released, accepted and under-assessment open Risks, so no figure is vacuous.
    expect(value, `DASH03_REPORT_TILE_ABOVE_ZERO ${stage.chip}`).toBeGreaterThan(0);
    await tile.click();
    await expect(page).toHaveURL(/\/app\/risks\?/);
    for (const parameter of stage.parameters) await expect(page).toHaveURL(parameter);
    await expect(page.getByText(stage.chip, { exact: true }), `DASH03_REPORT_CHIP ${stage.chip}`).toBeVisible();
    expect(await displayedResultTotal(page), `DASH03_REPORT_TILE_EQUALS_ITS_LIST ${stage.chip}`).toBe(value);
  }

  // The Under assessment section sits apart, after the three released sections, with its own table.
  await page.goto('/app/reports/risk-exposure');
  const sections = page.locator('[data-slot="report-section"] > h2');
  await expect(sections).toHaveText(['Inherent and residual rating', 'Residual rating by treatment status', 'Most exposed Information Systems', 'Under assessment']);
  const underAssessment = page.getByRole('region', { name: 'Under assessment', exact: true });
  await expect(underAssessment.getByText('Open Risks in risk assessments not yet released, by residual rating. They are not counted in the sections above.', { exact: true })).toBeVisible();
  await expect(underAssessment.getByRole('table', { name: 'Under assessment', exact: true }).getByRole('columnheader')).toHaveText(['Residual rating', 'Risks']);

  // Treatment performance: the window is the product's 14 days, and its figure equals the due-soon alerts (D-38).
  await page.goto('/app/reports/treatment-performance');
  const treatmentSummary = page.getByRole('region', { name: 'Summary', exact: true });
  const dueTile = treatmentSummary.locator('[data-slot="kpi-tile"]').filter({ has: page.getByText('Due within 14 days', { exact: true }) });
  await expect(dueTile, 'DASH03_REPORT_DUE_WITHIN_14_DAYS').toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Due state', exact: true }).getByRole('rowheader', { name: 'Due within 14 days', exact: true })).toBeVisible();
  await expect(page.getByText(/Due within 30 days/), 'DASH03_REPORT_NO_30_DAY_WINDOW').toHaveCount(0);
  await expect(page.getByText('Open Risks whose treatment is not Complete, by target date. Includes Risks under assessment.', { exact: true })).toBeVisible();
  const dueSoon = await tileValue(dueTile);
  expect(dueSoon, 'DASH03_REPORT_DUE_SOON_ABOVE_ZERO').toBeGreaterThan(0);
  await page.goto('/app/alerts?kind=risk-treatment-due-soon');
  await expect(page.getByRole('combobox', { name: 'Filter by alert type' })).toHaveValue('risk-treatment-due-soon');
  expect(await displayedResultTotal(page), 'DASH03_REPORT_DUE_SOON_EQUALS_THE_ALERT_LIST').toBe(dueSoon);
});

/** The figure a report table cell shows, linked or plain. */
async function cellValue(cell: Locator): Promise<number> {
  const text = await cell.textContent();
  const value = Number.parseInt((text ?? '').replace(/,/g, ''), 10);
  expect(Number.isSafeInteger(value), `the cell shows a whole number, not "${text}"`).toBe(true);
  return value;
}

/** The body row of a report table whose row header reads `label`. */
function reportTableRow(page: Page, table: string, label: string): Locator {
  return page.getByRole('table', { name: table, exact: true }).getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
}

/*
 * UX-09 criterion 2 (D-35, UI-SPEC §8.2): the treatment report's Due later figure opens the register's
 * dueState=later list, whose total equals it. A zero figure is plain text (X-10), so the proof then opens the
 * same list by its URL and finds it as empty as the figure says.
 */
test('UX09_FIGURE_DUE_LATER: the treatment report’s Due later figure equals the Risk register list it opens', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/treatment-performance');
  const row = reportTableRow(page, 'Due state', 'Due later');
  await expect(row, 'UX09_FIGURE_DUE_LATER_ROW').toHaveCount(1);
  const figure = await cellValue(row.getByRole('cell'));
  if (figure > 0) {
    const link = row.getByRole('link', { name: /^[\d,]+ Risks?: Due later$/ });
    await expect(link, 'UX09_FIGURE_DUE_LATER_LINK').toHaveAttribute('href', '/app/risks?dueState=later');
    await link.click();
  } else {
    await expect(row.getByRole('link'), 'UX09_FIGURE_DUE_LATER_ZERO_IS_PLAIN').toHaveCount(0);
    await page.goto('/app/risks?dueState=later');
  }
  await expect(page).toHaveURL(/\/app\/risks\?dueState=later$/);
  await expect(page.getByText('Due state: Due later', { exact: true }), 'UX09_FIGURE_DUE_LATER_CHIP').toBeVisible();
  expect(await displayedResultTotal(page), 'UX09_FIGURE_DUE_LATER_EQUALS_ITS_LIST').toBe(figure);
});

/** The first figure link in a report table whose name matches `name`, with the figure it shows. */
async function firstFigureLink(page: Page, table: string, name: RegExp, message: string): Promise<{ link: Locator; figure: number }> {
  const links = page.getByRole('table', { name: table, exact: true }).getByRole('link', { name });
  // Only a figure above zero links (X-10); the seed gives each of these tables at least one.
  await expect(links.first(), `${message}_HAS_A_NON_ZERO_FIGURE`).toBeVisible();
  const link = links.first();
  const figure = await cellValue(link);
  expect(figure, `${message}_FIGURE_ABOVE_ZERO`).toBeGreaterThan(0);
  return { link, figure };
}

/*
 * UX-09 criterion 2 (D-35, UI-SPEC §8.2, §9.3): a residual rating by treatment status figure opens the released
 * open Risks with that rating and treatment status, and the register's total equals it.
 */
test('UX09_FIGURE_EXPOSURE_CELL: a residual rating by treatment status figure equals the Risk register list it opens', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/risk-exposure');
  const { link, figure } = await firstFigureLink(
    page,
    'Residual rating by treatment status',
    /^[\d,]+ Risks?: (Critical|High|Moderate|Low|Not rated), (Not Started|In Progress|Overdue|Complete|Not provided)$/,
    'UX09_FIGURE_EXPOSURE_CELL',
  );
  await link.click();
  await expect(page).toHaveURL(/\/app\/risks\?/);
  for (const parameter of [/[?&]residualRating=[\w]+(&|$)/, /[?&]treatmentStatus=[\w+]+(&|$)/, /[?&]state=open(&|$)/, /[?&]stage=released(&|$)/]) {
    await expect(page, 'UX09_FIGURE_EXPOSURE_CELL_FILTERS').toHaveURL(parameter);
  }
  await expect(page.getByText('Stage: Released', { exact: true }), 'UX09_FIGURE_EXPOSURE_CELL_CHIP').toBeVisible();
  expect(await displayedResultTotal(page), 'UX09_FIGURE_EXPOSURE_CELL_EQUALS_ITS_LIST').toBe(figure);
});

/*
 * D-35, D-39 (UI-SPEC §8.2): a month's released figure opens that month's released Risk Assessments, with the
 * Released from and Released to chips, and the list's total equals it.
 */
test('UX09_FIGURE_THROUGHPUT_MONTH: a released month figure equals the Risk assessments list it opens', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/assessment-throughput');
  const { link, figure } = await firstFigureLink(page, 'Released per month', /^[\d,]+ released in \w+ \d{4}$/, 'UX09_FIGURE_THROUGHPUT_MONTH');
  await expect(link).toHaveAttribute('href', /^\/app\/review\/assessments\?status=approved&approvedFrom=\d{4}-\d{2}-01&approvedTo=\d{4}-\d{2}-\d{2}$/);
  await link.click();
  await expect(page).toHaveURL(/\/app\/review\/assessments\?status=approved&approvedFrom=\d{4}-\d{2}-01&approvedTo=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/^Released from \(UTC\): /), 'UX09_FIGURE_THROUGHPUT_MONTH_FROM_CHIP').toBeVisible();
  await expect(page.getByText(/^Released to \(UTC\): /), 'UX09_FIGURE_THROUGHPUT_MONTH_TO_CHIP').toBeVisible();
  expect(await displayedResultTotal(page), 'UX09_FIGURE_THROUGHPUT_MONTH_EQUALS_ITS_LIST').toBe(figure);
});

/*
 * D-35 (UI-SPEC §8.2): a lifecycle figure opens the Requests queue's All requests view with that status, and the
 * queue's total equals it.
 */
test('UX09_FIGURE_LIFECYCLE_ROW: a lifecycle figure equals the All requests queue it opens', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/assessment-throughput');
  const { link, figure } = await firstFigureLink(page, 'Assessment Requests by lifecycle state', /^[\d,]+ requests?: .+$/, 'UX09_FIGURE_LIFECYCLE_ROW');
  await link.click();
  await expect(page).toHaveURL(/\/app\/review\/requests\?queue=all&status=[a-z-]+$/);
  await expect(page.getByText(/^Queue: All requests$/), 'UX09_FIGURE_LIFECYCLE_ROW_QUEUE').toBeVisible();
  expect(await displayedResultTotal(page), 'UX09_FIGURE_LIFECYCLE_ROW_EQUALS_ITS_LIST').toBe(figure);
});

/*
 * D-36 (UI-SPEC §8.1 rule 5, §8.2): a count of mitigation controls never poses as an equal list. The
 * implementation status row header opens the open Risks with that mitigation-control status, its name beginning
 * with the status, and the figure beside it stays plain.
 */
test('UX09_FIGURE_CONTROL_ROW_HEADER: an implementation status row header opens the Risks with those mitigation controls', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'Security Analyst');

  await page.goto('/app/reports/control-effectiveness');
  const table = page.getByRole('table', { name: 'Implementation status', exact: true });
  // The figures count mitigation controls, so none of them links; only the row headers do.
  await expect(table.getByRole('cell').getByRole('link'), 'UX09_FIGURE_CONTROL_FIGURES_PLAIN').toHaveCount(0);
  // A linked row header takes its link's name, which begins with the visible status (WCAG 2.5.3).
  const header = table.getByRole('rowheader').getByRole('link', { name: 'Existing: view the Risks with Existing mitigation controls', exact: true });
  await expect(header, 'UX09_FIGURE_CONTROL_ROW_HEADER_NAME').toBeVisible();
  await expect(header).toHaveText('Existing');
  await header.click();
  await expect(page).toHaveURL(/\/app\/risks\?mitigationStatus=Existing&state=open$/);
  await expect(page.getByText('Mitigation-control status: Existing', { exact: true }), 'UX09_FIGURE_CONTROL_ROW_HEADER_CHIP').toBeVisible();
  await expect(page.getByText(/^[\d,]+ results?$/), 'UX09_FIGURE_CONTROL_ROW_HEADER_LIST').toBeVisible();
  await page.goto('/app/risks?mitigationStatus=Existing&state=open&q=RSK-DEV-MUTABLE-001');
  await expect(page.getByRole('link', { name: 'RSK-DEV-MUTABLE-001', exact: true }), 'Existing excludes the seeded Planned-control Risk').toHaveCount(0);
});

/*
 * UI-SPEC §9.2 at 375 (plan 11-21's B1 walkthrough stays the backstop): the accepted link wraps beneath its
 * row's count and no exposure row overflows its widget. This file is not on the mobile project's list, so the
 * check sets the 375×812 viewport itself and runs in the desktop project only.
 */
test('the accepted link sits beneath its row’s count without overflow at a 375 viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, 'Security Analyst');

  const exposure = page.getByRole('region', { name: 'Risk exposure', exact: true });
  const moderateRow = exposure.getByRole('link', { name: /^Moderate: [\d,]+ released open Risks? by residual rating$/ });
  const accepted = exposure.getByRole('link', { name: /^[\d,]+ accepted Moderate Risks?$/ });
  await accepted.scrollIntoViewIfNeeded();
  await expect(accepted).toBeVisible();
  const [countBox, acceptedBox, widgetBox] = await Promise.all([
    moderateRow.locator('[data-slot="bar-chart-value"]').boundingBox(),
    accepted.boundingBox(),
    exposure.boundingBox(),
  ]);
  expect(acceptedBox!.y, 'the accepted link wraps beneath its row’s count at 375').toBeGreaterThanOrEqual(countBox!.y + countBox!.height - 1);
  for (const item of await exposure.getByRole('listitem').all()) {
    const box = await item.boundingBox();
    expect(box!.x, 'an exposure row starts inside its widget at 375').toBeGreaterThanOrEqual(widgetBox!.x - 1);
    expect(box!.x + box!.width, 'an exposure row ends inside its widget at 375').toBeLessThanOrEqual(widgetBox!.x + widgetBox!.width + 1);
  }
  expect(acceptedBox!.x + acceptedBox!.width, 'the accepted link ends inside its widget at 375').toBeLessThanOrEqual(widgetBox!.x + widgetBox!.width + 1);
  const caption = exposure.getByText('Not yet released, so not counted above.', { exact: true });
  const [underAssessmentBox, captionBox] = await Promise.all([
    exposure.getByRole('link', { name: /^Under assessment: / }).boundingBox(),
    caption.boundingBox(),
  ]);
  expect(captionBox!.y, 'the under-assessment caption sits beneath its row at 375').toBeGreaterThanOrEqual(underAssessmentBox!.y + underAssessmentBox!.height - 1);
  await expectNoHorizontalOverflow(page, 'the analyst Home has no horizontal overflow at 375px');
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
  const homeItem = navigation.getByRole('link', { name: 'Home', exact: true });

  // Home (the review summary), then every alert through the Top alerts footer.
  await homeItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
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
  await homeItem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
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

  // Every report opens with its text equivalents, from the Oversight section and back through the breadcrumb.
  await navigation.getByRole('group', { name: 'Oversight' }).getByRole('link', { name: 'Reports', exact: true }).click();
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
    await expect(page.locator('[data-slot="report-section"]'), `${report.key} renders every section`)
      .toHaveCount(report.tableSections.length + report.alertSections.length + report.coverageSections.length);
    for (const name of report.tableSections) {
      const section = page.getByRole('region', { name, exact: true });
      await expect(section.getByRole('table', { name, exact: true }), `${report.key} · ${name} has a visible table`).toBeVisible();
    }
    for (const name of report.coverageSections) {
      const section = page.getByRole('region', { name, exact: true });
      const tableOrNote = section.getByRole('table', { name, exact: true })
        .or(section.getByText(/^[\d,]+ High or Critical residual Risks? (has|have) no impacted Information System\.$/));
      await expect(tableOrNote.first(), `${report.key} · ${name} shows its table or its coverage note`).toBeVisible();
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
    await expect(navigation.getByRole('link', { name: 'Home', exact: true }), `${role} navigation rendered`).toBeVisible();
    // Anchored, so a count in an Alerts link's name could not hide it (D-10).
    for (const item of [/^Analyst dashboard\b/, /^Alerts\b/, /^Reports\b/]) {
      await expect(navigation.getByRole('link', { name: item }), `${role} has no ${item} link`).toHaveCount(0);
    }
    await expect(navigation.getByRole('group', { name: 'Oversight' }), `${role} has no Oversight section`).toHaveCount(0);

    for (const route of phase7Routes) {
      for (const url of [route.url, `${route.url}?__e2eState=populated`]) {
        await page.goto(url);
        const main = page.getByRole('main');
        await expect(page.getByRole('heading', { level: 1, name: route.heading, exact: true }), `${role} ${url} keeps its page header`).toBeVisible();
        const alert = main.getByRole('alert');
        await expect(alert, `${role} ${url} shows exactly one alert`).toHaveCount(1);
        await expect(alert.getByRole('heading', { name: route.permission, exact: true }), `${role} is refused ${url}`).toBeVisible();
        await expect(alert.getByRole('link', { name: 'Go to Home', exact: true })).toHaveAttribute('href', '/app');
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
