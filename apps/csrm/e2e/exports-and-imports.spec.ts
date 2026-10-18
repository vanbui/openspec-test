import { readFileSync, writeFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { strapiHealthUrl } from './harness-urls';
import { signInAs, type SignInRole } from './helpers/navigation';
import { expectNoSeriousViolations } from './helpers/request-collaboration';
import { createSubmittedRequest } from './helpers/requests';

/*
 * Phase 19 end to end (D-39; ROADMAP Phase 19 criterion 1; 19-UI-SPEC §1, §2): the exports and imports a person uses.
 * Each journey works only on records it creates, titled with a `{Date.now().toString(36)}-{project name}` suffix, so the
 * desktop (1440) and mobile (375) projects share one database without touching each other or any seed; the tests meant
 * to run at 375 carry @journey. Later plans (19-10, 19-11, 19-15) add their journeys here. The deterministic providers
 * run throughout (playwright.config.ts).
 */

async function switchTo(page: Page, role: SignInRole): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, role);
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: label }).toBe(true);
}

/*
 * The questionnaire and deterministic-draft steps of risk-curation.spec.ts's draftUatALike, copied here (that spec is
 * not edited): an analyst generates and releases the questionnaire, the Requestor answers the deterministic provider's
 * seven questions and submits, and the analyst generates the draft. Returns the draft editor's path.
 */
async function draftRequest(page: Page, requestId: string): Promise<string> {
  await switchTo(page, 'Security Analyst');
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

  await switchTo(page, 'Requestor');
  await page.goto(`/app/questionnaires/${encodeURIComponent(questionnaireId)}`);
  await page.getByRole('textbox', { name: /^What security outcomes matter most/ }).fill('Customer records must not be changed or read by anyone outside the service team.');
  await page.getByRole('group', { name: /^Is the stated business criticality/ }).getByRole('radio', { name: 'High', exact: true }).check();
  await page.getByRole('group', { name: /^Is an external provider involved\?/ }).getByRole('radio', { name: 'Yes', exact: true }).check();
  await page.getByRole('textbox', { name: /^What does the external provider do\?/ }).fill('The hosting partner operates the platform and its backups.');
  await page.getByRole('textbox', { name: /^How is .* protected\?/ }).fill('Access is limited to the service team, and data is encrypted in storage and in transfer.');
  await page.getByRole('group', { name: /^Has recovery been tested\?/ }).getByRole('radio', { name: 'Not sure', exact: true }).check();
  await page.getByRole('button', { name: 'Submit questionnaire' }).click();
  await page.getByRole('alertdialog', { name: 'Submit this questionnaire?' }).getByRole('button', { name: 'Submit questionnaire' }).click();
  await expect(page.getByText('Questionnaire submitted.')).toBeVisible();

  await switchTo(page, 'Security Analyst');
  await page.goto(`/app/review/requests/${encodeURIComponent(requestId)}`);
  await page.getByRole('button', { name: 'Generate assessment draft' }).click();
  const open = page.getByRole('link', { name: 'Open assessment draft' });
  await expect(open).toBeVisible({ timeout: 60_000 });
  return String(await open.getAttribute('href'));
}

