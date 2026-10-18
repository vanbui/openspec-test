import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  analystPath,
  expectLandedOn,
  expectNoHorizontalOverflow,
  expectNoneNewOnNextRender,
  expectNoSeriousViolations,
  expectStrapiHealthy,
  generateQuestionnaire,
  notesSection,
  noteWith,
  requestorPath,
  softly,
  summaryValue,
  switchTo,
  toastWith,
} from './helpers/request-collaboration';
import { chooseRelation, createCompleteDraftRequest, createDraftRequest, submitRequestFromItsPage } from './helpers/requests';

/*
 * Phase 14 (COLLAB-02; 14-UI-SPEC §1, §3): the files on a request. Every test runs at 1440 and, through `@journey` and
 * the mobile project's `testMatch`, at 375: each creates its own uniquely titled draft, so both projects can run it
 * against one database. Files are read from the Strapi suite's committed fixtures or built in memory; the only
 * malware test string any file here carries is CSRM's own signature (D-14), never the industry test string.
 *
 * The run's Strapi stores files under the run's own directory with the development scanner (playwright.config.ts),
 * so nothing reaches the working tree or a real scanner (D-39).
 */

const fixtures = join(__dirname, '..', '..', 'backend', 'tests', 'fixtures', 'attachments');

/** Jane creates a uniquely titled draft through the UI; the helper leaves her on its request page. */
async function janesDraft(page: Page, title: string): Promise<{ requestNumber: string; documentId: string }> {
  await switchTo(page, 'Requestor');
  const draft = await createDraftRequest(page, { title });
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  return draft;
}

function filesSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Files', exact: true });
}

/** Chooses files the way a person does: `Choose files` opens the browser's chooser (X-19), never a drag. */
async function chooseFiles(page: Page, files: Parameters<import('@playwright/test').FileChooser['setFiles']>[0]): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await filesSection(page).getByRole('button', { name: 'Choose files', exact: true }).click();
  await (await chooser).setFiles(files);
}

/**
 * The Files list's entry for a file: its table row or its card, whichever layout the list shows (§3.2, X-21). The cards
 * show below 768px and, from 768px, wherever the table would not fit the list's width (the pilot's walk, D2); the
 * hidden layout's entries are not found.
 */
function listedFile(page: Page, name: string, _width?: number): Locator {
  const files = filesSection(page);
  return files.getByRole('table', { name: 'Files', exact: true }).getByRole('row')
    .or(files.getByRole('list', { name: 'Files', exact: true }).getByRole('listitem'))
    .filter({ hasText: name });
}

/** Whether the Files list shows its table (from 768px where the table fits the list's width; D2), not its cards. */
async function tableShown(page: Page): Promise<boolean> {
  return filesSection(page).getByRole('table', { name: 'Files', exact: true }).isVisible();
}

/**
 * A target's laid-out size (WCAG 2.5.8; direction §4 Buttons, "touch targets ≥44px below 768px"): below 768px at least
 * `phoneMin` tall (the touch-target height unless a caller names the 24px target), from 768px at least 24px each way.
 * It polls, so a dialog's entrance (scale 0.95 to 1) is over before the size is judged, and logs what it measured.
 */
async function expectTargetSize(target: Locator, width: number | undefined, label: string, phoneMin = 44): Promise<{ width: number; height: number }> {
  const min = (width ?? 1440) < 768 ? phoneMin : 24;
  await expect.poll(async () => {
    const box = await target.boundingBox({ timeout: 1_000 }).catch(() => null);
    return box ? Math.min(box.height, box.width < 24 ? box.width : Infinity) : 0;
  }, { message: `${label}: at least ${min}px tall and 24px wide at ${width}px` }).toBeGreaterThanOrEqual(min);
  const box = (await target.boundingBox())!;
  console.log(`TARGET ${label}: ${Math.round(box.width)}x${Math.round(box.height)} at ${width}px`);
  return box;
}

/** Whether two laid-out boxes overlap. */
function overlapping(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * 14-UI-REVIEW UI-02 (the pilot's ruling; 14-UI-SPEC Motion, "Sheets: §5 'Drawer / side panel'; fade only under reduced
 * motion"; direction §3.11 `--duration-slower` 260ms and `--ease-out-expo`, §5 "Drawer / side panel | 260ms | expo |
 * Fade + short slide"): the motion the browser computes for an open sheet, by name, duration and curve. Under reduced
 * motion the entrance is the fade alone, which the global rule shortens. Logs what it read.
 */
async function expectDrawerMotion(sheet: Locator, entrance: 'drawer-in-bottom' | 'drawer-in-end' | 'drawer-fade-in', label: string): Promise<void> {
  const motion = await sheet.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration, easing: style.animationTimingFunction };
  });
  console.log(`MOTION ${label}: ${motion.name} ${motion.duration} ${motion.easing}`);
  expect(motion.name, `${label}: the sheet's entrance`).toBe(entrance);
  if (entrance !== 'drawer-fade-in') {
    expect(motion, `${label}: at the drawer duration on the expo curve`).toEqual({ name: entrance, duration: '0.26s', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }
}

/**
 * 14-UI-REVIEW UI-02: a sheet's entrance (its fade and short slide, §5 drawer motion) has ended, so what follows reads the
 * settled sheet. axe measures text contrast through an opacity that is still changing, as it does for a toast's entrance.
 */
async function sheetSettled(sheet: Locator): Promise<void> {
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  await expect(sheet, 'the sheet has finished its entrance').toHaveCSS('opacity', '1');
}

/**
 * WR-602 and the pilot's walk, D3 (X-14; 2.5.8): with a toast showing, the page passes axe, the toast's Close included,
 * and the toast is still there after the scan, so the scan saw it. The Close has the target size, and below 768px the
 * toast covers none of `controls` (an open actions sheet's), read once the toast's entrance has ended and judged after
 * the scan, so the timed toast is still showing while it is read.
 *
 * The scan reads the settled page: the toast's entrance fade (Sonner's 400ms, with its slide) and the list's pending
 * opacity (§5) have ended first, because axe measures text contrast through an opacity that is still changing.
 */
async function expectToastClear(page: Page, toast: Locator, controls: readonly Locator[], width: number | undefined, surface: string): Promise<void> {
  await expect(toast, `${surface}: the toast has finished its entrance`).toHaveCSS('opacity', '1');
  await expect.poll(
    () => page.evaluate(() => [...document.querySelectorAll('[data-pending]')].every((element) => getComputedStyle(element).opacity === '1')),
    { message: `${surface}: nothing on the page is still at the pending opacity` },
  ).toBe(true);
  const placements: { name: string; placement: string }[] = [];
  for (const control of controls) {
    const name = (await control.getAttribute('aria-label')) ?? (await control.textContent())?.trim() ?? 'a control';
    const [a, b] = await Promise.all([toast.boundingBox({ timeout: 5_000 }).catch(() => null), control.boundingBox({ timeout: 5_000 }).catch(() => null)]);
    placements.push({
      name,
      placement: !a || !b ? 'not on screen'
        : overlapping(a, b) ? `the toast (y ${Math.round(a.y)} to ${Math.round(a.y + a.height)}) covers it (y ${Math.round(b.y)} to ${Math.round(b.y + b.height)})` : 'clear',
    });
  }
  await expectNoSeriousViolations(page, `${surface} with the toast showing at ${width}px`);
  await expect(toast, `${surface}: the toast showed throughout the scan`).toBeVisible();
  await expectTargetSize(toast.getByRole('button', { name: 'Close toast', exact: true }), width, `${surface}: the toast’s Close`);
  for (const { name, placement } of placements) expect(placement, `${surface}: the toast clears ${name} at ${width}px`).toBe('clear');
}

/**
 * The pilot's walk, D1 (14-UI-SPEC §3.2, §6.1, §6.2, §7.1, §12; X-10; WCAG 2.4.3): follows a real link to a file, or to
 * the Files section, and checks it lands: the URL names the fragment, the target is in the viewport and focus is on it
 * (the file's row, its card at phone widths, or the Files heading).
 */
async function followAndLand(page: Page, link: Locator, label: string): Promise<string> {
  const href = (await link.getAttribute('href')) ?? '';
  const id = decodeURIComponent(href.slice(href.indexOf('#') + 1));
  await link.click();
  await expectLandedOn(page, id, page.locator(`[id="${id}"]`), label);
  return id;
}

/**
 * The pilot's walk, D2 (X-21; 14-UI-SPEC §3.2): the Files list fits the region that holds it, in whichever layout the
 * width chose. The table, where it shows, does not scroll; every file's controls sit inside the region's box (and the
 * table's); with focus on the AI switch of `focusSwitchOf`'s row, the Name cell covers none of its neighbours; and the
 * density toggle shows only with the table (O5). It logs the layout and the widths it measured, the table's min-content
 * and max-content widths included. The checks are soft, so every surface of a journey is judged in one run.
 */
async function expectListFits(page: Page, region: Locator, label: string, focusSwitchOf?: string): Promise<void> {
  /* The browser may still be choosing the layout (a table that measures too wide gives way to the cards); wait briefly. */
  await page.waitForFunction((element) => {
    const scroller = element?.querySelector<HTMLElement>('[data-slot="data-table-desktop"]');
    return !scroller || getComputedStyle(scroller).display === 'none' || scroller.scrollWidth <= scroller.clientWidth;
  }, await region.elementHandle(), { timeout: 5_000 }).catch(() => undefined);
  if (focusSwitchOf) {
    const rowSwitch = region.getByRole('table', { name: 'Files', exact: true }).getByRole('row').filter({ hasText: focusSwitchOf }).getByRole('switch');
    if (await rowSwitch.count() > 0) await rowSwitch.focus();
  }
  const measured = await region.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const scroller = element.querySelector<HTMLElement>('[data-slot="data-table-desktop"]');
    const shown = scroller && getComputedStyle(scroller).display !== 'none' ? scroller : null;
    const frame = shown?.getBoundingClientRect() ?? box;
    const controls = [...element.querySelectorAll<HTMLElement>('[data-file-actions] button')].filter((control) => control.getClientRects().length > 0);
    const outside = controls.filter((control) => {
      const rect = control.getBoundingClientRect();
      return rect.left < Math.max(box.left, frame.left) - 0.5 || rect.right > Math.min(box.right, frame.right) + 0.5;
    }).map((control) => control.getAttribute('aria-label') ?? control.textContent ?? 'a control');
    let overlap: string | null = null;
    const row = shown && document.activeElement ? document.activeElement.closest('tr') : null;
    if (row) {
      const [name, next] = [...row.children].map((cell) => cell.getBoundingClientRect());
      if (name && next && name.right > next.left + 0.5) overlap = `the Name cell ends at ${Math.round(name.right)} and covers the next cell, which starts at ${Math.round(next.left)}`;
    }
    const widths = (mode: string) => {
      const table = shown?.querySelector('table');
      if (!table) return null;
      const was = table.style.width;
      table.style.width = mode;
      const result = { table: Math.round(table.getBoundingClientRect().width), columns: [...table.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().width)) };
      table.style.width = was;
      return result;
    };
    return {
      layout: shown ? 'table' : 'cards', region: Math.round(box.width), scrollWidth: shown?.scrollWidth ?? 0, clientWidth: shown?.clientWidth ?? 0,
      controls: controls.length, outside, overlap, minContent: widths('min-content'), maxContent: widths('max-content'),
    };
  });
  console.log(`FITS ${label}: ${JSON.stringify(measured)}`);
  expect(measured.controls, `${label}: the list shows its files’ controls`).toBeGreaterThan(0);
  softly(measured.scrollWidth, `${label}: the ${measured.layout} fits its region (${measured.region}px), with nothing to scroll`).toBeLessThanOrEqual(measured.clientWidth);
  softly(measured.outside, `${label}: every file’s Download and Remove is inside the region`).toEqual([]);
  softly(measured.overlap, `${label}: with the AI switch focused, the Name cell covers no neighbour`).toBeNull();
  // The pilot's walk, O5 (G-4): the density toggle shows with the table, and never with the cards, whose layout it cannot change.
  const densityToggle = region.getByRole('button', { name: /^Use (compact|default) density$/ });
  softly(await densityToggle.isVisible(), `${label}: the density toggle shows only with the table (${measured.layout})`).toBe(measured.layout === 'table');
}

/**
 * The pilot's walk, D7: starts watching the page's static assets, and returns what to call to stop and read every one
 * that answered 404 (a script, a style sheet, a font, a preload or anything else under `/_next/`), with how many it saw.
 */
function watchMissingAssets(page: Page): () => { seen: number; missing: string[] } {
  const missing: string[] = [];
  let seen = 0;
  const onResponse = (response: Response) => {
    const type = response.request().resourceType();
    const path = new URL(response.url()).pathname;
    if (!['script', 'stylesheet', 'font'].includes(type) && !path.startsWith('/_next/')) return;
    seen += 1;
    if (response.status() === 404) missing.push(`${type} ${path}`);
  };
  page.on('response', onResponse);
  return () => {
    page.off('response', onResponse);
    return { seen, missing };
  };
}

