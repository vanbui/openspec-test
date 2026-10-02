import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';
import { attachCspCollector, expectNoCspViolations } from './helpers/csp';
import { expectFocusVisible } from './helpers/focus';
import { primaryViewport, signInAs } from './helpers/navigation';
import { settleElementWidth } from './helpers/settle';

const viewports = [375, 768, 1280, 1440] as const;

/*
 * Record names unique to this run and this project. The CSV journey runs in both projects against one
 * database, so each pass creates its own records and its preview reads Create 1, Update 1 and
 * Unchanged 1 every time (D-14).
 */
function recordSuffix(): string {
  return `dylan-test-${process.pid}-${test.info().project.name}`;
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth, label).toBeLessThanOrEqual(geometry.viewportWidth);
}

/**
 * D-29: a table's scroller is a named, focusable region exactly while the table is wider than it.
 * `data-overflow` has to follow the measured width (it flips once the page hydrates), so neither
 * branch can pass vacuously. Returns the attribute's value.
 */
async function expectRegionFollowsOverflow(page: Page, tableName: string, message: string): Promise<'true' | 'false'> {
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
    await expect(region, `${message}: the overflowing scroller is the named region`).toHaveAttribute('tabindex', '0');
    await region.focus();
    await expect(region, `${message}: the region takes keyboard focus`).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate((element) => element.scrollLeft), { message: `${message}: ArrowRight scrolls the region` }).toBeGreaterThan(0);
  } else {
    await expect(region, `${message}: a table that fits exposes no region`).toHaveCount(0);
    await expect(scroller, `${message}: a table that fits is no tab stop`).not.toHaveAttribute('tabindex');
  }
  return overflows ? 'true' : 'false';
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

/*
 * Opens the navigation where this width shows it: the sidebar from 1024px is already on screen, and
 * below 1024px the Menu sheet holds it. Returns whether the sheet was opened.
 */
async function showNavigation(page: Page): Promise<boolean> {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (!(await menu.isVisible())) return false;
  await menu.click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  return true;
}

async function establishAnalystBaseline(
  page: Page,
  request: APIRequestContext,
  viewport: { width: number; height: number } = { width: 375, height: 812 },
): Promise<void> {
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signInAs(page, 'Security Analyst');
  await showNavigation(page);
  await expect(
    page.getByRole('navigation').getByText('Administration', { exact: true }),
    'Expected Administration navigation group to be visible',
  ).toBeVisible();
}

async function expectDeniedWithoutDisclosure(page: Page, routes: string[], forbidden: RegExp): Promise<void> {
  for (const route of routes) {
    await page.goto(route);
    // Since 06.6 the denial renders through the shared PermissionDeniedState.
    await expect(page.getByRole('alert').filter({ hasText: /don.t have access/i })).toContainText(/don.t have access to Administration records/i);
    await expect(page.getByRole('link', { name: 'Return to workspace' })).toHaveAttribute('href', '/app');
    await expect(page.getByRole('search')).toHaveCount(0);
    await expect(page.getByText(/\d+ results/i)).toHaveCount(0);
    await expect(page.getByText(forbidden)).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  }
}

async function signOutAndEstablishRequestorBaseline(page: Page): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, 'Requestor');
  // Read the navigation on screen (the sheet below 1024px), so the absent group is proved at every width.
  const sheetOpened = await showNavigation(page);
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('link', { name: 'My Requests' }), 'the Requestor navigation is on screen').toBeVisible();
  await expect(navigation.getByText('Administration', { exact: true })).toHaveCount(0);
  if (sheetOpened) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  }
}