/* Opens the register's export dialog from the header and waits for it. */
async function openRegisterExport(page: Page) {
  await page.getByRole('button', { name: 'Export Risk register' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Risk register' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('the Risk register export', () => {
  test('register export @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(900_000);
    const health = await request.get(strapiHealthUrl);
    if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const suffix = `${Date.now().toString(36)}-${testInfo.project.name}`;
    const token = `export-${suffix}`;
    const statement = `=HYPERLINK("https://example.test/${token}","Click")`;

    const editorPath = await test.step('the journey raises, submits and drafts its own request', async () => {
      await switchTo(page, 'Requestor');
      const submitted = await createSubmittedRequest(page, { title: `Register export ${suffix}`, assessmentType: 'Project', businessCriticality: 'High', dueDate: null });
      return draftRequest(page, submitted.documentId);
    });

    await test.step('Bob sets one drafted Risk’s statement to a formula-like value', async () => {
      await page.goto(editorPath);
      await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
      const riskForm = page.getByRole('region', { name: 'Identified Risks' }).locator('form').first();
      await riskForm.getByRole('textbox', { name: 'Risk statement' }).fill(statement);
      const saved = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/app/review/assessments/'));
      await riskForm.getByRole('button', { name: 'Save risk' }).click();
      expect((await saved).ok(), 'the statement is saved').toBe(true);
      await expect(riskForm.getByRole('status').filter({ hasText: /^Risk saved at / })).toBeVisible();
    });

    await test.step('Bob exports the filtered register as a workbook', async () => {
      await page.goto(`/app/risks?q=${encodeURIComponent(token)}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Risk register' })).toBeVisible();
      // The table row from 768px, the card below it: whichever this width shows.
      await expect(page.getByText(statement, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      const dialog = await openRegisterExport(page);
      await expect(dialog.getByText('1 risk that matches the current search and filters, in the current order.')).toBeVisible();
      await expect(dialog.getByText(`Search: “${token}”`)).toBeVisible();
      await expect(dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toBeChecked();
      await expect(dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toBeFocused();
      await expectNoOverflow(page, `the export dialog has no horizontal overflow at ${page.viewportSize()?.width}px`);
      // 19-UI-REVIEW UI-06: the rendered dialog (the full-screen sheet at 375), kept in the git-ignored test output.
      await page.screenshot({ path: testInfo.outputPath(`export-dialog-${testInfo.project.name}.png`), fullPage: true });

      const download = page.waitForEvent('download');
      const started = Date.now();
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const workbook = await download;
      // The time from Export file to the browser's download, recorded for the plan's summary.
      const elapsed = Date.now() - started;
      testInfo.annotations.push({ type: 'one-row export time (ms)', description: String(elapsed) });
      console.log(`EXPORT_ONE_ROW_MS[${testInfo.project.name}]=${elapsed}`);
      const name = workbook.suggestedFilename();
      expect(name).toMatch(/^risk-register-\d{4}-\d{2}-\d{2}\.xlsx$/);
      const bytes = readFileSync(await workbook.path());
      expect(bytes.subarray(0, 2).toString('latin1'), 'the workbook is a ZIP package').toBe('PK');
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${name}` })).toBeVisible();
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: '1 row.' })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Export Risk register' })).toBeFocused();
    });

    await test.step('Bob exports the same view as CSV, with the formula-like statement quoted and marked', async () => {
      const dialog = await openRegisterExport(page);
      await dialog.getByRole('radio', { name: 'CSV (.csv)' }).click();
      await expect(dialog.getByRole('radio', { name: 'CSV (.csv)' })).toBeChecked();
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const csv = await download;
      expect(csv.suggestedFilename()).toMatch(/^risk-register-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = readFileSync(await csv.path());
      expect([...bytes.subarray(0, 3)], 'the CSV starts with the UTF-8 byte order mark').toEqual([0xef, 0xbb, 0xbf]);
      expect(bytes.toString('utf8')).toContain(`"'=HYPERLINK(""https://example.test/${token}"",""Click"")"`);
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${csv.suggestedFilename()}` })).toBeVisible();
    });
  });

  test('register export refused to a Requestor @journey', async ({ page }) => {
    await switchTo(page, 'Requestor');
    await page.goto('/app/risks');
    await expect(page.getByRole('heading', { level: 1, name: 'Risk register' })).toBeVisible();
    await expect(page.getByText('You don’t have access to the Risk register').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Risk register' })).toHaveCount(0);
  });
});

/* Opens a header's export dialog by its accessible name and waits for it. */
async function openExport(page: Page, heading: string) {
  await page.getByRole('button', { name: `Export ${heading}` }).click();
  const dialog = page.getByRole('dialog', { name: `Export ${heading}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

/*
 * 19-11 (D-04, D-16, D-20, D-22, D-39): every list a person can see exports from its page through the same dialog. These
 * journeys only read: a report computed from current records and Jane's own requests, so both projects can run them
 * against one database.
 */
test.describe('the list exports', () => {
  test('list exports @journey', async ({ page, request }) => {
    test.setTimeout(300_000);
    const health = await request.get(strapiHealthUrl);
    if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await test.step('Bob exports one table of Risk exposure as CSV', async () => {
      await switchTo(page, 'Security Analyst');
      await page.goto('/app/reports/risk-exposure');
      await expect(page.getByRole('heading', { level: 1, name: 'Risk exposure' })).toBeVisible();
      const dialog = await openExport(page, 'Risk exposure');
      await expect(dialog.getByText(/^The Risk exposure report as at .+, with its 4 tables\.$/)).toBeVisible();
      await expect(dialog.getByText('Every column of each table is included, as on the page.')).toBeVisible();
      await expect(dialog.getByRole('group', { name: /Columns/ })).toHaveCount(0);
      await dialog.getByRole('radio', { name: 'CSV (.csv)' }).click();
      const table = dialog.getByRole('radiogroup', { name: 'Table' });
      await expect(table.getByRole('radio')).toHaveCount(4);
      await table.getByRole('radio', { name: 'Residual rating by treatment status' }).click();
      await expect(table.getByRole('radio', { name: 'Residual rating by treatment status' })).toBeChecked();
      await expectNoOverflow(page, `the report export dialog has no horizontal overflow at ${page.viewportSize()?.width}px`);

      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const csv = await download;
      expect(csv.suggestedFilename()).toMatch(/^risk-exposure-residual-rating-by-treatment-status-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = readFileSync(await csv.path());
      expect([...bytes.subarray(0, 3)], 'the CSV starts with the UTF-8 byte order mark').toEqual([0xef, 0xbb, 0xbf]);
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${csv.suggestedFilename()}` })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Export Risk exposure' })).toBeFocused();
    });

    await test.step('Jane exports My requests as a workbook', async () => {
      await switchTo(page, 'Requestor');
      await page.goto('/app/requests');
      await expect(page.getByRole('heading', { level: 1, name: 'My requests' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'New request' }).filter({ visible: true }).first()).toBeVisible();
      const dialog = await openExport(page, 'My requests');
      await expect(dialog.getByRole('group', { name: /Columns/ })).toBeVisible();
      // The format is remembered per browser: Bob's CSV choice above is kept, so the workbook is chosen here.
      await dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' }).click();
      await expect(dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toBeChecked();
      await expectNoOverflow(page, `the My requests export dialog has no horizontal overflow at ${page.viewportSize()?.width}px`);

      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const workbook = await download;
      expect(workbook.suggestedFilename()).toMatch(/^my-requests-\d{4}-\d{2}-\d{2}\.xlsx$/);
      const bytes = readFileSync(await workbook.path());
      expect(bytes.subarray(0, 2).toString('latin1'), 'the workbook is a ZIP package').toBe('PK');
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${workbook.suggestedFilename()}` })).toBeVisible();
      await expect(dialog).toBeHidden();
    });
  });

  test('analyst exports refused to a Requestor @journey', async ({ page }) => {
    await switchTo(page, 'Requestor');

    await page.goto('/app/alerts');
    await expect(page.getByRole('heading', { level: 1, name: 'Alerts' })).toBeVisible();
    await expect(page.getByText('You don’t have access to alerts').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Export/ })).toHaveCount(0);

    await page.goto('/app/review/requests');
    await expect(page.getByRole('heading', { level: 1, name: 'Requests' })).toBeVisible();
    await expect(page.getByText('You don’t have access to assessment requests').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Export/ })).toHaveCount(0);
  });
});