/*
 * COLLAB-02 criterion 1 in the UI (D-16, D-26 to D-28; UI-D4): on her draft's request page Jane chooses her vendor's
 * security pack with `Choose files`; it is added at once, the queue's count line says so, and the file joins the Files
 * list with its type, size, her name and part, and a time.
 */
test('COLLAB02_DRAFT_FILE_ADDED @journey: Jane adds the vendor security pack on her draft and sees it listed', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_DRAFT_FILE_ADDED';
  const title = `Files on Jane’s draft ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { documentId } = await janesDraft(page, title);

  const files = filesSection(page);
  await expect(files.getByRole('heading', { level: 2, name: 'Files' }), `${label}: the Files section`).toBeVisible();
  await expect(files.getByText('No files yet', { exact: true }), `${label}: an empty draft`).toBeVisible();
  await expect(files, `${label}: the hint names the types, the size limit and the room left`).toContainText('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 20 more can be added to this request');

  const started = Date.now();
  await chooseFiles(page, join(fixtures, 'vendor-security-pack.pdf'));
  await expect(files.getByText('1 of 1 files added', { exact: true }), `${label}: the count line`).toBeVisible();
  const row = listedFile(page, 'vendor-security-pack.pdf', width);
  await expect(row, `${label}: the file joins the Files list`).toHaveCount(1);
  testInfo.annotations.push({ type: 'intake', description: `chosen to listed in ${Date.now() - started} ms at ${width}px` });
  await expect(row).toContainText('PDF');
  await expect(row).toContainText('2 KB');
  await expect(row).toContainText('Jane Doe');
  await expect(row).toContainText('Requestor');
  await expect(row.locator('time'), `${label}: when it was added`).toHaveCount(1);
  await expect(row).toContainText('Before submission');
  await expect(files.getByText('1 file', { exact: true }), `${label}: the section counts it`).toBeVisible();
  await expect(files, `${label}: one fewer can be added`).toContainText('19 more can be added to this request');

  await expectNoHorizontalOverflow(page, `${label} (one file listed)`);
  await expectNoSeriousViolations(page, `Jane’s draft with a file at ${width}px`);

  /*
   * The pilot's walk, D2 (X-21; §2.3, §3.2): the list fits its region on Jane's request page and in the draft's edit form,
   * whose Supporting files sits in the form's narrower column, with her Download and Remove inside it.
   */
  await expectListFits(page, files, `${label} (Jane’s request page at ${width}px)`);
  await page.goto(`${requestorPath(documentId)}/edit`);
  const supporting = supportingFiles(page);
  await expect(supporting.getByRole('button', { name: `Download ${PACK}`, exact: true }), `${label}: the edit form lists the pack`).toBeVisible();
  await expect(supporting.getByRole('button', { name: `Remove ${PACK}`, exact: true }).or(supporting.getByRole('button', { name: `More actions for ${PACK}`, exact: true }))).toBeVisible();
  await expectListFits(page, supporting, `${label} (the draft’s edit form at ${width}px)`);
  await expectNoHorizontalOverflow(page, `${label} (the draft’s edit form)`);
});

/** A row of the queue (X-20), found by its file's name. */
function queuedFile(page: Page, name: string): Locator {
  return filesSection(page).getByRole('list', { name: 'Files being added', exact: true }).getByRole('listitem').filter({ hasText: name });
}

/*
 * ROADMAP success criterion 3 and COLLAB-02 criterion 2 in the UI (D-11; 14-UI-SPEC §1.3, §8.1): Jane chooses four files
 * at once on her own new draft. The browser refuses the disallowed type and the oversize file before anything is sent;
 * Strapi refuses the PDF-named PNG and the file carrying CSRM's test signature. Each row says `Not added.` with family
 * N's sentence, the count line counts all four as not added, and nothing joins the Files list.
 */
test('COLLAB02_REFUSALS @journey: a disallowed, mismatched, oversized or infected file is refused in place with what to do next', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_REFUSALS';
  const title = `Refused files on Jane’s draft ${testInfo.project.name} ${Date.now().toString(36)}`;
  await janesDraft(page, title);

  await chooseFiles(page, [
    { name: 'tool.exe', mimeType: 'application/octet-stream', buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(254)]) },
    { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: readFileSync(join(fixtures, 'diagram.png')) },
    { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(31_457_280 - 9)]) },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Supplier notes for the security review.\nCSRM-TEST-MALWARE-SIGNATURE-7c1e4a\n') },
  ]);

  const files = filesSection(page);
  await expect(files.getByText('0 of 4 files added · 4 not added', { exact: true }), `${label}: the count line`).toBeVisible();
  const refusals: readonly [string, string][] = [
    ['tool.exe', 'This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.'],
    ['invoice.pdf', 'This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.'],
    ['big.pdf', 'Files can be up to 25 MB, and this one is 30.0 MB. Make it smaller or split it, then add it again.'],
    ['notes.txt', 'This file contains malware (Csrm.Test.Signature) and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.'],
  ];
  for (const [name, sentence] of refusals) {
    const row = queuedFile(page, name);
    await expect(row, `${label}: ${name} is listed once`).toHaveCount(1);
    await expect(row, `${label}: ${name} says why it was not added`).toContainText(`Not added. ${sentence}`);
    await expect(row.getByRole('button', { name: `Choose another file to replace ${name}`, exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: `Remove from list: ${name}`, exact: true })).toBeVisible();
    /*
     * The pilot's walk, O1 and O3 (X-20; §1.4): the row shows its file-type icon, the Files list's mapping, with the
     * document icon for a type that is not allowed; at 1440 its stage sits on the name's line and the reason beneath.
     */
    await expect(row.locator('svg.lucide-file-text'), `${label}: ${name} shows its type icon`).toHaveCount(1);
    if ((width ?? 1440) >= 768) {
      const [nameBox, stageBox] = await Promise.all([row.getByText(name, { exact: true }).boundingBox(), row.getByText('Not added.', { exact: true }).boundingBox()]);
      const middle = (box: { y: number; height: number } | null) => (box ? Math.round(box.y + box.height / 2) : null);
      expect(Math.abs((middle(nameBox) ?? 0) - (middle(stageBox) ?? 999)), `${label}: ${name}’s stage sits on its name’s line at ${width}px (name ${middle(nameBox)}, stage ${middle(stageBox)})`).toBeLessThanOrEqual(4);
    }
  }

  await expect(files.getByText('No files yet', { exact: true }), `${label}: nothing joined the Files list`).toBeVisible();
  await expect(files.getByRole('table', { name: 'Files', exact: true }), `${label}: no list renders`).toHaveCount(0);
  await expect(files, `${label}: no file took a place`).toContainText('20 more can be added to this request');

  await expectNoHorizontalOverflow(page, `${label} (four refused rows)`);
  await expectNoSeriousViolations(page, `Jane’s draft with four refused files at ${width}px`);
});

const PACK = 'vendor-security-pack.pdf';

/**
 * Jane saves a complete draft, adds `files` on its request page with `Choose files` and waits until each is listed, then
 * submits it through the existing flow (D-16: files on a draft need no note). Leaves her on the submitted request page.
 */
async function janeSubmitsWithFiles(page: Page, title: string, names: readonly string[], width: number | undefined): Promise<{ requestNumber: string; documentId: string }> {
  await switchTo(page, 'Requestor');
  const draft = await createCompleteDraftRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });
  await chooseFiles(page, names.map((name) => join(fixtures, name)));
  await expect(filesSection(page).getByText(`${names.length} of ${names.length} files added`, { exact: true })).toBeVisible();
  for (const name of names) await expect(listedFile(page, name, width), `${name} is listed on Jane’s draft`).toHaveCount(1);
  await submitRequestFromItsPage(page);
  return draft;
}

/** The level-two headings of the page in order, so a section's place can be checked against Notes. */
async function sectionOrder(page: Page): Promise<string[]> {
  return (await page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents()).map((text) => text.trim());
}

/*
 * COLLAB-02 criterion 3 in the UI and ROADMAP success criterion 4 (D-23, D-24, D-27; UI-D15, UI-D25): Jane adds her
 * vendor's security pack on her draft and submits it; Bob opens the analyst request page, finds the Files section
 * directly before Notes, and downloads the pack with its explicit Download button. The browser saves it under its name
 * with the bytes Jane added (a PDF), the button says it downloaded once, and nothing previews inline.
 */
test('COLLAB02_ANALYST_DOWNLOAD @journey: Bob downloads Jane’s security pack from the analyst request page', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_ANALYST_DOWNLOAD';
  const title = `Bob downloads Jane’s pack ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { documentId } = await janeSubmitsWithFiles(page, title, [PACK], width);

  await switchTo(page, 'Security Analyst');
  /* The pilot's walk, D7: on the harness's production build, no script, style sheet, font or preload answers 404. */
  const missingAssets = watchMissingAssets(page);
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const files = filesSection(page);
  await expect(files.getByRole('heading', { level: 2, name: 'Files', exact: true }), `${label}: the analyst page shows the Files section`).toBeVisible();
  await expect(files).toContainText('Files from the Requestor and the Security Analysts.');
  const order = await sectionOrder(page);
  expect(order.indexOf('Files'), `${label}: Files comes directly before Notes (${order.join(', ')})`).toBe(order.indexOf('Notes') - 1);
  expect(order.at(-1), `${label}: Notes stays last`).toBe('Notes');

  const row = listedFile(page, PACK, width);
  await expect(row).toContainText('Jane Doe');
  await expect(row).toContainText('Before submission');
  const saved = page.waitForEvent('download');
  await row.getByRole('button', { name: `Download ${PACK}`, exact: true }).click();
  const download = await saved;
  expect(download.suggestedFilename(), `${label}: saved under its name`).toBe(PACK);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString('latin1'), `${label}: the saved file is a PDF`).toBe('%PDF-');
  expect(bytes.equals(readFileSync(join(fixtures, PACK))), `${label}: the bytes Jane added`).toBe(true);
  await expect(files.getByText(`${PACK} downloaded.`, { exact: true }), `${label}: said once`).toHaveCount(1);
  await expect(row.getByRole('button', { name: `Download ${PACK}`, exact: true }), `${label}: Download is ready again`).toBeVisible();
  expect(new URL(page.url()).pathname, `${label}: the page did not leave to open the file`).toBe(analystPath(documentId));

  await expectNoHorizontalOverflow(page, `${label} (the analyst page with a file)`);
  await expectNoSeriousViolations(page, `Bob’s request page with Jane’s file at ${width}px`);
  await page.waitForLoadState('networkidle');
  const { missing, seen } = missingAssets();
  console.log(`ASSETS ${label} at ${width}px: ${seen} static assets, ${missing.length} answered 404${missing.length > 0 ? `: ${missing.join(', ')}` : ''}`);
  expect(seen, `${label}: the page's static assets were watched`).toBeGreaterThan(0);
  expect(missing, `${label}: no script, style sheet, font or preload on the analyst request page answers 404`).toEqual([]);
});

const fileNoLongerAvailable = 'This file is no longer available. Refresh the page.';

/** Whether a request is a Server Action call: Next posts it with its `Next-Action` header. */
const isServerAction = (request: import('@playwright/test').Request) => request.method() === 'POST' && request.headers()['next-action'] !== undefined;

/*
 * COLLAB-02 and ROADMAP success criterion 2 in the UI (D-18; T-14-47): the Secondary Requestor opens Jane's submitted
 * request by its URLs. The Requestor page shows its own not-found state and the analyst page its existing refusal, and
 * nothing of the files reaches either page: no file name, no Files heading, region or hub row. Her Home and her list
 * show nothing of Jane's request. Strapi's refusals of her file calls are proven in the Strapi suite (14-06 to 14-09).
 *
 * WR-603: criterion 2's "by any URL" includes the Server Action endpoint, which any signed-in caller can post to with ids
 * of their choosing. So the Secondary Requestor also replays the bound Download action with Jane's request and file ids,
 * and gets family O's not-found sentence and no download. She may own no request in the run's shared database (the
 * accessibility and Home journeys read her first-use Home and empty lists), and a draft that has held a file can never be
 * deleted (REQUEST_HAS_ATTACHMENTS), so the action is bound on Jane's own page: it renders for Jane, the browser's session
 * then becomes the Secondary Requestor's (signed in from a second tab of the same context), and Download posts Jane's ids
 * to the action endpoint under her session, the ruling's "post to the action endpoint with her session". The browser
 * handles the answer as it would any download, so a download would be seen.
 */