test.describe.serial('@administration-risk-types Risk Type administration', () => {
  test('Bob creates and edits a reusable Risk Type while Jane learns no record facts', async ({ page, request }) => {
    test.setTimeout(180_000);
    const suffix = recordSuffix();
    await establishAnalystBaseline(page, request);

    await page.getByRole('link', { name: 'Risk Types', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Risk Types' })).toBeVisible();
    await page.getByRole('link', { name: 'Create Risk Type' }).click();
    const name = `Credential misuse ${suffix}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill('Reusable definition created by the isolated administration journey.');
    await page.getByRole('combobox', { name: /Applicable Controls/i }).click();
    const firstControl = page.getByRole('option').first();
    await expect(firstControl).toBeVisible();
    const chosenControl = (await firstControl.innerText()).trim();
    expect(chosenControl, 'the first control option reads by its label').not.toBe('');
    await firstControl.click();
    await page.getByRole('button', { name: 'Create Risk Type' }).click();
    await expect(page.getByText('Risk Type created.')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Risk Type' }).click();
    await page.getByLabel('Description').fill('Reusable definition edited and persisted by the administration journey.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.reload();
    await expect(page.getByText('Reusable definition edited and persisted by the administration journey.')).toBeVisible();
    // ADMIN05_SELECTED_CONTROL_LABELLED: after a reload the saved control reads by its label, never its id (D-36).
    const selectedControls = page.getByRole('group', { name: 'Selected applicable Controls' });
    await expect(selectedControls.getByText(chosenControl, { exact: true }), 'ADMIN05_SELECTED_CONTROL_LABELLED: the saved control keeps its label').toBeVisible();
    await expect(selectedControls.getByText('Control not found', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit Risk Type' }).click();
    await page.getByLabel('Description').fill('Unsaved dialog evidence');
    await page.getByRole('link', { name: 'Return to Risk Types' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();

    await signOutAndEstablishRequestorBaseline(page);
    await expectDeniedWithoutDisclosure(page, [
      '/app/admin/risk-types', '/app/admin/risk-types/new',
      '/app/admin/risk-types/not-a-record', '/app/admin/risk-types/import',
    ], new RegExp(name, 'i'));
  });
});

test.describe.serial('@administration-controls Control administration', () => {
  test('Bob searches the authoritative Control library and persists an edit', async ({ page, request }) => {
    test.setTimeout(600_000);
    const suffix = recordSuffix();
    await establishAnalystBaseline(page, request);
    await page.getByRole('link', { name: 'Controls', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible();
    await expect(page.getByText('2,646 results', { exact: true })).toBeVisible();
    const firstRow = page.locator('tbody tr').first();
    const existingControlNumber = (await firstRow.locator('td').nth(0).innerText()).trim();
    const existingFramework = (await firstRow.locator('td').nth(2).innerText()).trim();
    expect(existingControlNumber).not.toBe('');
    expect(existingFramework).not.toBe('');
    await page.getByRole('searchbox', { name: 'Search Controls' }).fill(existingControlNumber);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(existingControlNumber)}`));
    await expect(page.getByText('2,646 results', { exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Framework' }).fill(existingFramework);
    await expect(page).toHaveURL(/framework=/);

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/admin/controls');
      await expectNoHorizontalOverflow(page, `Controls has no page overflow at ${width}px`);
      if (width >= 768) {
        const overflow = await expectRegionFollowsOverflow(page, 'Controls results', `Controls at ${width}px`);
        test.info().annotations.push({ type: 'Controls results data-overflow', description: `${width}px: ${overflow}` });
      }
    }
    await expectFocusVisible(page.getByRole('link', { name: 'Create Control' }));
    await expectNoSeriousAxeViolations(page);

    // ADMIN05_CONTROL_LABELS: each control number shows once in its row, and APP-11 reads its complete
    // title (D-36, D-44). 5.1's name is asserted by plan 10-22, which loads the Annex A names (D-46).
    const controlsTable = page.getByRole('table', { name: 'Controls results', exact: true });
    const controlRow = (controlNumber: string): Locator => controlsTable.locator('tbody tr')
      .filter({ has: page.locator('td:first-child').getByText(controlNumber, { exact: true }) });
    await page.goto('/app/admin/controls?q=APP-11');
    const privacyRow = controlRow('APP-11');
    await expect(privacyRow, 'ADMIN05_CONTROL_LABELS: APP-11 is found').toHaveCount(1);
    await expect(privacyRow.getByRole('cell').nth(1), 'ADMIN05_CONTROL_LABELS: APP-11 reads its complete title').toHaveText('Security of personal information');
    await expect(privacyRow.getByText('Security of personal information', { exact: true }), 'ADMIN05_CONTROL_LABELS: the title shows once').toHaveCount(1);
    await expect(privacyRow.getByRole('cell').filter({ hasText: 'APP-11' }), 'ADMIN05_CONTROL_LABELS: APP-11 shows once in its row').toHaveCount(1);
    await page.goto('/app/admin/controls?q=5.1');
    const annexRow = controlRow('5.1');
    await expect(annexRow, 'ADMIN05_CONTROL_LABELS: 5.1 is found').toHaveCount(1);
    await expect(annexRow.getByRole('cell', { name: '5.1', exact: true }), 'ADMIN05_CONTROL_LABELS: 5.1 shows once in its row').toHaveCount(1);

    const controlNumber = `ZZ-${suffix}`;
    await page.getByRole('link', { name: 'Create Control' }).click();
    await expect(page).toHaveURL(/\/app\/admin\/controls\/new$/);
    await page.getByRole('textbox', { name: 'Control number', exact: true }).fill(controlNumber);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`Acceptance Control ${suffix}`);
    await page.getByRole('textbox', { name: 'Framework', exact: true }).fill('CSRM Acceptance');
    await page.getByRole('button', { name: 'Create Control' }).click();
    await page.getByRole('button', { name: 'Edit Control' }).click();
    await page.getByLabel('Control reference').fill('acceptance/edit/reload');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Control reference' })).toHaveValue('acceptance/edit/reload');
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    await signOutAndEstablishRequestorBaseline(page);
    await expectDeniedWithoutDisclosure(page, [
      '/app/admin/controls', '/app/admin/controls/new',
      '/app/admin/controls/not-a-record', '/app/admin/controls/import',
    ], new RegExp(controlNumber, 'i'));
  });
});

test.describe.serial('@administration-systems-assets Information System and Asset administration', () => {
  test('Bob maintains both inventories with responsive and accessible presentation', async ({ page, request }) => {
    test.setTimeout(600_000);
    const suffix = recordSuffix();
    await establishAnalystBaseline(page, request);

    for (const record of [
      { route: 'information-systems', singular: 'Information System', name: `Portal ${suffix}` },
      { route: 'information-assets', singular: 'Information Asset', name: `Records ${suffix}` },
    ]) {
      await page.goto(`/app/admin/${record.route}/new`);
      await page.getByLabel('Name').fill(record.name);
      await page.getByLabel('Description').fill(`Created ${record.singular} for the isolated journey.`);
      if (record.route === 'information-systems') {
        // UAT-053: the system gets an owner through the owner search and a business criticality.
        await page.getByLabel('Business criticality').fill('High');
        await page.getByRole('combobox', { name: 'Owner', exact: true }).fill('Jane');
        await page.getByRole('option', { name: 'Jane Doe', exact: true }).first().click();
        await expect(page.getByText('Selected owner: Jane Doe', { exact: true })).toBeVisible();
      }
      await page.getByRole('button', { name: `Create ${record.singular}` }).click();
      await expect(page.getByText(`${record.singular} created.`)).toBeVisible();
      await page.getByRole('button', { name: `Edit ${record.singular}` }).click();
      const persistedDescription = `Edited ${record.singular} and verified after reload.`;
      await page.getByLabel('Description').fill(persistedDescription);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.reload();
      await expect(page.getByText(persistedDescription)).toBeVisible();
      if (record.route === 'information-systems') {
        // After a reload the owner reads from the served record: a name, never an id (UAT-053).
        const selectedOwner = page.getByText(/^Selected owner: /);
        await expect(selectedOwner, 'ADMIN05_SYSTEM_OWNER_NAME: the served owner name seeds the form').toHaveText('Selected owner: Jane Doe');
        await expect(selectedOwner).not.toHaveText(/Selected owner: [A-Za-z0-9_-]{20,}$/);
      }
      await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    }

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/admin/information-systems');
      await expectNoHorizontalOverflow(page, `Information Systems has no page overflow at ${width}px`);
      if (width >= 768) {
        const overflow = await expectRegionFollowsOverflow(page, 'Information Systems results', `Information Systems at ${width}px`);
        test.info().annotations.push({ type: 'Information Systems results data-overflow', description: `${width}px: ${overflow}` });
      }
    }

    // ADMIN05_SYSTEM_OWNER_COLUMNS: at 1440 the oversight columns follow Name and are in view without
    // scrolling; any overflow stays inside the labelled table region (UI-SPEC §16.4, UI-D23).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/app/admin/information-systems?q=${encodeURIComponent(`Portal ${suffix}`)}`);
    const systemsTable = page.getByRole('table', { name: 'Information Systems results', exact: true });
    await expect(systemsTable).toBeVisible();
    const systemHeaders = systemsTable.getByRole('columnheader');
    await expect(systemHeaders, 'ADMIN05_SYSTEM_OWNER_COLUMNS: header order').toHaveText([
      'Name', 'Owner', 'Business criticality', 'Type', 'Environment', 'Deployment model', 'Lifecycle', 'Internet-facing',
    ]);
    const systemsScroller = page.locator('[data-overflow]').filter({ has: systemsTable });
    const scrollerBox = await systemsScroller.boundingBox();
    expect(scrollerBox, 'ADMIN05_SYSTEM_OWNER_COLUMNS: the table region is laid out').not.toBeNull();
    for (const [index, header] of ['Name', 'Owner', 'Business criticality'].entries()) {
      const cell = systemHeaders.nth(index);
      await expect(cell, `ADMIN05_SYSTEM_OWNER_COLUMNS: ${header} is fully in view at 1440px`).toBeInViewport({ ratio: 1 });
      const box = await cell.boundingBox();
      expect(box && scrollerBox && box.x + box.width <= scrollerBox.x + scrollerBox.width + 1,
        `ADMIN05_SYSTEM_OWNER_COLUMNS: ${header} sits inside the table region without scrolling`).toBe(true);
    }
    await expect(systemsTable.getByRole('button', { name: 'Sort by Owner' })).toHaveCount(0);
    await expect(systemsTable.getByRole('button', { name: 'Sort by Business criticality' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page, 'ADMIN05_SYSTEM_OWNER_COLUMNS: no page overflow at 1440px');
    const systemRow = systemsTable.locator('tbody tr', { hasText: `Portal ${suffix}` });
    await expect(systemRow.getByRole('cell').nth(1), 'ADMIN05_SYSTEM_OWNER_COLUMNS: the owner reads by name').toHaveText('Jane Doe');
    await expect(systemRow.getByRole('cell').nth(2), 'ADMIN05_SYSTEM_OWNER_COLUMNS: the criticality reads as entered').toHaveText('High');

    await expectFocusVisible(page.getByRole('link', { name: 'Create Information System' }));
    await expectNoSeriousAxeViolations(page);

    await signOutAndEstablishRequestorBaseline(page);
    await expectDeniedWithoutDisclosure(page, [
      '/app/admin/information-systems', '/app/admin/information-systems/new',
      '/app/admin/information-systems/not-a-record', '/app/admin/information-systems/import',
      '/app/admin/information-assets', '/app/admin/information-assets/new',
      '/app/admin/information-assets/not-a-record', '/app/admin/information-assets/import',
    ], new RegExp(`Portal ${suffix}|Records ${suffix}`, 'i'));
  });
});

test.describe.serial('@administration-imports CSV administration imports', () => {
  test('Bob confirms a five-way preview and receives safe persisted results @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const suffix = recordSuffix();
    // The import runs at the project's width: its preview is a table at 1440 and cards at 375.
    const primary = primaryViewport(testInfo);
    const mobile = primary.width < 768;
    const previewRecord = (naturalKey: string): Locator => (mobile
      ? page.locator('[data-slot="csv-import-mobile"]').getByRole('article').filter({ hasText: naturalKey })
      : page.getByRole('row').filter({ hasText: naturalKey }));
    // Every document the journey loads, for both actors, runs under the production CSP with no violation (D-19).
    await attachCspCollector(page);
    await establishAnalystBaseline(page, request, primary);
    const updateName = `CSV Update ${suffix}`;
    const unchangedName = `CSV Unchanged ${suffix}`;
    for (const [name, description] of [[updateName, 'original row'], [unchangedName, 'existing value']] as const) {
      await page.goto('/app/admin/risk-types/new');
      await page.getByLabel('Name').fill(name);
      await page.getByLabel('Description').fill(description);
      await page.getByRole('button', { name: 'Create Risk Type' }).click();
      await expect(page.getByText('Risk Type created.')).toBeVisible();
    }
    await page.goto('/app/admin/risk-types/import');
    await expect(page.getByRole('heading', { name: 'Import Risk Types from CSV' })).toBeVisible();
    await expect(page.getByText('Review and validate every row before any records are created or updated.')).toBeVisible();

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page, `Risk Type import has no page overflow at ${width}px`);
      // The Guidance table renders at every width, so its region follows its overflow from 375px.
      await expectRegionFollowsOverflow(page, 'Risk Type CSV columns', `Risk Type import Guidance at ${width}px`);
    }

    // Every import page fits 375px: the template pill names no collection (UI-SPEC section 11
    // addendum) and the column guidance scrolls only inside its own labelled region.
    await page.setViewportSize({ width: 375, height: 812 });
    for (const collection of [
      { route: 'risk-types', plural: 'Risk Types', label: 'Risk Type' },
      { route: 'controls', plural: 'Controls', label: 'Control' },
      { route: 'information-systems', plural: 'Information Systems', label: 'Information System' },
      { route: 'information-assets', plural: 'Information Assets', label: 'Information Asset' },
    ] as const) {
      await page.goto(`/app/admin/${collection.route}/import`);
      await expect(page.getByRole('heading', { level: 1, name: `Import ${collection.plural} from CSV` })).toBeVisible();
      await expectNoHorizontalOverflow(page, `${collection.plural} import has no page overflow at 375px`);
      const template = page.getByRole('button', { name: 'Download CSV template', exact: true });
      await expect(template, `${collection.plural} import offers the CSV template`).toBeVisible();
      const templateBox = await template.boundingBox();
      expect((templateBox?.x ?? 0) + (templateBox?.width ?? Number.POSITIVE_INFINITY), `${collection.plural} template button stays inside 375px`).toBeLessThanOrEqual(375);
      const overflow = await expectRegionFollowsOverflow(page, `${collection.label} CSV columns`, `${collection.plural} import Guidance at 375px`);
      if (overflow === 'true') {
        await expect(page.getByRole('region', { name: `${collection.label} CSV columns, scrolls horizontally`, exact: true }), `${collection.plural} Guidance region keeps focus while it scrolls`).toBeFocused();
      }
      // The 2026-09-24 baseline found axe scrollable-region-focusable on three of these pages at 375.
      await expectNoSeriousAxeViolations(page);
      test.info().annotations.push({ type: 'CSV columns data-overflow at 375', description: `${collection.route}: ${overflow}` });
    }
    await page.setViewportSize(primary);
    await page.goto('/app/admin/risk-types/import');
    await expect(page.getByRole('heading', { name: 'Import Risk Types from CSV' })).toBeVisible();
    await expectFocusVisible(page.getByRole('button', { name: 'Choose CSV file' }));
    await expectNoSeriousAxeViolations(page);

    const csv = [
      'name,description',
      `CSV Create ${suffix},new row`,
      `${updateName},updated row`,
      `${unchangedName},existing value`,
      ',missing required name',
      `Ambiguous ${suffix},normalized collision one`,
      ` ambiguous ${suffix} ,normalized collision two`,
    ].join('\r\n');
    await page.getByRole('button', { name: 'Choose CSV file' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: `risk-types-${suffix}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Validate and preview' }).click();
    for (const [state, count] of [['Create', 1], ['Update', 1], ['Unchanged', 1], ['Rejected', 1], ['Ambiguous', 2]] as const) {
      await expect(page.getByRole('button', { name: `${state} (${count})` })).toBeVisible();
    }
    const createRecord = previewRecord(`CSV Create ${suffix}`).filter({ hasText: 'Create' });
    await expect(createRecord, `the create row is previewed at ${primary.width}px`).toBeVisible();
    await expect(createRecord.locator('[data-slot="badge"]')).toHaveText('Create');
    const unchangedRecord = previewRecord(unchangedName).filter({ hasText: 'Unchanged' });
    await expect(unchangedRecord, `the unchanged row is previewed at ${primary.width}px`).toBeVisible();
    await expect(unchangedRecord.locator('[data-slot="badge"]')).toHaveText('Unchanged');
    const errorDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download error report CSV' }).click();
    expect((await errorDownload).suggestedFilename()).toBe('risk-types-errors.csv');
    await page.getByRole('button', { name: 'Continue to confirmation' }).click();
    await expect(page.getByText(/1 unchanged/i)).toBeVisible();
    await page.getByRole('checkbox', { name: 'I have reviewed the create and update rows.' }).click();
    await page.getByRole('button', { name: 'Confirm import' }).click();
    await expect(page.getByRole('heading', { name: 'Import completed with rejected rows' })).toBeFocused();
    for (const result of ['Created 1', 'Updated 1', 'Unchanged 1', 'Rejected 1', 'Ambiguous 2']) {
      await expect(page.getByText(result, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'View record' })).toHaveCount(2);
    const resultDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download result report CSV' }).click();
    expect((await resultDownload).suggestedFilename()).toBe('risk-types-results.csv');
    await expect(page).not.toHaveURL(/name=|description=|CSV%20Create/i);

    await page.getByRole('button', { name: 'Import another CSV' }).click();
    await page.getByRole('button', { name: 'Choose CSV file' }).click();
    const ambiguousOnly = [
      'name,description',
      `Zero write ${suffix},first`,
      ` zero write ${suffix} ,second`,
    ].join('\r\n');
    await page.locator('input[type="file"]').setInputFiles({ name: `ambiguous-${suffix}.csv`, mimeType: 'text/csv', buffer: Buffer.from(ambiguousOnly) });
    await page.getByRole('button', { name: 'Validate and preview' }).click();
    await expect(page.getByRole('button', { name: 'Ambiguous (2)' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'No rows are ready to import.' })).toContainText('No rows are ready to import.');
    await expect(page.getByRole('button', { name: 'Continue to confirmation' })).toBeDisabled();

    await signOutAndEstablishRequestorBaseline(page);
    await expectDeniedWithoutDisclosure(page, [
      '/app/admin/risk-types/import', '/app/admin/controls/import',
      '/app/admin/information-systems/import', '/app/admin/information-assets/import',
    ], new RegExp(`CSV Create ${suffix}|Zero write ${suffix}`, 'i'));
    await expectNoCspViolations(page, 'the CSV import journey');
  });
});