/*
 * 19-12 (ROADMAP Phase 19 criteria 2 and 6; D-14 to D-16, D-21, D-23, D-24, D-39): Jane's seeded released assessment as a
 * file and as paper, and another Requestor refused both. These journeys only read the seed, so both projects run them.
 */
const janesAssessmentNumber = 'ASM-E2E-NAV-OWNER-001';

/* The seeded released assessment's path, read from Jane's My risk assessments at whatever width this project has. */
async function janesReleasedAssessmentPath(page: Page): Promise<string> {
  await page.goto('/app/assessments');
  const link = page.getByRole('main').getByRole('link', { name: janesAssessmentNumber, exact: true }).filter({ visible: true }).first();
  await expect(link, 'My risk assessments lists the seeded released assessment').toBeVisible();
  const href = await link.getAttribute('href');
  expect(href, 'the assessment links to its record').toMatch(/^\/app\/assessments\/[^/?#]+$/);
  return href!;
}

async function expectStrapiHealthy(request: { get: (url: string) => Promise<{ ok: () => boolean; status: () => number }> }): Promise<void> {
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
}

test.describe('the released assessment', () => {
  test('released assessment export @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);
    await expectStrapiHealthy(request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await switchTo(page, 'Requestor');
    const path = await janesReleasedAssessmentPath(page);

    await test.step('Jane’s released view offers Print report, then Export', async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: 'Released risk assessment' })).toBeVisible();
      const print = page.getByRole('link', { name: 'Print report' });
      const exportButton = page.getByRole('button', { name: `Export ${janesAssessmentNumber}` });
      await expect(print).toBeVisible();
      await expect(exportButton).toBeVisible();
      await expect(print).toHaveAttribute('href', `${path}/report`);
      const printFirst = await print.evaluate((link, name) => {
        const button = [...document.querySelectorAll('button')].find((candidate) => candidate.getAttribute('aria-label') === name);
        return Boolean(button && link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, `Export ${janesAssessmentNumber}`);
      expect(printFirst, 'Print report comes before Export in the header').toBe(true);
      await expectNoOverflow(page, `the released view has no horizontal overflow at ${page.viewportSize()?.width}px`);
    });

    await test.step('Jane exports her released assessment as a workbook', async () => {
      const dialog = await openExport(page, janesAssessmentNumber);
      await expect(dialog.getByText(new RegExp(`^${janesAssessmentNumber} as released: its summary, \\d+ risks? and \\d+ mitigation controls?\\.$`))).toBeVisible();
      await expect(dialog.getByRole('group', { name: /Columns/ })).toHaveCount(0);
      await dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' }).click();
      await expect(dialog.getByRole('radio', { name: 'Excel workbook (.xlsx)' })).toBeChecked();
      await expectNoOverflow(page, `the released export dialog has no horizontal overflow at ${page.viewportSize()?.width}px`);
      await page.screenshot({ path: testInfo.outputPath(`released-export-dialog-${testInfo.project.name}.png`), fullPage: true });

      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const workbook = await download;
      expect(workbook.suggestedFilename()).toMatch(/^[a-z0-9-]+-risk-assessment-\d{4}-\d{2}-\d{2}\.xlsx$/);
      expect(workbook.suggestedFilename().startsWith(janesAssessmentNumber.toLowerCase())).toBe(true);
      const bytes = readFileSync(await workbook.path());
      expect(bytes.subarray(0, 2).toString('latin1'), 'the workbook is a ZIP package').toBe('PK');
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${workbook.suggestedFilename()}` })).toBeVisible();
      await expect(dialog).toBeHidden();
    });

    await test.step('Jane exports its Mitigation controls as CSV', async () => {
      const dialog = await openExport(page, janesAssessmentNumber);
      await dialog.getByRole('radio', { name: 'CSV (.csv)' }).click();
      const table = dialog.getByRole('radiogroup', { name: 'Table' });
      await expect(table.getByRole('radio')).toHaveCount(2);
      await table.getByRole('radio', { name: 'Mitigation controls' }).click();
      await expect(table.getByRole('radio', { name: 'Mitigation controls' })).toBeChecked();

      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export file' }).click();
      const csv = await download;
      expect(csv.suggestedFilename()).toMatch(/^[a-z0-9-]+-mitigation-controls-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = readFileSync(await csv.path());
      expect([...bytes.subarray(0, 3)], 'the CSV starts with the UTF-8 byte order mark').toEqual([0xef, 0xbb, 0xbf]);
      await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])').filter({ hasText: `Exported ${csv.suggestedFilename()}` })).toBeVisible();
    });
  });

  test('released assessment refused to another Requestor @journey', async ({ page, request }) => {
    test.setTimeout(180_000);
    await expectStrapiHealthy(request);
    await switchTo(page, 'Requestor');
    const path = await janesReleasedAssessmentPath(page);

    await switchTo(page, 'Secondary Requestor');
    for (const route of [path, `${path}/report`]) {
      await page.goto(route);
      // In the shell at both widths: the not-found renders inside the shell's main landmark (the sidebar is a drawer at 375).
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Page not found' }), `${route} is the in-shell not-found`).toBeVisible();
      await expect(page.locator('.shell'), `${route} keeps the shell`).toBeAttached();
      await expect(page.getByRole('link', { name: 'Print report' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Export/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toHaveCount(0);
      await expect(page.getByText(janesAssessmentNumber)).toHaveCount(0);
    }
  });

  test('print report @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    await expectStrapiHealthy(request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await switchTo(page, 'Requestor');
    const path = await janesReleasedAssessmentPath(page);
    await page.goto(path);
    await page.getByRole('link', { name: 'Print report' }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/report$`));
    await expect(page).toHaveTitle(`Print report ${janesAssessmentNumber} | IdamBox CSRM`);

    const toolbarTitle = page.getByRole('heading', { level: 1, name: 'Print report' });
    const reportDocument = page.locator('[data-report-document]');
    await expect(toolbarTitle).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the risk assessment' })).toHaveAttribute('href', path);
    // UI-05: on screen the toolbar holds the one h1, and the document title is an h2 under it.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(reportDocument.getByRole('heading', { level: 2, name: 'Cyber security risk assessment' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`report-screen-${testInfo.project.name}.png`), fullPage: true });
    await expect(reportDocument.getByText(new RegExp(`^${janesAssessmentNumber} · `))).toBeVisible();
    await expect(reportDocument.getByRole('heading', { level: 2, name: 'Notes' })).toBeVisible();
    await expect(reportDocument.getByText(/^This report shows the risk assessment as released\. Generated .+ \([A-Za-z_/+-]+\)\.$/)).toBeVisible();

    await test.step('in print the shell, the header and the toolbar are hidden and the document shows', async () => {
      await page.emulateMedia({ media: 'print' });
      for (const chrome of ['.sidebar', '.header', '.skip-link']) await expect(page.locator(chrome), `print drops ${chrome}`).toBeHidden();
      await expect(toolbarTitle).toBeHidden();
      await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden();
      await expect(reportDocument).toBeVisible();
      await expect(reportDocument.getByRole('heading', { level: 2, name: 'Risks overview' })).toBeVisible();
      // UI-05: on paper the document title is the one h1.
      await expect(reportDocument.getByRole('heading', { level: 1, name: 'Cyber security risk assessment' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath(`report-print-${testInfo.project.name}.png`), fullPage: true });
      await page.emulateMedia({ media: null });
    });

    if (testInfo.project.name === 'desktop') {
      await test.step('the report saves as an A4 PDF', async () => {
        const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, path: testInfo.outputPath('report-a4.pdf') });
        const text = pdf.toString('latin1');
        const pages = text.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
        expect(pages, 'the PDF holds at least one page').toBeGreaterThanOrEqual(1);
        testInfo.annotations.push({ type: 'report PDF pages', description: String(pages) });
        console.log(`REPORT_PDF_PAGES[${testInfo.project.name}]=${pages}`);
      });
    }

    await expectNoOverflow(page, `the report has no horizontal page scroll at ${page.viewportSize()?.width}px`);
    await expectNoSeriousViolations(page, `the report route at ${page.viewportSize()?.width}px`);
  });
});