test('COLLAB02_OTHER_REQUESTOR_NOT_FOUND @journey: the Secondary Requestor finds nothing of Jane’s files anywhere', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_OTHER_REQUESTOR_NOT_FOUND';
  const title = `Files hidden from another Requestor ${testInfo.project.name} ${Date.now().toString(36)}`;
  const { documentId, requestNumber } = await janeSubmitsWithFiles(page, title, [PACK], width);

  // WR-603: Jane's page binds Download with her ids; the session that posts it becomes the Secondary Requestor's.
  await page.goto(requestorPath(documentId));
  const janesEntry = listedFile(page, PACK, width);
  const janesDownload = janesEntry.getByRole('button', { name: `Download ${PACK}`, exact: true });
  await expect(janesDownload, `${label}: Jane’s page binds Download`).toBeVisible();
  const attachmentId = (await janesEntry.locator('[id^="file-"]').first().getAttribute('id'))?.replace(/^file-/, '') ?? '';
  expect(attachmentId, `${label}: Jane’s file id`).not.toBe('');
  const secondTab = await page.context().newPage();
  await switchTo(secondTab, 'Secondary Requestor');
  await secondTab.close();
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  /*
   * The download's own action, read through the route: another Server Action on the page (the notes' read mark) can
   * answer in the same moment, and Chromium's copy of a response body can be gone before the test reads it (the Phase
   * 15 gate, 2026-10-12: `Network.getResponseBody` found no data). The route fetches the answer, keeps its text and
   * hands the page the same response.
   */
  const isDownloadAction = (request: import('@playwright/test').Request) => isServerAction(request) && (request.postData() ?? '').includes(attachmentId);
  let replay = '';
  let answer: string | null = null;
  const readAnswer = async (route: import('@playwright/test').Route) => {
    if (!isDownloadAction(route.request())) return route.fallback();
    replay = route.request().postData() ?? '';
    const response = await route.fetch();
    const body = await response.text();
    answer = body;
    await route.fulfill({ response, body });
  };
  await page.route('**/*', readAnswer);
  await janesDownload.click();
  await expect.poll(() => answer, { message: `${label}: the action is answered` }).not.toBeNull();
  await page.unroute('**/*', readAnswer);
  expect(replay, `${label}: the replay carries Jane’s request id`).toContain(documentId);
  expect(replay, `${label}: the replay carries Jane’s file id`).toContain(attachmentId);
  expect(answer, `${label}: the action answers family O’s not-found sentence`).toContain(fileNoLongerAvailable);
  expect(answer, `${label}: and no byte of the file`).not.toContain('%PDF');
  const refused = toastWith(page, 'File not downloaded');
  await expect(refused, `${label}: the refusal is shown`).toBeVisible();
  await expect(refused).toContainText(fileNoLongerAvailable);
  // The page saves a file only on a successful answer and shows this toast only on a refusal, so none can follow it.
  expect(downloads, `${label}: nothing is downloaded`).toEqual([]);
  await page.reload();
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `${label}: the tab’s session is the Secondary Requestor’s`).toBeVisible();

  await switchTo(page, 'Secondary Requestor');
  const main = page.getByRole('main');
  const nothingOfTheFiles = async (where: string) => {
    await expect(page.getByRole('heading', { name: 'Files', exact: true }), `${label}: no Files heading (${where})`).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Files', exact: true }), `${label}: no Files section (${where})`).toHaveCount(0);
    await expect(page.locator('dt', { hasText: /^Files$/ }), `${label}: no Files row (${where})`).toHaveCount(0);
    const content = await page.content();
    expect(content, `${label}: no file name in the page (${where})`).not.toContain(PACK);
    expect(content, `${label}: no title of Jane’s (${where})`).not.toContain(title);
    expect(content, `${label}: no number of Jane’s (${where})`).not.toContain(requestNumber);
  };

  await page.goto(requestorPath(documentId));
  await expect(main.getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `${label}: the Requestor page’s not-found state`).toBeVisible();
  await expect(main.locator('[data-state-kind="permission"]'), `${label}: not a permission state, which would confirm the request exists`).toHaveCount(0);
  await nothingOfTheFiles('the Requestor page');
  await expectNoSeriousViolations(page, `the Secondary Requestor on Jane’s request at ${width}px`);
  await expectNoHorizontalOverflow(page, `${label} (the Requestor page)`);

  await page.goto(analystPath(documentId));
  /* The analyst page's existing refusal (D-23): the role gate answers before any read, so it says nothing of the request. */
  await expect(main.getByRole('alert').filter({ hasText: 'You don’t have permission to review this request' }), `${label}: the analyst page’s own refusal`).toBeVisible();
  await nothingOfTheFiles('the analyst page');

  await page.goto('/app');
  await expect(main.getByRole('heading', { level: 1, name: 'Home', exact: true })).toBeVisible();
  await nothingOfTheFiles('her Home');

  await page.goto('/app/requests');
  await expect(main.getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  await nothingOfTheFiles('her request list');
});

/** WR-605 (X-14): Alt+T moves focus to the notifications, and Tab reaches the toast's action. */
async function reachToastActionByKeyboard(page: Page, toast: Locator, name: string): Promise<Locator> {
  const action = toast.getByRole('button', { name, exact: true });
  await expect(action).toBeVisible();
  await page.keyboard.press('Alt+T');
  for (let step = 0; step < 8 && !(await action.evaluate((element) => element === document.activeElement)); step += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(action, `Alt+T, then Tab, reaches the toast’s ${name}`).toBeFocused();
  return action;
}

/** Removes a listed file the way the layout offers it: the table row's Remove, or the card's actions sheet. */
async function removeListedFile(page: Page, name: string, width: number | undefined): Promise<void> {
  const entry = listedFile(page, name, width);
  if (await tableShown(page)) {
    await entry.getByRole('button', { name: `Remove ${name}`, exact: true }).click();
    return;
  }
  await entry.getByRole('button', { name: `More actions for ${name}`, exact: true }).click();
  const sheet = page.getByRole('dialog', { name, exact: true });
  await expect(sheet.getByRole('heading', { name, exact: true }), 'focus moves to the sheet’s title').toBeFocused();
  await sheet.getByRole('button', { name: `Remove ${name}`, exact: true }).click();
  await expect(sheet).toHaveCount(0);
}

/** The removed group, opened by its toggle (§3.5). */
async function openRemovedGroup(page: Page, count: number): Promise<Locator> {
  const toggle = filesSection(page).getByRole('button', { name: `Show removed files (${count})`, exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(filesSection(page).getByRole('button', { name: 'Hide removed files', exact: true })).toHaveAttribute('aria-expanded', 'true');
  const group = filesSection(page).getByRole('list', { name: 'Removed files', exact: true });
  await expect(group).toBeVisible();
  return group;
}

/*
 * COLLAB-02 criterion 4 and ROADMAP success criterion 4 in the UI (D-20; UI-D17; X-14): on her draft Jane removes the
 * security pack, which applies at once with no question asked; she undoes it from the keyboard (Alt+T, Tab, Enter), it
 * comes back, and she removes it again. The removed group says she removed it, and when. She adds the data-flow document
 * and submits; Bob opens the analyst page and its removed group shows the same record, with no Restore for him.
 */
test('COLLAB02_REMOVE_UNDO @journey: Jane removes, undoes and removes again, and both see who removed the file and when', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_REMOVE_UNDO';
  const title = `Jane removes a file ${testInfo.project.name} ${Date.now().toString(36)}`;
  const FLOW = 'data-flow.docx';

  await switchTo(page, 'Requestor');
  const { documentId } = await createCompleteDraftRequest(page, { title, assessmentType: 'Project', businessCriticality: 'Moderate', dueDate: null });
  await chooseFiles(page, join(fixtures, PACK));
  await expect(listedFile(page, PACK, width), `${label}: the pack is listed`).toHaveCount(1);

  await removeListedFile(page, PACK, width);
  await expect(page.getByRole('alertdialog'), `${label}: nothing asks first`).toHaveCount(0);
  const removed = toastWith(page, `${PACK} removed.`);
  await expect(removed, `${label}: the removal toast`).toBeVisible();
  await expect(listedFile(page, PACK, width), `${label}: the pack leaves the list at once`).toHaveCount(0);

  const undo = await reachToastActionByKeyboard(page, removed, 'Undo');
  await undo.press('Enter');
  await expect(toastWith(page, `${PACK} restored.`), `${label}: Undo restores the pack`).toBeVisible();
  await expect(listedFile(page, PACK, width), `${label}: the pack is back in the list`).toHaveCount(1);
  await expect(filesSection(page).getByRole('button', { name: /removed files/ }), `${label}: nothing is removed now`).toHaveCount(0);

  await removeListedFile(page, PACK, width);
  await expect(toastWith(page, `${PACK} removed.`).last(), `${label}: removed again`).toBeVisible();
  const janesGroup = await openRemovedGroup(page, 1);
  const janesRecord = janesGroup.getByRole('listitem').filter({ hasText: PACK });
  await expect(janesRecord, `${label}: Jane sees she removed it`).toContainText('Removed by Jane Doe · ');
  await expect(janesRecord.locator('time'), `${label}: when it was added and when it was removed`).toHaveCount(2);
  await expect(janesRecord.getByRole('button', { name: `Restore ${PACK}`, exact: true }), `${label}: the remover may restore it`).toBeVisible();
  await expectNoSeriousViolations(page, `Jane’s draft with the removed group open at ${width}px`);

  await chooseFiles(page, join(fixtures, FLOW));
  await expect(listedFile(page, FLOW, width), `${label}: the data-flow document is listed`).toHaveCount(1);
  await submitRequestFromItsPage(page);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const hubFiles = summaryValue(page, 'Files').getByRole('link', { name: '1 file', exact: true });
  await expect(hubFiles, `${label}: the hub counts the one file`).toHaveAttribute('href', '#files');
  // The pilot's walk, D1 (§3.1; X-10): the hub's figure lands on the Files section, focusing its heading.
  await expect(listedFile(page, FLOW, width)).toHaveCount(1);
  await followAndLand(page, hubFiles, `${label}: the hub’s 1 file at ${width}px`);
  await expect(listedFile(page, PACK, width), `${label}: the removed pack is not in Bob’s list`).toHaveCount(0);
  const bobsGroup = await openRemovedGroup(page, 1);
  const bobsRecord = bobsGroup.getByRole('listitem').filter({ hasText: PACK });
  await expect(bobsRecord, `${label}: Bob sees who removed it`).toContainText('Added by Jane Doe · ');
  await expect(bobsRecord).toContainText('Removed by Jane Doe · ');
  await expect(bobsRecord.locator('time')).toHaveCount(2);
  await expect(bobsRecord.getByRole('button', { name: /^Restore/ }), `${label}: only the remover may restore it`).toHaveCount(0);
  await expectNoHorizontalOverflow(page, `${label} (Bob with the removed group open)`);
  await expectNoSeriousViolations(page, `Bob’s request page with the removed group open at ${width}px`);
});

/** The new-request form's `Supporting files` section (§2.1). */
function supportingFiles(page: Page): Locator {
  return page.getByRole('group', { name: 'Supporting files', exact: true });
}

/** Fills the new-request form for Jane's payroll SaaS request: the fields a draft needs, and the context she has. */
async function fillPayrollRequest(page: Page, title: string): Promise<void> {
  await page.goto('/app/requests/new');
  await expect(page.getByRole('textbox', { name: 'Request title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Request title' }).fill(title);
  await page.getByRole('textbox', { name: 'Description' }).fill('A hosted payroll service for the people team, replacing the on-premises system.');
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Pay our people accurately and on time through a hosted payroll service.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
  await page.getByRole('checkbox', { name: 'Third-party involvement' }).check();
  await page.getByRole('textbox', { name: 'Third-party details' }).fill('The payroll vendor hosts the service and processes employee pay data.');
}

/*
 * COLLAB-02 criterion 1 at creation and ROADMAP success criterion 1 (D-26, D-27; UI-D3; 14-UI-SPEC §2.1, §2.2): Jane fills
 * the new-request form for the payroll SaaS request and chooses the vendor's security pack, the data-flow document and the
 * completed security questionnaire with it. The first Save draft creates the draft, the files are added to it one at a
 * time, and the page moves to the draft's request page, whose Files section lists all three with her name. Her list holds
 * one new draft, never two.
 */
test('COLLAB02_CREATE_WITH_FILES @journey: Jane creates the payroll SaaS request with its three files, and they arrive with the draft', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_CREATE_WITH_FILES';
  const stamp = Date.now().toString(36);
  const title = `Payroll SaaS ${testInfo.project.name} ${stamp}`;
  const names = ['vendor-security-pack.pdf', 'data-flow.docx', 'vendor-questionnaire.xlsx'] as const;

  await switchTo(page, 'Requestor');
  await fillPayrollRequest(page, title);
  const section = supportingFiles(page);
  await expect(section.getByRole('heading', { level: 2, name: 'Supporting files', exact: true }), `${label}: the section`).toBeVisible();
  await expect(section, `${label}: files are added when the draft is saved`).toContainText('Files are added when you save the draft.');

  const chooser = page.waitForEvent('filechooser');
  await section.getByRole('button', { name: 'Choose files', exact: true }).click();
  await (await chooser).setFiles(names.map((name) => join(fixtures, name)));
  const queue = section.getByRole('list', { name: 'Files being added', exact: true });
  for (const name of names) {
    const row = queue.getByRole('listitem').filter({ hasText: name });
    await expect(row, `${label}: ${name} is listed with the form`).toHaveCount(1);
    // The pilot's walk, O1 (X-20): the row's file-type icon, from the Files list's mapping.
    await expect(row.locator(`svg.lucide-${name.endsWith('.xlsx') ? 'file-spreadsheet' : 'file-text'}`), `${label}: ${name} shows its type icon`).toHaveCount(1);
    const remove = row.getByRole('button', { name: `Remove ${name} from the list`, exact: true });
    await expect(remove).toBeVisible();
    // WR-405, O2 (§1.4 at 375): the row's action at full width and the touch-target height; the 24px X from 768px.
    const box = await expectTargetSize(remove, width, `${label}: Remove ${name} from the list`);
    if ((width ?? 1440) < 768) expect(box.width, `${label}: Remove ${name} from the list spans the row`).toBeGreaterThanOrEqual((await row.boundingBox())!.width - 33);
  }
  await expect(section, `${label}: the three take their places`).toContainText('17 more can be added to this request');
  await expectNoHorizontalOverflow(page, `${label} (the form with three files)`);
  await expectNoSeriousViolations(page, `the new-request form with three files at ${width}px`);

  const started = Date.now();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page, `${label}: the page moves to the draft once every file has settled`).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/, { timeout: 60_000 });
  testInfo.annotations.push({ type: 'intake', description: `saved with three files in ${Date.now() - started} ms at ${width}px` });
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const files = filesSection(page);
  await expect(files.getByText('3 files', { exact: true }), `${label}: the section counts the three`).toBeVisible();
  for (const name of names) {
    const row = listedFile(page, name, width);
    await expect(row, `${label}: ${name} arrived with the draft`).toHaveCount(1);
    await expect(row).toContainText('Jane Doe');
    await expect(row).toContainText('Before submission');
  }

  await page.goto(`/app/requests?q=${encodeURIComponent(stamp)}`);
  await expect(page.getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: title, exact: true }).filter({ visible: true }),
    `${label}: one new draft, never two`,
  ).toHaveCount(1);
});

