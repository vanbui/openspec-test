import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';

const suffix = `dylan-test-${process.pid}`;
const viewports = [375, 768, 1280, 1440] as const;

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth, label).toBeLessThanOrEqual(geometry.viewportWidth);
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

async function signIn(page: Page, role: 'Requestor' | 'Security Analyst'): Promise<void> {
  const response = await page.goto('/sign-in?returnTo=/app');
  if (!response?.ok()) throw new Error(`AUTH_FIXTURE_SIGN_IN_UNAVAILABLE:${response?.status() ?? 'no-response'}`);
  await page.getByRole('button', { name: `Continue as ${role}` }).click();
  await expect(page, `BASELINE_${role === 'Requestor' ? 'REQUESTOR' : 'ANALYST'}_SHELL_URL`).toHaveURL(/\/app$/);
  await expect(page.getByRole('main'), 'BASELINE_SHELL_MAIN').toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' }), 'BASELINE_DASHBOARD').toBeVisible();
  await expect(page.getByRole('banner').getByText(role, { exact: true }), 'BASELINE_ACTOR_ROLE').toBeVisible();
}

async function establishAnalystBaseline(page: Page, request: APIRequestContext): Promise<void> {
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await signIn(page, 'Security Analyst');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByRole('navigation').getByText('Administration', { exact: true }),
    'Expected Administration navigation group to be visible',
  ).toBeVisible();
}

async function expectKeyboardFocus(locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  expect(await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
  })).toBe(true);
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
  await signIn(page, 'Requestor');
  await expect(page.getByRole('navigation').getByText('Administration', { exact: true })).toHaveCount(0);
}

test.describe.serial('@administration-risk-types Risk Type administration', () => {
  test('Bob creates and edits a reusable Risk Type while Jane learns no record facts', async ({ page, request }) => {
    test.setTimeout(180_000);
    await establishAnalystBaseline(page, request);

    await page.getByRole('link', { name: 'Risk Types', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Risk Types' })).toBeVisible();
    await page.getByRole('link', { name: 'Create Risk Type' }).click();
    const name = `Credential misuse ${suffix}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill('Reusable definition created by the isolated administration journey.');
    await page.getByRole('combobox', { name: /Applicable Controls/i }).click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Create Risk Type' }).click();
    await expect(page.getByText('Risk Type created.')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Risk Type' }).click();
    await page.getByLabel('Description').fill('Reusable definition edited and persisted by the administration journey.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.reload();
    await expect(page.getByText('Reusable definition edited and persisted by the administration journey.')).toBeVisible();
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
    }
    await expectKeyboardFocus(page.getByRole('link', { name: 'Create Control' }));
    await expectNoSeriousAxeViolations(page);

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
    await establishAnalystBaseline(page, request);

    for (const record of [
      { route: 'information-systems', singular: 'Information System', name: `Portal ${suffix}` },
      { route: 'information-assets', singular: 'Information Asset', name: `Records ${suffix}` },
    ]) {
      await page.goto(`/app/admin/${record.route}/new`);
      await page.getByLabel('Name').fill(record.name);
      await page.getByLabel('Description').fill(`Created ${record.singular} for the isolated journey.`);
      await page.getByRole('button', { name: `Create ${record.singular}` }).click();
      await expect(page.getByText(`${record.singular} created.`)).toBeVisible();
      await page.getByRole('button', { name: `Edit ${record.singular}` }).click();
      const persistedDescription = `Edited ${record.singular} and verified after reload.`;
      await page.getByLabel('Description').fill(persistedDescription);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.reload();
      await expect(page.getByText(persistedDescription)).toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    }

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/admin/information-systems');
      await expectNoHorizontalOverflow(page, `Information Systems has no page overflow at ${width}px`);
    }
    await expectKeyboardFocus(page.getByRole('link', { name: 'Create Information System' }));
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
  test('Bob confirms a five-way preview and receives safe persisted results', async ({ page, request }) => {
    test.setTimeout(180_000);
    await establishAnalystBaseline(page, request);
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
    }
    await expectKeyboardFocus(page.getByRole('button', { name: 'Choose CSV file' }));
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
    await expect(page.getByRole('row').filter({ hasText: `CSV Create ${suffix}` }).filter({ hasText: 'Create' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: unchangedName }).filter({ hasText: 'Unchanged' })).toBeVisible();
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
  });
});