/*
 * Phase 19 (19-15; ROADMAP criteria 3 to 5; D-25 to D-32, D-39): the import a spreadsheet user can trust. Each journey
 * works on its own Risk Types, named with the run's suffix, and every file it imports is written from bytes into the
 * test's output directory (Excel's default CSV is Windows-1252, written from a latin1 buffer). The admin lists keep
 * their records across runs, so a list is read back with `q=` set to the record the journey made (lane C I6).
 */

/** Opens the Risk Types import at its Select file step. */
async function openRiskTypeImport(page: Page): Promise<void> {
  await page.goto('/app/admin/risk-types/import');
  await expect(page.getByRole('heading', { level: 1, name: 'Import Risk Types', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose file' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Select file' })).toBeVisible();
}

/** Writes a file into the test's output directory and returns its path. */
function writeImportFile(testInfo: TestInfo, name: string, bytes: Buffer): string {
  const path = testInfo.outputPath(name);
  writeFileSync(path, bytes);
  return path;
}

/** Chooses the file on the Select file step and asks Strapi to check it. */
async function checkImportFile(page: Page, path: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(path);
  await page.getByRole('button', { name: 'Validate and preview' }).click();
}

const activeToast = (page: Page) => page.locator('[data-sonner-toast]:not([data-removed="true"])');