const DECK = 'architecture-deck.pptx';
const deckNote = 'The vendor sent their architecture deck after today’s call';

/*
 * Jane fills the whole new-request form a submission needs, chooses `names` under Supporting files and saves the draft
 * once (§2.1, §2.2); the page moves to the draft's request page once every file has settled.
 */
async function janeCreatesWithFiles(page: Page, title: string, names: readonly string[]): Promise<{ requestNumber: string; documentId: string }> {
  await switchTo(page, 'Requestor');
  await page.goto('/app/requests/new');
  await expect(page.getByRole('textbox', { name: 'Request title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Request title' }).fill(title);
  await page.getByRole('textbox', { name: 'Description' }).fill('A hosted payroll service for the people team, replacing the on-premises system.');
  await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
  await page.getByRole('textbox', { name: 'Division' }).fill('Corporate Services');
  await page.getByRole('textbox', { name: 'Business unit' }).fill('People and Culture');
  await page.getByRole('textbox', { name: 'Business purpose' }).fill('Pay our people accurately and on time through a hosted payroll service.');
  await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
  await page.getByRole('checkbox', { name: 'Third-party involvement' }).check();
  await page.getByRole('textbox', { name: 'Third-party details' }).fill('The payroll vendor hosts the service and processes employee pay data.');
  await page.getByRole('textbox', { name: 'Regulatory requirements' }).fill('Privacy Act 1988 obligations for employee pay data');
  await chooseRelation(page, 'Information systems');
  await chooseRelation(page, 'Information assets');
  const chooser = page.waitForEvent('filechooser');
  await supportingFiles(page).getByRole('button', { name: 'Choose files', exact: true }).click();
  await (await chooser).setFiles(names.map((name) => join(fixtures, name)));
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const documentId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  const requestNumber = (await page.locator('.page-header p').first().textContent())?.trim() ?? '';
  expect(requestNumber, 'the draft’s request number').toMatch(/^RAR-\d{4}-[A-Z0-9]+$/);
  await expect(filesSection(page).getByText(`${names.length} files`, { exact: true })).toBeVisible();
  return { requestNumber, documentId };
}

/*
 * ROADMAP success criterion 1 and UAT-012, end to end (D-17, D-26, D-27, D-39; 14-UI-SPEC §2, §4): Jane creates the
 * payroll SaaS request with the vendor's security pack, the data-flow document and the completed questionnaire, and
 * submits it. Later she writes that the vendor sent their architecture deck, attaches it and adds the note: the note
 * goes first, the deck follows with it, and the note shows the deck's chip. Bob opens the analyst page: the note is new
 * to him, the Files section lists all four files with who added each and when, the deck's row leads to its note, and
 * the deck downloads under its name as an Office file.
 */
test('COLLAB02_NOTE_WITH_FILES @journey: Jane’s files at intake and her later note with the deck reach Bob', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_NOTE_WITH_FILES';
  const title = `Payroll SaaS with a deck ${testInfo.project.name} ${Date.now().toString(36)}`;
  const intake = ['vendor-security-pack.pdf', 'data-flow.docx', 'vendor-questionnaire.xlsx'] as const;
  const journeyStarted = Date.now();

  const { documentId, requestNumber } = await janeCreatesWithFiles(page, title, intake);
  await submitRequestFromItsPage(page);
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();

  const notes = notesSection(page);
  const composer = notes.getByRole('textbox', { name: 'Add a note' });
  await composer.fill(deckNote);
  const chooser = page.waitForEvent('filechooser');
  await notes.getByRole('button', { name: 'Attach files', exact: true }).click();
  await (await chooser).setFiles(join(fixtures, DECK));
  const chips = notes.getByRole('list', { name: 'Files to add with this note', exact: true });
  await expect(chips.getByRole('listitem').filter({ hasText: DECK }), `${label}: the deck waits as a chip in the composer`).toHaveCount(1);
  await expect(chips.getByRole('button', { name: `Remove ${DECK} from the list`, exact: true })).toBeVisible();
  // 14-UI-REVIEW UI-03 (direction §4 Buttons, "touch targets ≥44px below 768px"): the chip's Remove is the touch-target
  // circle at 375, as the queue row's identical Remove is (WR-405), and at least the 24px target from 768px (2.5.8).
  const chipRemove = await expectTargetSize(chips.getByRole('button', { name: `Remove ${DECK} from the list`, exact: true }), width, `${label}: the composer chip’s Remove ${DECK} from the list`);
  if ((width ?? 1440) < 768) expect(chipRemove.width, `${label}: the chip’s Remove is a 44px circle`).toBeGreaterThanOrEqual(44);
  console.log(`ICON ${label}: the composer chip’s Remove icon is ${await chips.getByRole('button', { name: `Remove ${DECK} from the list`, exact: true }).locator('svg').evaluate((icon) => icon.getBoundingClientRect().width)}px at ${width}px`);
  await expect(notes, `${label}: the composer says what happens to the file`).toContainText('Files are checked for malware, then added with your note.');
  await expectNoHorizontalOverflow(page, `${label} (the composer with a chip)`);
  await expectNoSeriousViolations(page, `Jane’s composer with a file chip at ${width}px`);

  const posted = Date.now();
  await notes.getByRole('button', { name: 'Add note', exact: true }).click();
  const janesNote = noteWith(page, requestNumber, deckNote);
  await expect(janesNote.locator('time').first(), `${label}: Strapi recorded the note`).toBeVisible();
  const noteFiles = janesNote.getByRole('list', { name: 'Files with this note', exact: true });
  await expect(noteFiles.getByRole('link', { name: DECK, exact: true }), `${label}: the deck arrives with its note`).toHaveAttribute('href', /^#file-/, { timeout: 60_000 });
  testInfo.annotations.push({ type: 'note-with-files', description: `note and deck posted in ${Date.now() - posted} ms at ${width}px` });
  await expect(chips, `${label}: the composer is clear`).toHaveCount(0);
  await expect(composer).toHaveValue('');
  await expect(filesSection(page).getByText('4 files', { exact: true }), `${label}: Jane’s Files section counts four`).toBeVisible();

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const janesForBob = noteWith(page, requestNumber, deckNote);
  await expect(janesForBob.getByText('New', { exact: true }), `${label}: Jane’s note is new to Bob`).toBeVisible();
  await expect(janesForBob.getByRole('list', { name: 'Files with this note', exact: true }).getByRole('link', { name: DECK, exact: true })).toBeVisible();
  // 14-UI-REVIEW UI-03: the note chip's Download is the touch-target circle at 375, and at least 24px from 768px.
  const chipDownload = await expectTargetSize(janesForBob.getByRole('list', { name: 'Files with this note', exact: true }).getByRole('button', { name: `Download ${DECK}`, exact: true }), width, `${label}: the note chip’s Download ${DECK}`);
  if ((width ?? 1440) < 768) expect(chipDownload.width, `${label}: the chip’s Download is a 44px circle`).toBeGreaterThanOrEqual(44);
  const noteAnchor = await janesForBob.getAttribute('id');
  expect(noteAnchor, `${label}: the note is a link target`).toMatch(/^note-/);

  const files = filesSection(page);
  await expect(files.getByText('4 files', { exact: true }), `${label}: Bob sees all four files`).toBeVisible();
  for (const name of [...intake, DECK]) {
    const row = listedFile(page, name, width);
    await expect(row, `${label}: ${name} is listed for Bob`).toHaveCount(1);
    await expect(row, `${label}: who added ${name}`).toContainText('Jane Doe');
    await expect(row).toContainText('Requestor');
    await expect(row.locator('time').first(), `${label}: when ${name} was added`).toBeVisible();
    if (name !== DECK) await expect(row).toContainText('Before submission');
  }
  const deckRow = listedFile(page, DECK, width);
  await expect(deckRow.getByRole('link', { name: /^Note · / }), `${label}: the deck’s row leads to its note`).toHaveAttribute('href', `#${noteAnchor}`);
  // O6 (2.5.8): the Note link is at least the 24px target, on the card as in the table.
  await expectTargetSize(deckRow.getByRole('link', { name: /^Note · / }), width, `${label}: the deck’s Note link`, 24);
  // The pilot's walk, D1 (§4.2): the deck's chip on Jane's note lands on the deck's row (its card at 375), focusing it.
  const deckChip = janesForBob.getByRole('list', { name: 'Files with this note', exact: true }).getByRole('link', { name: DECK, exact: true });
  await followAndLand(page, deckChip, `${label}: the note’s ${DECK} chip at ${width}px`);

  const saved = page.waitForEvent('download');
  await deckRow.getByRole('button', { name: `Download ${DECK}`, exact: true }).click();
  const download = await saved;
  expect(download.suggestedFilename(), `${label}: saved under its name`).toBe(DECK);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 2).toString('latin1'), `${label}: the saved deck is an Office file`).toBe('PK');
  expect(bytes.equals(readFileSync(join(fixtures, DECK))), `${label}: the bytes Jane added`).toBe(true);

  await expectNoHorizontalOverflow(page, `${label} (Bob with four files and the note)`);
  await expectNoSeriousViolations(page, `Bob’s request page with Jane’s note and four files at ${width}px`);
  testInfo.annotations.push({ type: 'criterion-1', description: `criterion 1 journey in ${Date.now() - journeyStarted} ms at ${width}px` });

  /*
   * WR-602: Bob reads Jane's note, so no New flag leaks into a later journey. He lands on the thread (D1), as each reload
   * does again, so the note is seen on every render until the next one reads it as read.
   */
  await page.goto(`${analystPath(documentId)}#notes`);
  await expect(janesForBob.getByText('New', { exact: true })).toBeVisible();
  await expectNoneNewOnNextRender(page, requestNumber, label);

  // IN-603: read state is per reader, so the second analyst reads Jane's note too, as UAT-012 has them do.
  await switchTo(page, 'Second Security Analyst');
  await page.goto(`${analystPath(documentId)}#notes`);
  await expect(noteWith(page, requestNumber, deckNote).getByText('New', { exact: true }), `${label}: Jane’s note is new to the second analyst until read`).toBeVisible();
  await expectNoneNewOnNextRender(page, requestNumber, `${label} (the second analyst)`);
});

/**
 * Where a file's AI control is (14-UI-SPEC §3.3, §5.1): its table row where the table shows; otherwise the actions sheet
 * its card's `More actions` opens. Returns the row or the open sheet.
 */
async function aiControlFor(page: Page, name: string, width: number | undefined): Promise<Locator> {
  const entry = listedFile(page, name, width);
  if (await tableShown(page)) return entry;
  await entry.getByRole('button', { name: `More actions for ${name}`, exact: true }).click();
  const sheet = page.getByRole('dialog', { name, exact: true });
  await expect(sheet.getByRole('heading', { name, exact: true })).toBeFocused();
  await sheetSettled(sheet);
  return sheet;
}

/** Closes the actions sheet, when the control was in one. */
async function closeAiControl(page: Page, name: string): Promise<void> {
  const sheet = page.getByRole('dialog', { name, exact: true });
  if (await sheet.count() === 0) return;
  await sheet.getByRole('button', { name: `Close actions for ${name}`, exact: true }).click();
  await expect(sheet).toHaveCount(0);
}

const includedAll = /^Included · all [\d,]+ characters$/;

/*
 * ROADMAP success criterion 5 and COLLAB-02 criterion 5 in the UI (D-30, D-33, D-35, D-39; 14-UI-SPEC §5.1, §7.1): Jane
 * submits her request with the vendor's security pack and the data-flow document. Bob, who did not raise it, switches on
 * the pack with `Changes the AI inputs`: the switch waits while Strapi reads the file, then the facts line says how much
 * is sent and a toast offers Undo. He leaves the data-flow document out, generates the questionnaire from the hub with the
 * deterministic provider, and "What the AI used" on the questionnaire lists the pack, by its name, and not the data-flow
 * document. Jane's request page shows no switch and no AI facts (D-28).
 */
test('COLLAB02_AI_INCLUSION @journey: Bob includes the security pack, generates, and What the AI used lists the pack and not the data-flow document', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_AI_INCLUSION';
  const FLOW = 'data-flow.docx';
  const title = `Bob includes the pack ${testInfo.project.name} ${Date.now().toString(36)}`;
  const journeyStarted = Date.now();
  const { documentId } = await janeSubmitsWithFiles(page, title, [PACK, FLOW], width);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const files = filesSection(page);
  await expect(files, `${label}: the section says what may be included`).toContainText(/Include only files whose content is within this request’s .+ classification\./);
  if ((width ?? 1440) >= 768) {
    await expect(files.getByRole('table', { name: 'Files', exact: true }).getByRole('columnheader', { name: 'AI inputs', exact: true }), `${label}: the AI inputs column`).toBeVisible();
  } else {
    await expect(listedFile(page, PACK, width).getByText('AI inputs: Not included', { exact: true }), `${label}: the card’s AI line`).toBeVisible();
  }
  // The pilot's walk, D2 (X-21; §3.2): Bob's list, with its AI inputs, fits the section, with focus on the pack's switch.
  await expectListFits(page, files, `${label} (Bob’s list with the AI inputs at ${width}px)`, PACK);

  const pack = await aiControlFor(page, PACK, width);
  // 14-UI-REVIEW UI-02: where the cards show, the actions sheet slides up with the drawer motion, through its own classes.
  if (!(await tableShown(page))) {
    await expectDrawerMotion(pack, 'drawer-in-bottom', `${label}: the actions sheet at ${width}px`);
    // A record for the shared-UI item (.planning/WINDOWS.md): the shared overlay's own classes compute to no motion.
    console.log(`MOTION ${label}: the shared sheet overlay at ${width}px: ${await page.locator('[data-slot="sheet-overlay"][data-state="open"]').evaluate((element) => getComputedStyle(element).animationName)}`);
  }
  const packSwitch = pack.getByRole('switch', { name: 'Changes the AI inputs', exact: true });
  await expect(packSwitch, `${label}: the pack starts out of the AI inputs`).toHaveAttribute('aria-checked', 'false');
  await expect(pack.getByText('Not included', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, `Bob’s Files section with the AI control at ${width}px`);
  if ((width ?? 1440) < 768) {
    // WR-405, D4 (§3.3): in the actions sheet the switch's whole row is its label, full width at the touch-target height.
    const box = await expectTargetSize(packSwitch.locator('xpath=ancestor::label[1]'), width, `${label}: the sheet’s AI switch row`);
    expect(box.width, `${label}: the switch row spans the sheet`).toBeGreaterThanOrEqual((await pack.boundingBox())!.width - 33);
  }
  const included = Date.now();
  await packSwitch.click();
  await expect(toastWith(page, `${PACK} included in the AI inputs.`), `${label}: the inclusion toast`).toBeVisible({ timeout: 30_000 });
  testInfo.annotations.push({ type: 'inclusion', description: `switched on to included in ${Date.now() - included} ms at ${width}px` });
  await expect(packSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(pack.getByText(includedAll), `${label}: the facts line says how much is sent`).toBeVisible();
  const previewButton = pack.getByRole('button', { name: `Preview text of ${PACK}`, exact: true });
  await expect(previewButton).toBeVisible();
  // WR-602, D3: scanned with the inclusion toast showing over the AI control; at 375 it sits above the actions sheet.
  await expectToastClear(page, toastWith(page, `${PACK} included in the AI inputs.`), (width ?? 1440) < 768
    ? [packSwitch.locator('xpath=ancestor::label[1]'), previewButton, pack.getByRole('button', { name: `Remove ${PACK}`, exact: true })]
    : [], width, 'Bob’s AI control after the inclusion');

  // §5.3 (D-31): Preview text shows the text the AI will read, as text, and hands focus back.
  await previewButton.click();
  const preview = page.getByRole('dialog', { name: 'Text the AI will read', exact: true });
  await expect(preview.getByRole('heading', { level: 2, name: 'Text the AI will read', exact: true }), `${label}: the preview opens on its title`).toBeFocused();
  await expect(preview).toContainText(`${PACK} · Included · all`);
  await expect(preview).toContainText('CSRM sends this text to the AI as information to analyse, never as instructions.');
  await expect(preview.getByRole('region', { name: 'Text the AI will read, text', exact: true }), `${label}: the stored text`).not.toBeEmpty();
  // 14-UI-REVIEW UI-02: the preview slides up below 768px and in from the end from 768px, with the drawer motion; its
  // overlay (the last open one: at 375 the actions sheet's lies beneath it) fades in at the drawer timing.
  await expectDrawerMotion(preview, (width ?? 1440) < 768 ? 'drawer-in-bottom' : 'drawer-in-end', `${label}: the text preview at ${width}px`);
  await sheetSettled(preview);
  const overlayMotion = await page.locator('.bg-overlay[data-state="open"]').last().evaluate((element) => getComputedStyle(element).animationName);
  expect(overlayMotion, `${label}: the preview's overlay fades in`).toBe('drawer-fade-in');
  await expectNoSeriousViolations(page, `the text preview at ${width}px`);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(previewButton, `${label}: focus returns to Preview text`).toBeFocused();
  // Under reduced motion the preview only fades (the global rule shortens the fade).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await previewButton.click();
  await expect(preview.getByRole('heading', { level: 2, name: 'Text the AI will read', exact: true })).toBeFocused();
  await expectDrawerMotion(preview, 'drawer-fade-in', `${label}: the text preview under reduced motion at ${width}px`);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(previewButton).toBeFocused();
  await page.emulateMedia({ reducedMotion: null });
  await closeAiControl(page, PACK);
  if ((width ?? 1440) < 768) {
    await expect(listedFile(page, PACK, width).getByText(/^AI inputs: Included · all [\d,]+ characters$/), `${label}: the card’s AI line follows`).toBeVisible();
    await expect(listedFile(page, FLOW, width).getByText('AI inputs: Not included', { exact: true }), `${label}: the data-flow document stays out`).toBeVisible();
  } else {
    await expect(listedFile(page, FLOW, width).getByRole('switch', { name: 'Changes the AI inputs', exact: true }), `${label}: the data-flow document stays out`).toHaveAttribute('aria-checked', 'false');
  }
  await expectNoHorizontalOverflow(page, `${label} (Bob’s Files section with the AI control)`);
  await expectNoSeriousViolations(page, `Bob’s request page with the AI inputs at ${width}px`);

  const questionnaireHref = await generateQuestionnaire(page, label);
  await page.goto(questionnaireHref);
  const header = page.getByRole('region', { name: 'AI generation' });
  await header.getByRole('button', { name: 'Show what the AI used' }).click();
  const sheet = page.getByRole('dialog', { name: 'What the AI used' });
  const group = sheet.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: 'Files', exact: true }) });
  await expect(group, `${label}: the sheet has its Files group`).toBeVisible();
  await expect(group.getByText('1 file included', { exact: true }), `${label}: the run included one file`).toBeVisible();
  const link = group.getByRole('link', { name: PACK, exact: true });
  await expect(link, `${label}: the pack, by its name, links to its row`).toHaveAttribute('href', new RegExp(`^${analystPath(documentId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#file-.+$`));
  await expect(group.getByRole('listitem').filter({ hasText: PACK })).toContainText(/Requestor file · [\d,]+ characters sent$/);
  await expect(sheet, `${label}: the data-flow document appears nowhere in what the AI used`).not.toContainText(FLOW);
  await expectNoSeriousViolations(page, `What the AI used with its Files group at ${width}px`);
  testInfo.annotations.push({ type: 'criterion-5', description: `criterion 5 journey in ${Date.now() - journeyStarted} ms at ${width}px` });
  // The pilot's walk, D1 (§7.1; X-10): the run sheet's link closes the sheet and lands on the pack's row on Bob's page.
  await followAndLand(page, link, `${label}: What the AI used’s ${PACK} at ${width}px`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true }), `${label}: the link opens Bob’s request page`).toBeVisible();

  // D-28: the Requestor sees the section's sentence, and nothing of the AI inputs.
  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(listedFile(page, PACK, width)).toHaveCount(1);
  await expect(page.getByRole('switch'), `${label}: Jane sees no switch`).toHaveCount(0);
  await expect(filesSection(page).getByText(/AI inputs|Not included|Included ·/), `${label}: Jane sees no AI facts`).toHaveCount(0);
  await expect(filesSection(page)).toContainText('A Security Analyst may include a file’s text in the information CSRM sends to the AI, within your organisation’s data policy.');
  if ((width ?? 1440) < 768) {
    /*
     * IN-605: below 768px the switch renders only in the phone actions sheet (§3.3, §5.1), so the page-wide check above
     * would hold even for Bob. Jane's own sheet for the included pack is opened: it holds her Remove, and no switch, no AI
     * facts and no Preview text.
     */
    await listedFile(page, PACK, width).getByRole('button', { name: `More actions for ${PACK}`, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: PACK, exact: true });
    await expect(sheet.getByRole('heading', { name: PACK, exact: true }), `${label}: Jane’s actions sheet opens on its title`).toBeFocused();
    await expect(sheet.getByRole('button', { name: `Remove ${PACK}`, exact: true }), `${label}: the sheet holds Jane’s own action`).toBeVisible();
    await expect(sheet.getByRole('switch'), `${label}: Jane’s actions sheet holds no switch`).toHaveCount(0);
    await expect(sheet.getByText(/AI inputs|Not included|Included ·/), `${label}: Jane’s actions sheet holds no AI facts`).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: /^Preview text/ }), `${label}: and no Preview text`).toHaveCount(0);
    await sheet.getByRole('button', { name: `Close actions for ${PACK}`, exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
});

const questionnaireSignal = 'AI inputs changed since this questionnaire was generated';

/**
 * Submits the request whose page is open, as `submitRequestFromItsPage` does, measuring the shared confirmation's
 * buttons first (O8; direction §4 Buttons: the touch-target height below 768px, 36px from 768px).
 */