async function startImportJourney(page: Page, request: APIRequestContext): Promise<void> {
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await switchTo(page, 'Security Analyst');
}

/** Creates a Risk Type through its form, as Bob would. */
async function createRiskType(page: Page, name: string, description: string): Promise<void> {
  await page.goto('/app/admin/risk-types/new');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create Risk Type' }).click();
  await expect(page.getByText('Risk Type created.')).toBeVisible();
}

test.describe('the tolerant import', () => {
  test('import tolerance @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    await startImportJourney(page, request);
    const suffix = `${Date.now().toString(36)}-${testInfo.project.name}`;

    await test.step('Bob imports the UAT’s Name file with an Owner column and is told Owner will be ignored (criterion 3)', async () => {
      await openRiskTypeImport(page);
      const path = writeImportFile(testInfo, `uat-051-${suffix}.csv`, Buffer.from(`Name,Description,Owner\r\nTolerance ${suffix},Imported with an Owner column,Bob\r\n`, 'utf8'));
      await checkImportFile(page, path);
      await expect(page.getByRole('heading', { level: 2, name: 'Review rows' })).toBeVisible();
      const ignored = page.getByRole('alert').filter({ hasText: 'Some columns will be ignored' });
      await expect(ignored).toContainText('These columns aren’t part of the Risk Type import: “Owner”. Their values won’t be imported.');
      await expect(page.getByRole('button', { name: 'Create (1)' })).toBeVisible();
      await expectNoOverflow(page, `the review with ignored columns has no horizontal page scroll at ${page.viewportSize()?.width}px`);
    });

    await test.step('Excel’s default CSV gets Save the file as CSV UTF-8 with three steps, and the file stays chosen', async () => {
      await page.getByRole('button', { name: 'Back to file selection' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Select file' })).toBeVisible();
      const fileName = `excel-default-${suffix}.csv`;
      const path = writeImportFile(testInfo, fileName, Buffer.from(`Name,Description\r\nCafé ${suffix},Résumé des risques\r\n`, 'latin1'));
      await checkImportFile(page, path);
      const title = page.getByText('Save the file as CSV UTF-8', { exact: true });
      await expect(title).toBeFocused();
      // FE4-03: the focused refusal is no live region (accessibility contract 4.1.3), so it is found by its slot.
      const alert = page.locator('[data-slot="alert"]').filter({ has: title });
      await expect(alert).not.toHaveAttribute('role', 'alert');
      await expect(alert).toContainText('This file is in Excel’s older “CSV (Comma delimited)” format, which can garble names with accents or symbols.');
      await expect(alert.getByRole('listitem')).toHaveText([
        '1. In Excel, choose File > Save As.',
        '2. Choose “CSV UTF-8 (Comma delimited) (*.csv)” and save.',
        '3. Choose the new file here. Or upload the Excel workbook (.xlsx) itself.',
      ]);
      await expect(alert.getByRole('button', { name: 'Choose another file' })).toBeVisible();
      await expect(page.getByText(`${fileName} · `, { exact: false })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Select file' })).toBeVisible();
      await expectNoOverflow(page, `the refused file has no horizontal page scroll at ${page.viewportSize()?.width}px`);
      await expectNoSeriousViolations(page, `the refused import file at ${page.viewportSize()?.width}px`);
    });
  });

  test('error report round trip @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    await startImportJourney(page, request);
    const suffix = `${Date.now().toString(36)}-${testInfo.project.name}`;
    const fixedName = `Round trip fixed ${suffix}`;
    const marker = `needs a name ${suffix}`;
    let reportText = '';
    let reportName = '';

    await test.step('Bob downloads the error report for a file with one rejected row (criterion 4)', async () => {
      await openRiskTypeImport(page);
      const path = writeImportFile(testInfo, `round-trip-${suffix}.csv`, Buffer.from(`Name,Description\r\nRound trip kept ${suffix},first row\r\n,${marker}\r\n`, 'utf8'));
      await checkImportFile(page, path);
      await expect(page.getByRole('button', { name: 'Rejected (1)' })).toBeVisible();
      await expect(page.getByText('The rows that weren’t imported, exactly as in your file, with an Issues column. Correct them and import the file again.')).toBeVisible();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download error report' }).click();
      const report = await download;
      reportName = report.suggestedFilename();
      expect(reportName).toMatch(/^risk-types-import-issues-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = readFileSync(await report.path());
      expect([...bytes.subarray(0, 3)], 'the report starts with the UTF-8 byte order mark').toEqual([0xef, 0xbb, 0xbf]);
      reportText = bytes.toString('utf8');
      expect(reportText).toContain(marker);
      expect(reportText).toContain('Issues');
      expect(reportText).not.toContain(`Round trip kept ${suffix}`);
      await expect(activeToast(page).filter({ hasText: `Downloaded ${reportName}` })).toBeVisible();
      await expect(activeToast(page).filter({ hasText: '1 row to correct.' })).toBeVisible();
    });

    await test.step('Bob corrects the empty name in the saved file and imports it again', async () => {
      // The report writes each cell as typed and may quote it (`"","needs a name …"`): fill the empty Name cell either way.
      const corrected = reportText.replace(new RegExp(`(\\r?\\n)(?:"")?,("?${marker})`), `$1"${fixedName}",$2`);
      expect(corrected, 'the rejected row was found and corrected').not.toBe(reportText);
      const path = writeImportFile(testInfo, reportName, Buffer.from(corrected, 'utf8'));
      await page.getByRole('button', { name: 'Back to file selection' }).click();
      await checkImportFile(page, path);
      await expect(page.getByRole('heading', { level: 2, name: 'Review rows' })).toBeVisible();
      await expect(page.getByText('The Issues column from an error report is ignored.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create (1)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rejected (0)' })).toBeVisible();
      await page.getByRole('button', { name: 'Continue to confirmation' }).click();
      await page.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }).click();
      await page.getByRole('button', { name: 'Confirm import' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Import complete' })).toBeFocused();
      await expect(page.getByText('Created 1', { exact: true })).toBeVisible();
    });

    await test.step('the corrected row is a stored Risk Type', async () => {
      await page.goto(`/app/admin/risk-types?q=${encodeURIComponent(fixedName)}`);
      await expect(page.getByText(fixedName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    });
  });

  test('similar name held @journey', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    await startImportJourney(page, request);
    const suffix = `${Date.now().toString(36)}-${testInfo.project.name}`;
    const stored = `UAT-B Similar ${suffix}`;
    const updated = `Updated by the import ${suffix}`;
    await createRiskType(page, stored, 'The stored description');

    await test.step('a lower-case copy of the stored name is held with nothing chosen (criterion 5)', async () => {
      await openRiskTypeImport(page);
      const path = writeImportFile(testInfo, `similar-${suffix}.csv`, Buffer.from(`name,description\r\n${stored.toLowerCase()},${updated}\r\n`, 'utf8'));
      await checkImportFile(page, path);
      await expect(page.getByRole('button', { name: 'Matched by similar name (1)' })).toBeVisible();
      // UI-02: the panel stays on screen, so it is no alert; its count is the polite live region.
      const panel = page.locator('[data-slot="alert"]').filter({ hasText: '1 row matches an existing name only by capitals or spacing' });
      await expect(panel).not.toHaveAttribute('role', 'alert');
      await expect(panel).toContainText('0 of 1 decided');
      const group = page.getByRole('radiogroup', { name: 'Decision for row 2' }).filter({ visible: true });
      await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(page.getByText(`Similar to the existing Risk Type “${stored}”.`).filter({ visible: true })).toBeVisible();
    });

    await test.step('the gate refuses to continue, says how many rows wait and moves focus to the row', async () => {
      await page.getByRole('button', { name: 'Continue to confirmation' }).click();
      await expect(page.getByText('Choose Update or Skip for 1 more row.')).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Review rows' })).toBeVisible();
      const group = page.getByRole('radiogroup', { name: 'Decision for row 2' }).filter({ visible: true });
      await expect(group.getByRole('radio').first()).toBeFocused();
    });

    await test.step('Bob chooses Update and confirms; the stored name is kept', async () => {
      const group = page.getByRole('radiogroup', { name: 'Decision for row 2' }).filter({ visible: true });
      await group.getByRole('radio', { name: `Update “${stored}”` }).click();
      await expect(page.getByText('1 of 1 decided')).toBeVisible();
      await expect(page.getByText('Your choice: Update').filter({ visible: true })).toBeVisible();
      await expectNoOverflow(page, `the similar-name decision has no horizontal page scroll at ${page.viewportSize()?.width}px`);
      await page.screenshot({ path: testInfo.outputPath(`import-decisions-${testInfo.project.name}.png`), fullPage: true });
      await expectNoSeriousViolations(page, `the similar-name review at ${page.viewportSize()?.width}px`);
      await page.getByRole('button', { name: 'Continue to confirmation' }).click();
      await expect(page.getByText(/including 1 matched by similar name/)).toBeVisible();
      await page.getByRole('checkbox', { name: 'I have reviewed the rows to create and update.' }).click();
      await page.getByRole('button', { name: 'Confirm import' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Import complete' })).toBeFocused();
      await expect(page.getByText('Updated 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Created 0', { exact: true })).toBeVisible();
    });

    await test.step('the list, searched for the record, shows the stored name with the imported description', async () => {
      await page.goto(`/app/admin/risk-types?q=${encodeURIComponent(stored)}`);
      await expect(page.getByText(stored, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(stored.toLowerCase(), { exact: true })).toHaveCount(0);
      await expect(page.getByText(updated).filter({ visible: true }).first()).toBeVisible();
    });
  });
});