async function submitMeasuringItsDialog(page: Page, width: number | undefined, label: string): Promise<void> {
  const requestActions = page.getByRole('region', { name: 'Request actions' });
  await expect(requestActions).toBeVisible();
  await requestActions.getByRole('button', { name: 'Submit request' }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Submit this assessment request?' });
  await expect(confirmation).toBeVisible();
  for (const name of ['Cancel', 'Submit request']) {
    await expectTargetSize(confirmation.getByRole('button', { name, exact: true }), width, `${label}: the confirmation’s ${name}`);
  }
  await confirmation.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Request submitted.')).toBeVisible();
  await expect(requestActions.getByText('Submitted', { exact: true })).toBeVisible();
}
const XLSX = 'vendor-questionnaire.xlsx';
const SECOND_ANALYST = 'Sam Analyst';

/**
 * Bob replaces the questionnaire in analyst review from the hub (Phase 10 D-08) and waits until the deterministic job has
 * finished; returns the hub's link to the questionnaire the new run produced.
 */
async function replaceQuestionnaire(page: Page, documentId: string, label: string): Promise<string> {
  await page.getByRole('button', { name: 'Replace questionnaire', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
  await expect(confirm, `${label}: Replace asks first`).toBeVisible();
  await confirm.getByRole('button', { name: 'Replace questionnaire', exact: true }).click();
  await expect(confirm, `${label}: Strapi accepted the replacement`).toBeHidden({ timeout: 45_000 });
  const finished = page.getByRole('link', { name: 'Review generated questionnaire' }).or(page.getByText('Questionnaire generation is ready for review').first());
  await expect(finished.first(), `${label}: the replacement run finished`).toBeVisible({ timeout: 60_000 });
  await page.goto(analystPath(documentId));
  const hubLink = page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ });
  const href = await hubLink.first().getAttribute('href', { timeout: 15_000 });
  expect(href, `${label}: the hub links the new questionnaire`).toMatch(/^\/app\/review\/questionnaires\/[^/]+$/);
  return href!;
}

/*
 * UAT-012, the phase's yardstick scenario, end to end for all four personas (ROADMAP success criteria 1 to 5; D-39, D-40;
 * 14-CONTEXT "Specific Ideas"). Jane creates the payroll SaaS request from the new-request form with the vendor's security
 * pack, the data-flow document and the completed questionnaire, and submits it. Bob generates the questionnaire. Jane later
 * writes that the vendor sent their architecture deck and attaches it to the note. Bob sees her note flagged as new and all
 * four files with who added each and when; he includes the security pack in the AI inputs; the questionnaire page's files
 * line counts the inclusion and its AI-inputs signal names the pack `Included since`; he replaces the questionnaire, and
 * What the AI used lists the pack and not the data-flow document. The second analyst removes the spreadsheet; Bob sees who
 * removed it, with no Restore of his own; the second analyst restores it. The Secondary Requestor opens Jane's request by its
 * URLs and finds nothing of it or its files. Axe runs at every page change, and with each toast showing (WR-602), at 1440
 * and 375.
 */
test('COLLAB02_UAT012_SCENARIO @journey: files at intake and with a note, inclusion, regeneration, removal and restore across all four personas', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_UAT012_SCENARIO';
  const stamp = Date.now().toString(36);
  const title = `Payroll SaaS UAT-012 ${testInfo.project.name} ${stamp}`;
  const intake = [PACK, 'data-flow.docx', XLSX] as const;
  const FLOW = 'data-flow.docx';
  const allFiles = [...intake, DECK];
  const scenarioStarted = Date.now();

  // 1. Jane creates the payroll SaaS request with its three files from the new-request form, and submits it.
  const { documentId, requestNumber } = await janeCreatesWithFiles(page, title, intake);
  for (const name of intake) await expect(listedFile(page, name, width), `${label}: ${name} arrived with the draft`).toHaveCount(1);
  await expectNoSeriousViolations(page, `Jane’s new draft with three files at ${width}px`);
  await submitMeasuringItsDialog(page, width, label);

  // 2. Bob generates the questionnaire from the hub, before any file is in the AI inputs.
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(filesSection(page).getByText('3 files', { exact: true }), `${label}: Bob sees the three intake files`).toBeVisible();
  await expectNoSeriousViolations(page, `Bob’s request page with three files at ${width}px`);
  await generateQuestionnaire(page, label);

  // 3. Jane writes that the vendor sent the architecture deck, and adds it with her note.
  await switchTo(page, 'Requestor');
  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const notes = notesSection(page);
  const composer = notes.getByRole('textbox', { name: 'Add a note' });
  await composer.fill(deckNote);
  const chooser = page.waitForEvent('filechooser');
  await notes.getByRole('button', { name: 'Attach files', exact: true }).click();
  await (await chooser).setFiles(join(fixtures, DECK));
  await expect(notes.getByRole('list', { name: 'Files to add with this note', exact: true }).getByRole('listitem').filter({ hasText: DECK })).toHaveCount(1);
  await expectNoSeriousViolations(page, `Jane’s composer with the deck at ${width}px`);
  await notes.getByRole('button', { name: 'Add note', exact: true }).click();
  const janesNote = noteWith(page, requestNumber, deckNote);
  await expect(janesNote.getByRole('list', { name: 'Files with this note', exact: true }).getByRole('link', { name: DECK, exact: true }), `${label}: the deck arrives with its note`)
    .toHaveAttribute('href', /^#file-/, { timeout: 60_000 });
  await expect(filesSection(page).getByText('4 files', { exact: true }), `${label}: Jane’s Files section counts four`).toBeVisible();
  await expectNoHorizontalOverflow(page, `${label} (Jane’s page with the note and four files)`);
  await expectNoSeriousViolations(page, `Jane’s request page with her note and four files at ${width}px`);

  // 4. Bob sees the note flagged and all four files with who added each and when.
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const janesForBob = noteWith(page, requestNumber, deckNote);
  await expect(janesForBob.getByText('New', { exact: true }), `${label}: Jane’s note is flagged new for Bob`).toBeVisible();
  await expect(janesForBob.getByRole('list', { name: 'Files with this note', exact: true }).getByRole('link', { name: DECK, exact: true })).toBeVisible();
  const files = filesSection(page);
  await expect(files.getByText('4 files', { exact: true }), `${label}: Bob sees all four files`).toBeVisible();
  for (const name of allFiles) {
    const row = listedFile(page, name, width);
    await expect(row, `${label}: ${name} is listed for Bob`).toHaveCount(1);
    await expect(row, `${label}: who added ${name}`).toContainText('Jane Doe');
    await expect(row, `${label}: in which part`).toContainText('Requestor');
    await expect(row.locator('time').first(), `${label}: when ${name} was added`).toBeVisible();
  }
  await expectNoHorizontalOverflow(page, `${label} (Bob with four files and the note)`);
  await expectNoSeriousViolations(page, `Bob’s request page with Jane’s note and four files at ${width}px`);
  // WR-602: Bob lands on the thread, so he reads Jane's note and no New flag leaks into a later journey.
  await page.goto(`${analystPath(documentId)}#notes`);
  await expectNoneNewOnNextRender(page, requestNumber, `${label} (Bob)`);

  // 5. Bob includes the security pack in the AI inputs; the data-flow document stays out.
  const pack = await aiControlFor(page, PACK, width);
  const packSwitch = pack.getByRole('switch', { name: 'Changes the AI inputs', exact: true });
  await expect(packSwitch).toHaveAttribute('aria-checked', 'false');
  await expectNoSeriousViolations(page, `Bob’s AI control on the pack at ${width}px`);
  await packSwitch.click();
  await expect(toastWith(page, `${PACK} included in the AI inputs.`), `${label}: the inclusion toast`).toBeVisible({ timeout: 30_000 });
  await expect(packSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(pack.getByText(includedAll), `${label}: Included · all {m} characters`).toBeVisible();
  // WR-602, D3: scanned with the inclusion toast showing over the AI control; at 375 it sits above the actions sheet.
  await expectToastClear(page, toastWith(page, `${PACK} included in the AI inputs.`), (width ?? 1440) < 768
    ? [packSwitch.locator('xpath=ancestor::label[1]'), pack.getByRole('button', { name: `Preview text of ${PACK}`, exact: true }), pack.getByRole('button', { name: `Remove ${PACK}`, exact: true })]
    : [], width, 'Bob’s AI control on the pack after the inclusion');
  await closeAiControl(page, PACK);
  /*
   * The layout shown, not the viewport, says where the data-flow document's AI state reads, as `aiControlFor` does: from
   * 768px the cards show wherever the table does not fit the list (the pilot's walk, D2), as it can at 1440 with four
   * files and a note link.
   */
  const flow = listedFile(page, FLOW, width);
  const flowSwitch = flow.getByRole('switch', { name: 'Changes the AI inputs', exact: true });
  const flowCardLine = flow.getByText('AI inputs: Not included', { exact: true });
  await expect(flowSwitch.or(flowCardLine), `${label}: the data-flow document shows its AI state`).toBeVisible();
  if (await tableShown(page)) {
    await expect(flowSwitch, `${label}: the data-flow document stays out`).toHaveAttribute('aria-checked', 'false');
  } else {
    await expect(flowCardLine, `${label}: the data-flow document stays out`).toBeVisible();
  }
  await expectNoSeriousViolations(page, `Bob’s request page with the pack included at ${width}px`);

  // 6. The questionnaire page counts the inclusion and its AI-inputs signal names the pack.
  await page.goto(analystPath(documentId));
  const firstQuestionnaire = await page.getByRole('region', { name: 'Request relationships' }).getByRole('link', { name: /^QNR-/ }).first().getAttribute('href');
  expect(firstQuestionnaire, `${label}: the hub links the generated questionnaire`).toMatch(/^\/app\/review\/questionnaires\/[^/]+$/);
  await page.goto(firstQuestionnaire!);
  const context = page.locator('[data-request-context]');
  await expect(context, `${label}: the files line counts the four and the one included`).toContainText('4 files · 1 included in the AI inputs');
  await expect(context.getByRole('link', { name: '4 files', exact: true })).toHaveAttribute('href', `${analystPath(documentId)}#files`);
  const header = page.getByRole('region', { name: 'AI generation' });
  const signal = header.getByRole('list', { name: questionnaireSignal });
  await expect(signal, `${label}: the signal names what changed`).toBeVisible();
  const packItem = signal.getByRole('listitem').filter({ has: page.getByRole('link', { name: PACK, exact: true }) });
  await expect(packItem, `${label}: the signal names the pack`).toHaveCount(1);
  await expect(packItem).toContainText('Included since');
  await expect(packItem.getByRole('link', { name: PACK, exact: true })).toHaveAttribute('href', new RegExp(`^${analystPath(documentId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#file-.+$`));
  await expect(signal, `${label}: the data-flow document did not change the AI inputs`).not.toContainText(FLOW);
  await expect(header.getByText('The AI hasn’t seen these changes.', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, `${label} (the questionnaire with the signal)`);
  await expectNoSeriousViolations(page, `Bob’s questionnaire review with the files signal at ${width}px`);
  /*
   * The pilot's walk, D1 (§6.1, §6.2; X-10): the files line lands on Bob's Files section, focusing its heading, and the
   * signal's pack lands on the pack's row (its card at 375), focusing it.
   */
  await followAndLand(page, context.getByRole('link', { name: '4 files', exact: true }), `${label}: the questionnaire’s 4 files at ${width}px`);
  await page.goto(firstQuestionnaire!);
  await followAndLand(page, packItem.getByRole('link', { name: PACK, exact: true }), `${label}: the signal’s ${PACK} at ${width}px`);

  // 7. Bob regenerates; What the AI used lists the pack and not the data-flow document.
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const regenerated = await replaceQuestionnaire(page, documentId, label);
  await page.goto(regenerated);
  const newHeader = page.getByRole('region', { name: 'AI generation' });
  await expect(newHeader.getByRole('list', { name: questionnaireSignal }), `${label}: the new run has seen the inclusion`).toHaveCount(0);
  await newHeader.getByRole('button', { name: 'Show what the AI used' }).click();
  const sheet = page.getByRole('dialog', { name: 'What the AI used' });
  const group = sheet.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: 'Files', exact: true }) });
  await expect(group, `${label}: the sheet has its Files group`).toBeVisible();
  await expect(group.getByText('1 file included', { exact: true }), `${label}: the run included one file`).toBeVisible();
  await expect(group.getByRole('link', { name: PACK, exact: true }), `${label}: the pack, by its name`).toHaveAttribute('href', /#file-.+$/);
  await expect(group.getByRole('listitem').filter({ hasText: PACK })).toContainText(/Requestor file · [\d,]+ characters sent$/);
  await expect(sheet, `${label}: the data-flow document appears nowhere in what the AI used`).not.toContainText(FLOW);
  await expectNoSeriousViolations(page, `What the AI used after the regeneration at ${width}px`);
  // The pilot's walk, D1 (§7.1): the run sheet's pack closes the sheet and lands on the pack's row on Bob's page.
  await followAndLand(page, group.getByRole('link', { name: PACK, exact: true }), `${label}: What the AI used’s ${PACK} at ${width}px`);
  await expect(sheet).toHaveCount(0);

  // 8. The second analyst removes the spreadsheet.
  await switchTo(page, 'Second Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(listedFile(page, XLSX, width)).toHaveCount(1);
  const xlsxTarget = (await listedFile(page, XLSX, width).locator('[id^="file-"]').first().getAttribute('id')) ?? '';
  expect(xlsxTarget, `${label}: the spreadsheet’s row is a link target`).toMatch(/^file-.+$/);
  await expectNoSeriousViolations(page, `the second analyst’s request page at ${width}px`);
  await removeListedFile(page, XLSX, width);
  await expect(page.getByRole('alertdialog'), `${label}: nothing asks first`).toHaveCount(0);
  await expect(toastWith(page, `${XLSX} removed.`), `${label}: the removal toast`).toBeVisible();
  await expect(listedFile(page, XLSX, width), `${label}: the spreadsheet leaves the list`).toHaveCount(0);
  await expectToastClear(page, toastWith(page, `${XLSX} removed.`), [], width, 'the second analyst’s request page after the removal');
  await expect(filesSection(page).getByText('3 files', { exact: true })).toBeVisible();
  // WR-602: the second analyst reads Jane's note too, on the thread.
  await page.goto(`${analystPath(documentId)}#notes`);
  await expectNoneNewOnNextRender(page, requestNumber, `${label} (the second analyst)`);

  // 9. Bob sees who removed it and when, and has no Restore of his own.
  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expect(listedFile(page, XLSX, width), `${label}: the removed spreadsheet is not in Bob’s list`).toHaveCount(0);
  const bobsGroup = await openRemovedGroup(page, 1);
  const bobsRecord = bobsGroup.getByRole('listitem').filter({ hasText: XLSX });
  await expect(bobsRecord, `${label}: who added it`).toContainText('Added by Jane Doe · ');
  await expect(bobsRecord, `${label}: Bob sees the second analyst removed it`).toContainText(`Removed by ${SECOND_ANALYST} · `);
  await expect(bobsRecord.locator('time'), `${label}: when it was added and when it was removed`).toHaveCount(2);
  await expect(bobsRecord.getByRole('button', { name: /^Restore/ }), `${label}: only the remover may restore it`).toHaveCount(0);
  await expectNoHorizontalOverflow(page, `${label} (Bob with the removed group open)`);
  await expectNoSeriousViolations(page, `Bob’s request page with the removed group open at ${width}px`);
  /*
   * WR-506 and D1 (§3.5, §7.2): a link to a file removed since it was named, as the too-large failure's list may hold,
   * opens the removed group on arrival and lands on the file's removed row, focusing it.
   */
  await page.goto('/app');
  await page.goto(`${analystPath(documentId)}#${encodeURIComponent(xlsxTarget)}`);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  await expectLandedOn(page, xlsxTarget, page.locator(`[id="${xlsxTarget}"]`), `${label}: a link to the removed ${XLSX} at ${width}px`);
  await softly(filesSection(page).getByRole('button', { name: 'Hide removed files', exact: true }), `${label}: the link opened the removed group`).toHaveAttribute('aria-expanded', 'true');

  // 10. The second analyst restores it.
  await switchTo(page, 'Second Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  const samsGroup = await openRemovedGroup(page, 1);
  const samsRecord = samsGroup.getByRole('listitem').filter({ hasText: XLSX });
  await expect(samsRecord).toContainText(`Removed by ${SECOND_ANALYST} · `);
  await expectNoSeriousViolations(page, `the second analyst’s removed group at ${width}px`);
  await samsRecord.getByRole('button', { name: `Restore ${XLSX}`, exact: true }).click();
  await expect(toastWith(page, `${XLSX} restored.`), `${label}: the restore toast`).toBeVisible();
  await expect(listedFile(page, XLSX, width), `${label}: the spreadsheet is back in the list`).toHaveCount(1);
  // D5 (§3.5): focus lands on the restored file's first action, its Download, at both widths (never More actions at 375).
  await expect(listedFile(page, XLSX, width).getByRole('button', { name: `Download ${XLSX}`, exact: true }), `${label}: focus on the restored file’s Download`).toBeFocused();
  await expectToastClear(page, toastWith(page, `${XLSX} restored.`), [], width, 'the second analyst’s request page after the restore');
  await expect(filesSection(page).getByText('4 files', { exact: true })).toBeVisible();
  await expect(filesSection(page).getByRole('button', { name: /removed files/ }), `${label}: nothing is removed now`).toHaveCount(0);
  await expectNoHorizontalOverflow(page, `${label} (the second analyst after the restore)`);

  // 11. The Secondary Requestor opens Jane's request by its URLs and finds nothing of it or its files.
  await switchTo(page, 'Secondary Requestor');
  const main = page.getByRole('main');
  const nothingOfJanes = async (where: string) => {
    await expect(page.getByRole('region', { name: 'Files', exact: true }), `${label}: no Files section (${where})`).toHaveCount(0);
    const content = await page.content();
    for (const name of allFiles) expect(content, `${label}: no ${name} (${where})`).not.toContain(name);
    expect(content, `${label}: no title of Jane’s (${where})`).not.toContain(title);
    expect(content, `${label}: no number of Jane’s (${where})`).not.toContain(requestNumber);
  };
  await page.goto(requestorPath(documentId));
  await expect(main.getByRole('heading', { level: 1, name: 'Page not found', exact: true }), `${label}: the Requestor page’s not-found state`).toBeVisible();
  await nothingOfJanes('the Requestor page');
  await expectNoSeriousViolations(page, `the Secondary Requestor on Jane’s request at ${width}px`);
  await page.goto(analystPath(documentId));
  await expect(main.getByRole('alert').filter({ hasText: 'You don’t have permission to review this request' }), `${label}: the analyst page’s own refusal`).toBeVisible();
  await nothingOfJanes('the analyst page');
  await expectNoSeriousViolations(page, `the Secondary Requestor on the analyst page at ${width}px`);
  testInfo.annotations.push({ type: 'uat-012', description: `scenario in ${Date.now() - scenarioStarted} ms at ${width}px` });
});

/*
 * WR-605 (14-UI-SPEC "Accessibility contract", Automated; §3.4, §3.6): the file states no journey can reach. The
 * development scanner double passes or refuses a file at once, so nothing waits for its malware check or is blocked
 * after it was stored, and releasing a request in the browser is the whole assessment journey. Strapi's development
 * fixture (seed-request-attachment-states.ts, behind IDAMBOX_SEED_CSRM and the development identity) holds them on two of
 * Jane's requests, by value here as every seeded fixture is. Both are read-only: no journey changes them, so both
 * projects read the same states.
 */
const FILE_STATES = {
  requestNumber: 'RAR-E2E-FILES-STATES-001',
  title: 'Remote support access for the payroll servers',
  pending: 'provider-assurance-report.pdf',
  blocked: 'remote-support-tool.docx',
  /* 14-UI-REVIEW UI-01: Jane's note, which the waiting file came with. */
  note: 'Attached the provider assurance report for the remote support service.',
} as const;
const FILES_RELEASED = {
  requestNumber: 'RAR-E2E-FILES-RELEASED-001',
  title: 'Finance records archive migration',
  file: 'retention-schedule.txt',
} as const;

/** Finds one of Jane's seeded requests by its number in her list, and returns its document id. */
async function janesFixtureRequest(page: Page, fixture: { requestNumber: string; title: string }): Promise<string> {
  await switchTo(page, 'Requestor');
  await page.goto(`/app/requests?q=${encodeURIComponent(fixture.requestNumber)}`);
  await expect(page.getByRole('heading', { level: 1, name: 'My requests', exact: true })).toBeVisible();
  const link = page.getByRole('main').getByRole('link', { name: fixture.title, exact: true }).filter({ visible: true });
  await expect(link, `${fixture.requestNumber} is in Jane’s list`).toHaveCount(1);
  const href = await link.getAttribute('href');
  expect(href, `${fixture.requestNumber} links to its request page`).toMatch(/^\/app\/requests\/[^/]+$/);
  return decodeURIComponent(href!.split('/').at(-1)!);
}

/** §3.4: a waiting and a blocked file each show their badge and line, and neither can be downloaded. */
async function expectWaitingAndBlocked(page: Page, label: string, width: number | undefined): Promise<void> {
  const files = filesSection(page);
  await expect(files.getByText('2 files', { exact: true }), `${label}: both files are listed`).toBeVisible();
  const pending = listedFile(page, FILE_STATES.pending, width);
  await expect(pending, `${label}: the waiting file is listed once`).toHaveCount(1);
  await expect(pending.getByText('Waiting for malware check', { exact: true }), `${label}: the waiting badge`).toBeVisible();
  await expect(pending.getByText('It can be downloaded once it passes. Refresh the page later to see.', { exact: true }), `${label}: the waiting line`).toBeVisible();
  await expect(pending.getByRole('button', { name: `Download ${FILE_STATES.pending}`, exact: true }), `${label}: a waiting file can’t be downloaded`).toHaveCount(0);
  const blocked = listedFile(page, FILE_STATES.blocked, width);
  await expect(blocked, `${label}: the blocked file stays in the list (D-21)`).toHaveCount(1);
  await expect(blocked.getByText('Blocked', { exact: true }), `${label}: the blocked badge`).toBeVisible();
  await expect(blocked.getByText('Malware found: Csrm.Test.Signature. The file was deleted and can’t be downloaded.', { exact: true }), `${label}: the blocked line names the detection`).toBeVisible();
  await expect(blocked.getByRole('button', { name: `Download ${FILE_STATES.blocked}`, exact: true }), `${label}: a blocked file can’t be downloaded`).toHaveCount(0);
}

/**
 * 14-UI-REVIEW UI-01 (the pilot's ruling; X-21, X-23; 14-UI-SPEC §4.3 at 375): Jane's note brought the waiting file, so
 * its chip carries the longest state badge, `Waiting for malware check`. Below 768px the badge takes its own line beneath
 * the name, and the name keeps the chip's width: its line (the icon, the name and the size) spans the chip's content box,
 * so the name is as wide as the chip allows, or it shows whole. From 768px the chip stays one row, the badge at its end.
 * jsdom lays nothing out, so this is the proof; it logs the boxes it measured.
 */
async function expectWaitingChipKeepsTheName(page: Page, label: string, width: number | undefined): Promise<void> {
  const chips = noteWith(page, FILE_STATES.requestNumber, FILE_STATES.note).getByRole('list', { name: 'Files with this note', exact: true });
  const name = chips.getByRole('link', { name: FILE_STATES.pending, exact: true });
  await expect(name, `${label}: the note's chip names the waiting file, linking to its row`).toHaveAttribute('href', /^#file-/);
  const badge = chips.getByText('Waiting for malware check', { exact: true });
  await expect(badge, `${label}: the chip carries the waiting badge`).toBeVisible();
  const chip = chips.locator('[data-file-chip]').filter({ has: page.getByRole('link', { name: FILE_STATES.pending, exact: true }) });
  const measured = await chip.evaluate((element, fileName) => {
    const box = (node: Element) => {
      const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const style = getComputedStyle(element);
    const outer = box(element);
    const content = {
      left: outer.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
      right: outer.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
    };
    const nameElement = [...element.querySelectorAll('a')].find((link) => link.textContent === fileName)!;
    const badgeElement = [...element.querySelectorAll('[data-slot="badge"]')].find((node) => node.textContent?.includes('Waiting for malware check'))!;
    const sizeElement = nameElement.nextElementSibling!;
    return {
      chip: outer,
      content: { ...content, width: content.right - content.left },
      name: box(nameElement),
      nameWhole: nameElement.scrollWidth <= nameElement.clientWidth,
      size: box(sizeElement),
      icon: box(element.querySelector('svg')!),
      badge: box(badgeElement),
    };
  }, FILE_STATES.pending);
  const px = (value: number) => Math.round(value * 10) / 10;
  console.log(`CHIP ${label} at ${width}px: content ${px(measured.content.width)} wide; name ${px(measured.name.width)}x${px(measured.name.height)} (${measured.nameWhole ? 'whole' : 'ends in an ellipsis'}); size ${px(measured.size.width)}; badge ${px(measured.badge.width)}x${px(measured.badge.height)} at y ${px(measured.badge.top - measured.chip.top)} (name at y ${px(measured.name.top - measured.chip.top)})`);
  if ((width ?? 1440) < 768) {
    expect(measured.badge.top, `${label}: below 768px the badge sits on its own line, beneath the name`).toBeGreaterThanOrEqual(Math.max(measured.name.bottom, measured.size.bottom) - 0.5);
    expect(measured.badge.left, `${label}: the badge's line starts at the chip's content edge`).toBeLessThanOrEqual(measured.content.left + 0.5);
    expect(measured.icon.left, `${label}: the name's line starts at the chip's content edge`).toBeLessThanOrEqual(measured.content.left + 0.5);
    if (!measured.nameWhole) {
      expect(measured.size.right, `${label}: a name cut short fills the chip's width, its size at the content edge`).toBeGreaterThanOrEqual(measured.content.right - 0.5);
    }
    expect(measured.name.width, `${label}: the name is not cut to a few characters`).toBeGreaterThan(measured.content.width / 2);
  } else {
    expect(measured.badge.top, `${label}: from 768px the chip is one row, the badge beside the name`).toBeLessThan(measured.name.bottom);
    expect(measured.badge.left, `${label}: the badge at the row's end, after the size`).toBeGreaterThanOrEqual(measured.size.right);
    expect(measured.nameWhole, `${label}: the name shows whole at 1440`).toBe(true);
  }
}

/*
 * WR-605: Jane's submitted request holds a file waiting for its malware check and a blocked one. Jane's request page and
 * Bob's analyst page each show both states with their badges and lines and no Download, and each is scanned with axe
 * and for overflow at the project's width. Bob's waiting file says when it can be included in the AI inputs (§5.1).
 */
test('COLLAB02_FILE_STATES @journey: a file waiting for its malware check and a blocked file, on both request pages', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_FILE_STATES';
  const documentId = await janesFixtureRequest(page, FILE_STATES);

  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: FILE_STATES.title, exact: true })).toBeVisible();
  await expectWaitingAndBlocked(page, `${label} (Jane)`, width);
  // 14-UI-REVIEW UI-01: the waiting file's chip on Jane's note keeps the name's width at 375, and one row at 1440.
  await expectWaitingChipKeepsTheName(page, `${label} (Jane’s note)`, width);
  // The pilot's walk, D2 (§3.2): with a waiting and a blocked file, whose badges widen the actions, the list still fits.
  await expectListFits(page, filesSection(page), `${label} (Jane’s list at ${width}px)`);
  await expectNoHorizontalOverflow(page, `${label} (Jane’s request page)`);
  await expectNoSeriousViolations(page, `Jane’s request with a waiting and a blocked file at ${width}px`);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: FILE_STATES.title, exact: true })).toBeVisible();
  await expectWaitingAndBlocked(page, `${label} (Bob)`, width);
  // §5.1: the AI inputs cell says it where the table shows; otherwise the card's AI line (`AI inputs: …`) does.
  const includedLater = 'It can be included once it passes the malware check.';
  await expect(listedFile(page, FILE_STATES.pending, width).getByText((await tableShown(page)) ? includedLater : `AI inputs: ${includedLater}`, { exact: true }), `${label}: Bob’s waiting file says when it can be included`).toBeVisible();
  await expect(listedFile(page, FILE_STATES.blocked, width).getByRole('switch'), `${label}: a blocked file takes no AI control`).toHaveCount(0);
  await expectListFits(page, filesSection(page), `${label} (Bob’s list with the AI inputs at ${width}px)`, FILE_STATES.pending);
  await expectNoHorizontalOverflow(page, `${label} (Bob’s request page)`);
  await expectNoSeriousViolations(page, `Bob’s request page with a waiting and a blocked file at ${width}px`);
});

/** §3.6: files closed at release; the record stays readable, and nothing can be added, removed or included. */
async function expectFilesClosed(page: Page, label: string, width: number | undefined): Promise<void> {
  const files = filesSection(page);
  await expect(files.getByText('Files closed when the assessment was released. They stay here as part of the record.', { exact: true }), `${label}: the read-only line`).toBeVisible();
  await expect(files.getByRole('button', { name: /^(Choose files|Add files with a note)$/ }), `${label}: nothing can be added`).toHaveCount(0);
  const entry = listedFile(page, FILES_RELEASED.file, width);
  await expect(entry, `${label}: the file stays as part of the record`).toHaveCount(1);
  await expect(entry.getByRole('button', { name: `Download ${FILES_RELEASED.file}`, exact: true }), `${label}: it can still be downloaded`).toBeVisible();
  await expect(files.getByRole('button', { name: /^(Remove|Restore|More actions for) / }), `${label}: no file can be removed or restored`).toHaveCount(0);
  await expect(files.getByRole('switch'), `${label}: no file can change the AI inputs`).toHaveCount(0);
}

/*
 * WR-605: Jane's released request keeps its file. On her request page and Bob's analyst page the Files section says files
 * closed at release, offers no add, remove, restore or AI change, and still offers Download; each page is scanned with
 * axe and for overflow at the project's width.
 */
test('COLLAB02_FILES_CLOSED @journey: a released request’s files are read-only on both request pages', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_FILES_CLOSED';
  const documentId = await janesFixtureRequest(page, FILES_RELEASED);

  await page.goto(requestorPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: FILES_RELEASED.title, exact: true })).toBeVisible();
  await expectFilesClosed(page, `${label} (Jane)`, width);
  await expectNoHorizontalOverflow(page, `${label} (Jane’s request page)`);
  await expectNoSeriousViolations(page, `Jane’s released request with its file at ${width}px`);

  await switchTo(page, 'Security Analyst');
  await page.goto(analystPath(documentId));
  await expect(page.getByRole('heading', { level: 1, name: FILES_RELEASED.title, exact: true })).toBeVisible();
  await expectFilesClosed(page, `${label} (Bob)`, width);
  await expectNoHorizontalOverflow(page, `${label} (Bob’s request page)`);
  await expectNoSeriousViolations(page, `Bob’s released request with its file at ${width}px`);
});

/*
 * WR-605 (14-UI-SPEC §1.3, §2.1): on the new-request form Jane chooses a program built in memory beside the data-flow
 * document. The browser refuses the program before anything is sent: its row says why, with what to do, beside the good
 * file waiting to be added with the draft. The form with the refused row is scanned with axe and for overflow.
 */
test('COLLAB02_NEW_FORM_REFUSED_ROW @journey: the new-request form lists a refused file, with its reason, beside a good one', async ({ page }) => {
  test.setTimeout(180_000);
  await expectStrapiHealthy(page);
  const width = page.viewportSize()?.width;
  const label = 'COLLAB02_NEW_FORM_REFUSED_ROW';
  await switchTo(page, 'Requestor');
  await page.goto('/app/requests/new');
  const section = supportingFiles(page);
  await expect(section.getByRole('heading', { level: 2, name: 'Supporting files', exact: true })).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await section.getByRole('button', { name: 'Choose files', exact: true }).click();
  await (await chooser).setFiles([
    { name: 'tool.exe', mimeType: 'application/octet-stream', buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(254)]) },
    { name: 'data-flow.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: readFileSync(join(fixtures, 'data-flow.docx')) },
  ]);
  const queue = section.getByRole('list', { name: 'Files being added', exact: true });
  const refused = queue.getByRole('listitem').filter({ hasText: 'tool.exe' });
  await expect(refused, `${label}: the program is listed once`).toHaveCount(1);
  await expect(refused, `${label}: it says why it was not added and what to add instead`).toContainText('Not added. This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.');
  await expect(refused.getByRole('button', { name: 'Choose another file to replace tool.exe', exact: true })).toBeVisible();
  await expect(refused.getByRole('button', { name: 'Remove from list: tool.exe', exact: true })).toBeVisible();
  const good = queue.getByRole('listitem').filter({ hasText: 'data-flow.docx' });
  await expect(good, `${label}: the good file waits for the draft`).toHaveCount(1);
  await expect(good, `${label}: the good file is not refused`).not.toContainText('Not added.');
  await expect(section, `${label}: only the good file takes a place`).toContainText('19 more can be added to this request');

  await expectNoHorizontalOverflow(page, `${label} (the form with a refused row)`);
  await expectNoSeriousViolations(page, `the new-request form with a refused row at ${width}px`);

  // §2.2 and O8: saving keeps the refused row and focuses the alert, whose Go to draft is a phone action at 375.
  await page.getByRole('textbox', { name: 'Request title' }).fill(`Refused row ${width}px ${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const notAdded = page.getByRole('group', { name: '1 file wasn’t added', exact: true });
  await expect(notAdded, `${label}: the alert takes focus once the good file is added`).toBeFocused({ timeout: 60_000 });
  const box = await expectTargetSize(notAdded.getByRole('link', { name: 'Go to draft', exact: true }), width, `${label}: Go to draft`);
  if ((width ?? 1440) < 768) expect(box.width, `${label}: Go to draft spans its column`).toBeGreaterThanOrEqual(200);
  await expectNoHorizontalOverflow(page, `${label} (the saved draft with a file not added)`);
  await expectNoSeriousViolations(page, `the new-request form after saving with a file not added at ${width}px`);
});

/** 12 MiB: above Next's 10 MB default proxy clone, which would cut the body short without the raised limit (Pitfall 1). */
const LARGE_FILE_BYTES = 12_582_912;

/*
 * D-25 and T-14-50 (14-RESEARCH Settled 6, Pitfall 1): a file larger than Next's 10 MB proxy clone arrives whole. Jane
 * adds a 12 MiB text file, built in memory, to her draft on its request page; it is added, and downloading it gives back
 * exactly the bytes she chose. Desktop only: the transfer, not the layout, is under test.
 */
test('COLLAB02_LARGE_UPLOAD: a 12 MiB file is added to Jane’s draft and downloads whole', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await expectStrapiHealthy(page);
  const label = 'COLLAB02_LARGE_UPLOAD';
  const name = 'payroll-vendor-evidence.txt';
  const content = Buffer.alloc(LARGE_FILE_BYTES, 'Payroll vendor evidence for the security review.\n');
  expect(content.length).toBe(LARGE_FILE_BYTES);
  await janesDraft(page, `A large file on Jane’s draft ${Date.now().toString(36)}`);

  const started = Date.now();
  await chooseFiles(page, { name, mimeType: 'text/plain', buffer: content });
  const files = filesSection(page);
  await expect(files.getByText('1 of 1 files added', { exact: true }), `${label}: the count line`).toBeVisible({ timeout: 120_000 });
  const row = listedFile(page, name, page.viewportSize()?.width);
  await expect(row, `${label}: the file joins the Files list`).toHaveCount(1);
  testInfo.annotations.push({ type: 'large-upload', description: `12 MiB chosen to listed in ${Date.now() - started} ms` });
  await expect(row).toContainText('12.0 MB');

  const saved = page.waitForEvent('download');
  await row.getByRole('button', { name: `Download ${name}`, exact: true }).click();
  const download = await saved;
  const bytes = readFileSync((await download.path())!);
  expect(bytes.length, `${label}: exactly the bytes chosen`).toBe(LARGE_FILE_BYTES);
  expect(bytes.equals(content), `${label}: the same bytes`).toBe(true);
});

/*
 * D-25 and T-14-49 (CR-401, CR-402, IN-401, IN-602): outside the pages that add files, every POST keeps the 6 MB ceiling,
 * answered 413 by the proxy before Next reads the body. That holds for the shapes Next treats as a possible Server Action
 * without `Next-Action` (a multipart or an urlencoded body) and for a post carrying a prefetch header, which once skipped
 * the proxy. On an attachment page only a multipart post may be larger: the proxy admits a 7 MB multipart action post,
 * and Next then answers it 404 for its unknown action id before it reads the body, so the gate, not Next's 26 MB limit,
 * is what this proves; a 7 MB text action post there is refused. The 12 MiB upload above proves a large file arrives.
 * Each check is soft, so a run names every shape that gets through. Desktop only.
 */
test('ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES: a 7 MB post is refused outside the attachment pages, and on them unless it is multipart', async ({ page }) => {
  test.setTimeout(180_000);
  await switchTo(page, 'Requestor');
  const label = 'ACTION_BODY_LIMIT';
  const body = Buffer.alloc(7_000_000, 'x');
  const textAction = { 'next-action': '0', 'content-type': 'text/plain;charset=UTF-8' };
  const evidence = { file: { name: 'vendor-evidence.txt', mimeType: 'text/plain', buffer: body } };
  const outside: [string, Parameters<typeof page.request.post>[1]][] = [
    ['a 7 MB Server Action post', { headers: textAction, data: body }],
    ['a 7 MB multipart post with no Next-Action (CR-401)', { multipart: evidence }],
    ['a 7 MB urlencoded post (CR-401)', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: body }],
    ['a 7 MB action post carrying purpose: prefetch (CR-402)', { headers: { ...textAction, purpose: 'prefetch' }, data: body }],
    ['a 7 MB action post carrying next-router-prefetch: 1 (CR-402)', { headers: { ...textAction, 'next-router-prefetch': '1' }, data: body }],
  ];
  for (const [what, options] of outside) {
    const response = await page.request.post('/app/requests', { ...options, maxRedirects: 0 });
    expect.soft(response.status(), `${label}: the request list refuses ${what}`).toBe(413);
  }

  const multipartInside = await page.request.post('/app/requests/new', { headers: { 'next-action': '0' }, multipart: evidence, maxRedirects: 0 });
  expect.soft(multipartInside.status(), `${label}: the gate admits a 7 MB multipart action post on the new-request form, which Next answers 404 for its unknown action before reading the body (IN-602)`).toBe(404);
  const textInside = await page.request.post('/app/requests/new', { headers: textAction, data: body, maxRedirects: 0 });
  expect.soft(textInside.status(), `${label}: the new-request form refuses a 7 MB text action post, which is not multipart (IN-401)`).toBe(413);
});
