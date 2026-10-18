import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Request, type Route } from '@playwright/test';
import { strapiHealthUrl } from './harness-urls';
import { completeRiskForRelease, confirmRemainingToastText, expectDecisionRecorded } from './helpers/assessment-release';
import { signInAs, type SignInRole } from './helpers/navigation';
import { submitRequestFromItsPage } from './helpers/requests';

/*
 * Phase 12 end to end (D-38): a UAT-A-like request on records this journey creates, through questionnaire
 * generation, the Requestor's answers, the draft and its review, to release. Each project (1440 and 375) creates its
 * own records. The deterministic provider runs throughout (D-31); the data policy refusal is proven in Strapi
 * integration and web units, because a refusing ceiling needs a server of its own.
 */

const internetStatement = 'Internet exposure may increase the likelihood of unauthorised access to the service.';
const personalStatement = 'Inadequate protection of personal information may result in unauthorised disclosure or misuse.';
const regulatoryStatement = 'Failure to meet privacy obligations may result in regulatory action.';
const thirdPartyStatement = 'Third-party dependency may reduce direct control over service resilience and information protection.';
const recoveryStatement = 'Untested recovery may delay restoration of the service.';
/* The development Security Analyst's IdamBox User, as Strapi seeds it (bob.doe@idambox.com). */
const analystName = 'Bob Doe';

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: label }).toBe(true);
}

async function expectAccessible(page: Page, label: string): Promise<void> {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'), `${label} has no serious axe violation`).toEqual([]);
  await expectNoOverflow(page, `${label} has no horizontal overflow`);
}

async function switchTo(page: Page, role: SignInRole): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, role);
}

/* Picks a named record in a request relation search, pressing Enter until the chosen name is listed. */
async function chooseNamed(page: Page, label: string, name: string): Promise<void> {
  const group = page.getByRole('group', { name: label });
  const combobox = group.getByRole('combobox', { name: `Search ${label.toLowerCase()}` });
  await combobox.fill(name);
  const selected = group.getByRole('list', { name: `Selected ${label}` });
  await expect(async () => {
    await combobox.press('Enter');
    await expect(selected.getByText(name)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

function riskCard(page: Page, statement: string): Locator {
  return page.locator('[id^="risk-"][tabindex="-1"]').filter({ hasText: statement });
}

/* A Risk card's number, from its suggestions region's name (`Suggested by AI for {risk number}`, 12-UI-SPEC §5). */
async function riskNumberOf(card: Locator): Promise<string> {
  const name = await card.getByRole('region', { name: /^Suggested by AI for / }).getAttribute('aria-label');
  return (name ?? '').replace(/^Suggested by AI for /, '');
}

/* The accessible names of a Risk card's Add actions, one per proposed suggestion, in their order. */
async function suggestedAdds(card: Locator): Promise<string[]> {
  return card.getByRole('button', { name: /^Add as planned control: / }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
}

/*
 * Adds a suggested control (the Add named `addName`, else the Risk's first) as a planned control and waits for Strapi to
 * record it (WR-401). WR-403 (G-14): only on a Risk whose treatment stays Treat, so the journey never plans a control
 * beside an Accept.
 */
async function addSuggestedControl(page: Page, card: Locator, risk: string, addName?: string): Promise<string> {
  await expect(card.getByRole('combobox', { name: 'Treatment action' }), `WR-403: ${risk} stays Treat before a suggested control is planned on it`).toHaveValue('Treat');
  const chosen = addName ?? (await suggestedAdds(card))[0];
  expect(chosen, `${risk} suggests a control to plan`).toMatch(/^Add as planned control: /);
  const control = chosen.replace(/^Add as planned control: /, '');
  const riskNumber = await riskNumberOf(card);
  await card.getByRole('button', { name: chosen, exact: true }).press('Enter');
  await expectDecisionRecorded(page, `${control} added as a planned control on ${riskNumber}.`, `Adding ${control} to ${risk}`);
  await expect(card.getByRole('region', { name: /^Mitigation controls for / }).getByText(`Selected control: ${control}`), `PH12_C3_ADD_PLANNED_CONTROL ${control} on ${risk}`).toBeVisible();
  return control;
}

/*
 * WR-402 (criterion 4), on real data: the provenance header names who asked for the generation, when it ran, and the
 * provider and model it ran on (12-UI-SPEC §1: line 1, then `{instant} · Provider: {name} · Model: {version}`).
 */
async function expectProvenanceHeader(header: Locator, provider: string, since: number, surface: string): Promise<void> {
  await softly(header.getByText(`Generated with AI at the request of ${analystName}`, { exact: true }), `WR-402: ${surface}’s header names the analyst who asked`).toBeVisible();
  await softly(header, `WR-402: ${surface}’s header names the provider and model`).toContainText(`Provider: ${provider} · Model: 2`);
  const generatedAt = Date.parse(await header.locator('time').getAttribute('datetime', { timeout: 5_000 }).catch(() => null) ?? '');
  softly(generatedAt, `WR-402: ${surface}’s header says when the generation ran, during this journey`).toBeGreaterThanOrEqual(since);
  softly(generatedAt, `WR-402: ${surface}’s header says when the generation ran, before now`).toBeLessThanOrEqual(Date.now());
}

/*
 * CR-401 (D-23, 12-UI-SPEC §9.3): what the Requestor never sees of the AI: a marker, the provider or the model, the
 * analyst's provenance line, the run sheet's trigger, or the header's region. Each locator is first shown to match on the
 * analyst's own questionnaire page, so finding none of them on the Requestor's page proves an absence.
 */
const aiInternalsText = /AI proposed|Provider:|Model:|deterministic-questionnaire|Generated with AI|Show what the AI used/;
function aiInternals(page: Page): readonly (readonly [string, Locator])[] {
  const main = page.getByRole('main');
  return [
    ['an AI proposed marker', main.getByText('AI proposed')],
    ['a provider', main.getByText('Provider:')],
    ['a model', main.getByText('Model:')],
    ['the provider’s name', main.getByText('deterministic-questionnaire')],
    ['the line Generated with AI', main.getByText('Generated with AI')],
    ['the action Show what the AI used', main.getByRole('button', { name: 'Show what the AI used' })],
    ['an AI generation region', page.getByRole('region', { name: 'AI generation' })],
  ];
}

/* Soft assertions: one run reports every decision, toast and focus check that fails, not only the first. */
const softly = expect.configure({ soft: true });

/* The decision Server Action (12-UI-SPEC §6: one batch action posted to the editor for every decision). */
function isDecision(request: Request): boolean {
  return request.method() === 'POST' && request.headers()['next-action'] !== undefined && (request.postData() ?? '').includes('"decisions"');
}

/* The focused element's accessible label: its aria-label, else its text. */
async function focusedLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 80) ?? '';
  });
}

/* Records every element focus lands on from now, so a failed focus check says where focus went. */
async function trackFocus(page: Page): Promise<() => Promise<string>> {
  await page.evaluate(() => {
    const record = window as unknown as { csrmFocusTrail?: string[] };
    if (!record.csrmFocusTrail) {
      document.addEventListener('focusin', (event) => {
        const element = event.target as HTMLElement;
        record.csrmFocusTrail?.push(element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 60) ?? element.tagName);
      }, true);
    }
    record.csrmFocusTrail = [];
  });
  return async () => (await page.evaluate(() => (window as unknown as { csrmFocusTrail?: string[] }).csrmFocusTrail ?? [])).join(' → ');
}

/*
 * 12-UI-SPEC §6.2: focus lands on the control named `label` and is still there a second later. The pilot's walk read
 * focus at 100, 400 and 1,000 ms after an Undo (D3), because the toast region can hand focus back after it moved.
 */
async function expectFocusStays(page: Page, label: string, message: string, trail: () => Promise<string>): Promise<void> {
  await softly.poll(() => focusedLabel(page), { message, timeout: 5_000 }).toBe(label);
  await page.waitForTimeout(1_000);
  softly(await focusedLabel(page), `${message}, and it stays there a second later (focus trail: ${await trail()})`).toBe(label);
}

/* A token's computed value in this page, so a check compares with the token, never a copied colour or length. */
async function tokenValue(page: Page, property: 'color' | 'border-top-left-radius' | 'font-size', token: string): Promise<string> {
  return page.evaluate(([name, variable]) => {
    const probe = document.createElement('span');
    probe.style.setProperty(name, `var(${variable})`);
    document.body.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(name);
    probe.remove();
    return value;
  }, [property, token] as const);
}

/*
 * The WCAG 2.x contrast ratio of an element's text against what is painted behind it: the element's own background,
 * else the first non-transparent one among its ancestors, with any translucent layer on the way blended over it.
 */
async function textContrast(element: Locator): Promise<number> {
  return element.evaluate((target) => {
    type Colour = [number, number, number, number];
    const parse = (value: string): Colour => {
      const match = /^rgba?\(([^)]+)\)$/.exec(value);
      if (!match) throw new Error(`UNREADABLE_COLOUR:${value}`);
      const [red, green, blue, alpha = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [red, green, blue, alpha];
    };
    const over = (top: Colour, bottom: Colour): Colour => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      const channel = (index: number) => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha;
      return [channel(0), channel(1), channel(2), alpha];
    };
    const layers: Colour[] = [];
    for (let node: Element | null = target; node; node = node.parentElement) {
      const background = parse(getComputedStyle(node).backgroundColor);
      if (background[3] > 0) layers.push(background);
      if (background[3] >= 1) break;
    }
    const backdrop = layers.reverse().reduce<Colour>((below, layer) => over(layer, below), [255, 255, 255, 1]);
    const text = over(parse(getComputedStyle(target).color), backdrop);
    const luminance = ([red, green, blue]: Colour) => {
      const linear = [red, green, blue].map((value) => {
        const share = value / 255;
        return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const [lighter, darker] = [luminance(text), luminance(backdrop)].sort((first, second) => second - first);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

/*
 * CR-301 (walk D1), X-14: a toast's action is an outline small pill whose label reads at 4.5:1 or more, and below
 * 768px it is the touch-target height (direction §4 Buttons). The app has one theme (direction §3.13: light only,
 * and the Toaster pins it), so a dark colour-scheme preference must leave the ratio unchanged.
 */
async function expectLegibleToastAction(page: Page, action: Locator, name: string): Promise<void> {
  const narrow = (page.viewportSize()?.width ?? 1440) < 768;
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    softly(await textContrast(action), `${name} reads at 4.5:1 or more with a ${colorScheme} colour-scheme preference`).toBeGreaterThanOrEqual(4.5);
  }
  await page.emulateMedia({ colorScheme: null });
  const shape = await action.evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, radius: Number.parseFloat(style.borderTopLeftRadius), border: style.borderTopWidth };
  });
  softly(shape.border, `${name} is an outline button`).toBe('1px');
  softly(shape.radius, `${name} is a pill`).toBeGreaterThanOrEqual(shape.height / 2);
  softly(shape.height, narrow ? `${name} is at least the 44px touch-target height below 768px` : `${name} is the 32px small button`)
    .toBeGreaterThanOrEqual(narrow ? 44 : 32);
}

/*
 * Walk D8, read against WCAG 2.1.2 (No Keyboard Trap): with a toast up, Tab from the page's last control enters the
 * toast region and reaches its action; Tab carries on out of the region, and Shift+Tab from there moves back through
 * the page. Focus is never held in the region. The path is recorded as an annotation.
 */
/* Focuses the page's last control outside the toast region and returns its label: where Tab enters the toasts from. */
async function focusLastPageControl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const region = document.querySelector('[data-sonner-toaster]')?.closest('section') ?? null;
    const controls = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && !region?.contains(element)
        && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const control = controls.at(-1);
    control?.focus();
    return control?.getAttribute('aria-label') ?? control?.textContent?.trim().slice(0, 60) ?? 'nothing';
  });
}

async function expectToastRegionReleasesTab(page: Page, actionName: string): Promise<void> {
  const where = () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      label: active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 60) ?? active?.tagName ?? 'nothing',
      inToasts: Boolean(active?.closest('[data-sonner-toaster]')),
    };
  });
  const lastControl = await focusLastPageControl(page);
  const path: { label: string; inToasts: boolean }[] = [];
  let reachedAction = false;
  for (let press = 0; press < 10; press += 1) {
    await page.keyboard.press('Tab');
    const step = await where();
    path.push(step);
    if (step.inToasts && step.label === actionName) reachedAction = true;
    else if (reachedAction && !step.inToasts) break;
  }
  await page.keyboard.press('Shift+Tab');
  const back = await where();
  const described = `${lastControl} ⇥ ${path.map((step) => `${step.label}${step.inToasts ? ' (toast)' : ''}`).join(' ⇥ ')} ⇤ ${back.label}${back.inToasts ? ' (toast)' : ''}`;
  test.info().annotations.push({ type: 'D8_TOAST_TAB_PATH', description: described });
  softly(reachedAction, `D8: Tab from the page's last control reaches ${actionName} (${described})`).toBe(true);
  softly(path.at(-1)?.inToasts, `D8: Tab carries on out of the toast region (${described})`).toBe(false);
  softly(back.inToasts, `D8: Shift+Tab moves back through the page, outside the toast region (${described})`).toBe(false);
}

/* The keyboard path without Alt+T (stage B S1): from the page's last control, Tab until `target` in a toast holds focus. */
async function tabInto(page: Page, target: Locator, message: string): Promise<void> {
  await focusLastPageControl(page);
  for (let press = 0; press < 10 && !(await target.evaluate((element) => element === document.activeElement)); press += 1) await page.keyboard.press('Tab');
  await expect(target, message).toBeFocused();
}

/*
 * Walk D6: the provenance header sits one section rhythm above the block that follows it (direction §3.9: 24 to 32px
 * inside pages; the questionnaire page's other blocks keep 24px).
 */
async function expectSectionRhythmBelow(header: Locator, state: string): Promise<void> {
  const gap = await header.evaluate((element) => {
    const next = element.nextElementSibling;
    return next ? next.getBoundingClientRect().top - element.getBoundingClientRect().bottom : Number.NaN;
  });
  softly(gap, `D6: ${state}, the provenance header sits at least 24px above the next block`).toBeGreaterThanOrEqual(24);
  softly(gap, `D6: ${state}, the provenance header sits at most 32px above the next block`).toBeLessThanOrEqual(32);
}

/*
 * WR-306 (walk D4): each field's Confirm is the 32px small button from 768px, and below 768px at least the 44px
 * touch-target height (direction §4 Buttons; 12-UI-SPEC §3.2).
 */
async function expectConfirmTargets(page: Page): Promise<void> {
  const narrow = (page.viewportSize()?.width ?? 1440) < 768;
  const heights = await page.locator('[data-ai-confirm]').evaluateAll((buttons) => buttons
    .filter((button) => button.getClientRects().length > 0)
    .map((button) => button.getBoundingClientRect().height));
  expect(heights.length, 'the editor shows field Confirm buttons').toBeGreaterThan(0);
  if (narrow) softly(heights.filter((height) => height < 44), 'WR-306 (D4): below 768px every field’s Confirm is at least the 44px touch-target height').toEqual([]);
  else softly([...new Set(heights)], 'WR-306: from 768px every field’s Confirm is the 32px small button').toEqual([32]);
}

/* axe `landmark-unique` is moderate, so `expectAccessible` does not report it: no two landmarks share a role and name. */
async function expectUniqueLandmarks(page: Page, label: string): Promise<void> {
  const scan = await new AxeBuilder({ page }).withRules(['landmark-unique']).analyze();
  softly(scan.violations.flatMap(({ nodes }) => nodes.map(({ target }) => target.join(' '))), `${label}: axe landmark-unique finds no two landmarks with one role and name`).toEqual([]);
}

/*
 * Walk (sheet typography): a group heading takes the direction's panel heading style (§3.10 `--text-heading-sm`), so it
 * reads apart from the `.micro-label` row labels under it (12-UI-SPEC §2.2, amended 2026-10-08).
 */
async function expectSheetGroupHeadings(page: Page, sheet: Locator): Promise<void> {
  const typeOf = (element: Locator) => element.evaluate((node) => {
    const style = getComputedStyle(node);
    return { size: style.fontSize, weight: style.fontWeight, transform: style.textTransform };
  });
  const heading = await typeOf(sheet.getByRole('heading', { level: 3 }).first());
  const label = await typeOf(sheet.locator('dt').first());
  softly(heading, 'Sheet typography: a group heading is --text-heading-sm at 600, in sentence case')
    .toEqual({ size: await tokenValue(page, 'font-size', '--text-heading-sm-size'), weight: '600', transform: 'none' });
  softly(label.transform, 'Sheet typography: a row label stays an uppercase micro-label').toBe('uppercase');
}

test('@journey an analyst generates, reviews and releases an AI-assisted assessment from a request’s full context', async ({ page, request }, testInfo) => {
  test.setTimeout(600_000);
  const health = await request.get(strapiHealthUrl);
  if (!health.ok()) throw new Error(`SERVER_STRAPI_HEALTH_FAILED:${health.status()}`);
  const journeyStart = Date.now();
  const suffix = `${journeyStart}-${testInfo.project.name}`;
  const payroll = `HR and payroll platform ${suffix}`;
  const finance = `Finance system ${suffix}`;
  const identity = `Identity provider ${suffix}`;
  const asset = `Employee payment details ${suffix}`;
  const title = `Payroll platform change ${suffix}`;
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await test.step('the Security Analyst records the systems and the Restricted asset', async () => {
    await switchTo(page, 'Security Analyst');
    for (const [name, internetFacing] of [[payroll, true], [finance, false], [identity, false]] as const) {
      await page.goto('/app/admin/information-systems/new');
      await page.getByLabel('Name').fill(name);
      await page.getByLabel('Description').fill(`${name} for the Phase 12 journey.`);
      if (internetFacing) await page.getByRole('radio', { name: 'Yes, internet-facing' }).check();
      await page.getByRole('button', { name: 'Create Information System' }).click();
      await expect(page.getByText('Information System created.')).toBeVisible();
    }
    await page.goto('/app/admin/information-assets/new');
    await page.getByLabel('Name').fill(asset);
    await page.getByLabel('Description').fill('Personal and bank details used to pay employees.');
    await page.getByLabel('Data classification').selectOption('Restricted');
    await page.getByRole('group', { name: 'Contains personal data' }).getByRole('radio', { name: 'Yes' }).check();
    await page.getByRole('button', { name: 'Create Information Asset' }).click();
    await expect(page.getByText('Information Asset created.')).toBeVisible();
  });

  let requestId = '';
  await test.step('the Requestor submits a request that selects them', async () => {
    await switchTo(page, 'Requestor');
    await page.goto('/app/requests/new');
    await page.getByRole('textbox', { name: 'Request title' }).fill(title);
    await page.getByRole('textbox', { name: 'Description' }).fill('Unsigned payment files could be altered before upload.');
    await page.getByRole('combobox', { name: 'Assessment type' }).selectOption('Project');
    await page.getByRole('textbox', { name: 'Division' }).fill('Corporate');
    await page.getByRole('textbox', { name: 'Business unit' }).fill('People and Finance');
    await page.getByRole('textbox', { name: 'Business purpose' }).fill('Pay employees accurately and on time.');
    await page.getByRole('combobox', { name: 'Business criticality' }).selectOption('High');
    await page.getByRole('checkbox', { name: 'Third-party involvement' }).check();
    await page.getByRole('textbox', { name: 'Third-party details' }).fill('An external payroll processor runs the pay runs.');
    await page.getByRole('textbox', { name: 'Regulatory requirements' }).fill('Privacy Act 1988 and tax file number obligations');
    for (const name of [payroll, finance, identity]) await chooseNamed(page, 'Information systems', name);
    await chooseNamed(page, 'Information assets', asset);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/app\/requests\/(?!new$)[^/]+$/);
    requestId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
    await submitRequestFromItsPage(page);
  });

  let questionnaireId = '';
  await test.step('the analyst generates the questionnaire and checks what the AI used', async () => {
    await switchTo(page, 'Security Analyst');
    await page.goto(`/app/review/requests/${encodeURIComponent(requestId)}`);
    await expect(page.getByText('This request’s information is classified Restricted.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Generate questionnaire' }).click();
    const review = page.getByRole('link', { name: 'Review generated questionnaire' });
    await expect(review).toBeVisible({ timeout: 45_000 });
    await review.click();
    await expect(page).toHaveURL(/\/app\/review\/questionnaires\/[^/]+$/);
    questionnaireId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);

    const header = page.getByRole('region', { name: 'AI generation' });
    await expect(header.getByText(/^Generated with AI at the request of /), 'PH12_C4_PROVENANCE_HEADER').toBeVisible();
    await expectProvenanceHeader(header, 'deterministic-questionnaire-generation', journeyStart, 'the questionnaire');
    await expectSectionRhythmBelow(header, 'in analyst review');
    const governance = page.getByRole('region', { name: 'Questionnaire governance' });
    await expect(governance.getByText(/^Help text: /).first()).toBeVisible();
    await expect(governance.getByText(`How is ${asset} protected?`, { exact: true }), 'the questionnaire asks about the selected asset').toBeVisible();
    // WR-402 (criterion 4): a generated question carries its origin marker in analyst review (12-UI-SPEC §8.2).
    await softly(governance.getByRole('listitem').filter({ hasText: 'Has recovery been tested?' }).getByText('AI proposed', { exact: true }), 'WR-402: a generated question is marked AI proposed').toBeVisible();
    // CR-401: every AI internal the Requestor's check looks for shows here, so that check can see a leak.
    for (const [internal, locator] of aiInternals(page)) {
      softly(await locator.count(), `CR-401: the analyst’s questionnaire shows ${internal}, so the Requestor’s check would find one`).toBeGreaterThan(0);
    }
    softly(await page.getByRole('main').innerText(), 'CR-401: the analyst’s questionnaire text holds the AI internals the Requestor’s check looks for').toMatch(aiInternalsText);
    await expectAccessible(page, 'the governance page');

    await header.getByRole('button', { name: 'Show what the AI used' }).click();
    const sheet = page.getByRole('dialog', { name: 'What the AI used' });
    await expect(sheet.getByRole('heading', { level: 3, name: 'Information assets' })).toBeVisible();
    await expect(sheet.getByText(`${asset} · Restricted`)).toBeVisible();
    await expectSheetGroupHeadings(page, sheet);
    await expectAccessible(page, 'the questionnaire with What the AI used open');
    await sheet.getByRole('button', { name: 'Close what the AI used' }).click();
    await expect(sheet).toBeHidden();

    await governance.getByRole('button', { name: 'Release questionnaire' }).click();
    const release = page.getByRole('alertdialog', { name: 'Release this questionnaire?' });
    await expect(release).toContainText(/Releasing also records that you reviewed its \d+ AI-proposed questions?\./);
    await release.getByRole('button', { name: 'Release questionnaire' }).click();
    await expect(release).toBeHidden();
    // The release re-reads the page, which now waits for the Requestor's answers.
    await expect(page.getByText('Awaiting questionnaire submission', { exact: true }).first()).toBeVisible();
    await expectSectionRhythmBelow(header, 'awaiting submission');
  });

  await test.step('the Requestor answers with help text and Not sure, told that AI helped', async () => {
    await switchTo(page, 'Requestor');
    await page.goto(`/app/questionnaires/${encodeURIComponent(questionnaireId)}`);
    await expect(page.getByText('A Security Analyst used AI to help write these questions and reviewed them before sending them to you.')).toBeVisible();
    await expect(page.getByText(/^Not sure of an answer\? Choose “Not sure” where it’s offered\./)).toBeVisible();
    // CR-401 (D-23, 12-UI-SPEC §9.3): the Requestor is told that AI helped, and sees nothing of how.
    for (const [internal, locator] of aiInternals(page)) await softly(locator, `CR-401: the Requestor’s questionnaire shows no ${internal}`).toHaveCount(0);
    softly(await page.getByRole('main').innerText(), 'CR-401: the Requestor’s questionnaire text holds no AI internal').not.toMatch(aiInternalsText);
    const criticality = page.getByRole('group', { name: /^Is the stated business criticality/ });
    const hint = criticality.getByText(/^Choose the level of disruption the business could tolerate\./);
    await expect(hint, 'PH12_C5_HELP_TEXT').toBeVisible();
    await expect(criticality, 'PH12_C5_HELP_TEXT the hint describes the group').toHaveAttribute('aria-describedby', await hint.getAttribute('id') ?? 'missing');
    const provider = page.getByRole('group', { name: /^Is an external provider involved\?/ });
    await expect(provider.getByRole('radio', { name: 'Not sure' }), 'PH12_C5_NOT_SURE').toBeVisible();
    await expectAccessible(page, 'the Requestor’s questionnaire');

    await page.getByRole('textbox', { name: /^What security outcomes matter most/ }).fill('Payment files must not be altered before the bank receives them.');
    await criticality.getByRole('radio', { name: 'High', exact: true }).check();
    await provider.getByRole('radio', { name: 'Not sure' }).check();
    await provider.getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('textbox', { name: /^What does the external provider do\?/ }).fill('The payroll processor runs each pay run and receives employee bank details.');
    await page.getByRole('textbox', { name: /^How is .* protected\?/ }).fill('Access is limited to the payroll team; files move over an encrypted channel.');
    // IN-404: the Requestor submits Not sure for a question the draft cites (its untested recovery Risk), and leaves the
    // optional regulatory question blank, so she answers six of the seven questions the deterministic questionnaire shows.
    await page.getByRole('group', { name: /^Has recovery been tested\?/ }).getByRole('radio', { name: 'Not sure', exact: true }).check();
    await page.getByRole('button', { name: 'Submit questionnaire' }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Submit this questionnaire?' });
    await confirmation.getByRole('button', { name: 'Submit questionnaire' }).click();
    await expect(page.getByText('Questionnaire submitted.')).toBeVisible();
  });

  let editorPath = '';
  await test.step('the analyst generates the draft, and the Requestor cannot open it', async () => {
    await switchTo(page, 'Security Analyst');
    await page.goto(`/app/review/questionnaires/${encodeURIComponent(questionnaireId)}`);
    const submittedHeader = page.getByRole('region', { name: 'AI generation' });
    await expect(submittedHeader).toBeVisible();
    await expectSectionRhythmBelow(submittedHeader, 'submitted');
    await page.goto(`/app/review/requests/${encodeURIComponent(requestId)}`);
    await page.getByRole('button', { name: 'Generate assessment draft' }).click();
    const open = page.getByRole('link', { name: 'Open assessment draft' });
    await expect(open).toBeVisible({ timeout: 60_000 });
    editorPath = String(await open.getAttribute('href'));

    await switchTo(page, 'Requestor');
    await page.goto(editorPath);
    await expect(page.getByText('You don’t have permission to review this assessment'), 'PH12_NEG_REQUESTOR_EDITOR_NOT_FOUND').toBeVisible();
    await expect(page.getByText(internetStatement)).toHaveCount(0);

    await switchTo(page, 'Security Analyst');
    await page.goto(editorPath);
    await expect(page.getByRole('heading', { name: 'Risk assessment review' })).toBeVisible();
  });

  await test.step('the draft links systems and assets, cites its sources and flags what it cannot support', async () => {
    await expectProvenanceHeader(page.getByRole('region', { name: 'AI generation' }), 'deterministic-assessment-draft', journeyStart, 'the draft');
    const internet = riskCard(page, internetStatement);
    await expect(internet.getByText(`Selected system: ${payroll}`), 'PH12_C1_SYSTEM_ASSET_LINKS the internet-facing system').toBeVisible();
    const personal = riskCard(page, personalStatement);
    await expect(personal.getByText(`Selected asset: ${asset}`), 'PH12_C1_SYSTEM_ASSET_LINKS the asset').toBeVisible();
    await expect(personal.getByRole('combobox', { name: 'Data classification' })).toHaveValue('Restricted');
    await expect(personal.getByText(`Taken from ${asset}.`), 'PH12_C1_SYSTEM_ASSET_LINKS the classification note').toBeVisible();
    // WR-402 and verifier W-1 (criterion 1): every Risk the draft proposes links the selected record it concerns.
    await softly(riskCard(page, regulatoryStatement).getByText(`Selected asset: ${asset}`), 'WR-402: the privacy obligations Risk links the asset').toBeVisible();
    for (const [statement, risk] of [[thirdPartyStatement, 'the third-party Risk'], [recoveryStatement, 'the recovery Risk']] as const) {
      await softly(riskCard(page, statement).getByText(`Selected system: ${payroll}`), `W-1: ${risk} links the payroll platform, the service's system`).toBeVisible();
    }
    /*
     * WR-402 (criterion 4): an AI-written field carries the AI proposed marker, named in its field's description, and a
     * Confirm named by its field (12-UI-SPEC §3.1).
     */
    const recovery = riskCard(page, recoveryStatement);
    await softly(recovery.getByText('AI proposed', { exact: true }).first(), 'WR-402: the recovery Risk shows the AI proposed marker').toBeVisible();
    await softly(recovery.getByRole('textbox', { name: 'Issue statement' }), 'WR-402: the Issue statement’s description names its AI proposed marker').toHaveAccessibleDescription('AI proposed');
    await softly(recovery.getByRole('button', { name: 'Confirm Issue statement', exact: true }), 'WR-402: the proposed Issue statement offers Confirm Issue statement').toBeVisible();
    const riskTypes = await page.getByRole('region', { name: 'Identified Risks' }).getByRole('combobox', { name: 'Risk type' })
      .evaluateAll((selects) => selects.map((select) => (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? ''));
    expect(riskTypes.filter((name) => name === 'Personal Information Handling'), 'PH12_C1_TWO_RISKS_ONE_TYPE').toHaveLength(2);
    await expectAccessible(page, 'the editor with proposals');
    await expectConfirmTargets(page);
    // Walk (axe landmark-unique): each Risk's suggestions region is named by its Risk, under the heading Suggested by AI.
    await expectUniqueLandmarks(page, 'the editor with proposals');
    const suggestionHeadings = await page.getByRole('heading', { level: 4, name: 'Suggested by AI', exact: true }).count();
    expect(suggestionHeadings, 'every Risk shows its Suggested by AI heading').toBeGreaterThan(1);
    await softly(page.getByRole('region', { name: 'Suggested by AI', exact: true }), 'landmark-unique: no region keeps the shared name Suggested by AI').toHaveCount(0);
    await softly(page.getByRole('region', { name: /^Suggested by AI for RSK-/ }), 'landmark-unique: each suggestions region is named Suggested by AI for its Risk').toHaveCount(suggestionHeadings);

    const citation = recovery.getByRole('list', { name: 'Sources for Issue statement' }).getByRole('button', { name: /^Answer: / }).first();
    await citation.click();
    const source = page.getByRole('dialog').filter({ hasText: 'Requestor’s answer' });
    await expect(source, 'PH12_C2_CITATION_OPENS_ANSWER').toBeVisible();
    // IN-404: the cited answer is the Requestor's Not sure, read by its label under her answer.
    await softly(source.locator('p', { hasText: /^Requestor’s answer$/ }).locator('xpath=following-sibling::p[1]'), 'IN-404: the citation shows the Requestor’s Not sure under her answer').toHaveText('Not sure');
    if ((page.viewportSize()?.width ?? 1440) >= 768) {
      softly(await source.evaluate((dialog) => dialog.getBoundingClientRect().width), 'D7: from 768px the source popover is no wider than the 480px confirm dialog size (direction §4 Dialogs, X-12)')
        .toBeLessThanOrEqual(480);
    }
    await expectAccessible(page, 'the editor with a source open');
    await page.keyboard.press('Escape');
    await expect(source).toBeHidden();
    await expect(citation, 'PH12_C2_CITATION_OPENS_ANSWER focus returns to the citation').toBeFocused();
    await expect(recovery.getByText('No source cited').first(), 'PH12_C2_NO_SOURCE_CITED').toBeVisible();
    await expect(recovery.getByRole('region', { name: 'Claims to check' }), 'PH12_C2_CLAIMS_TO_CHECK').toBeVisible();
    await expect(riskCard(page, thirdPartyStatement).getByText('Proposed because the residual rating is Moderate. The treatment plan holds the AI’s reason.')).toBeVisible();

    await page.getByRole('region', { name: 'AI generation' }).getByRole('button', { name: 'Show what the AI used' }).click();
    const sheet = page.getByRole('dialog', { name: 'What the AI used' });
    await expect(sheet.getByRole('heading', { level: 3, name: 'Control candidates' })).toBeVisible();
    // IN-404: the draft was given all seven questions, and counts the Requestor's Not sure among her six answers.
    await softly(sheet.getByText('6 of 7 questions answered', { exact: true }), 'IN-404: the run sheet counts the Not sure answer as answered').toBeVisible();
    await expectAccessible(page, 'the editor with What the AI used open');
    await sheet.getByRole('button', { name: 'Close what the AI used' }).click();
    await expect(sheet).toBeHidden();
  });

  await test.step('the analyst completes, confirms and releases', async () => {
    const forms = page.getByRole('region', { name: 'Identified Risks' }).locator('form');
    const riskCount = await page.locator('[id^="risk-"][tabindex="-1"]').count();
    expect(riskCount, 'the draft holds the five UAT-A-like risks').toBe(5);
    /*
     * WR-403 (G-14; 12-VALIDATION D-38): each Risk is completed with the treatment action the AI proposed, Treat for four
     * and Accept only for the third-party Risk, the one the draft proposes to Accept, with no suggested control. The
     * suggested controls below are therefore planned on Treat Risks only, never beside an Accept.
     */
    const treatments: Record<string, string> = {};
    for (let index = 0; index < riskCount; index += 1) {
      const form = forms.nth(index);
      const statement = await form.getByRole('textbox', { name: 'Risk statement' }).inputValue();
      const proposed = await form.getByRole('combobox', { name: 'Treatment action' }).inputValue();
      treatments[statement] = proposed;
      await completeRiskForRelease(page, index, proposed === 'Accept' ? 'Accept' : 'Treat');
    }
    expect(treatments, 'WR-403: every Risk keeps the treatment action the AI proposed').toEqual({
      [internetStatement]: 'Treat',
      [personalStatement]: 'Treat',
      [regulatoryStatement]: 'Treat',
      [thirdPartyStatement]: 'Accept',
      [recoveryStatement]: 'Treat',
    });
    await softly(riskCard(page, thirdPartyStatement).getByRole('button', { name: /^Add as planned control: / }), 'WR-403 (G-14): the Accept Risk has no suggested control to plan').toHaveCount(0);
    await expect(forms).toHaveCount(riskCount);

    /*
     * 12-UI-SPEC §6.1 and §6.2, one field at a time on the internet Risk: the pending state, focus after Confirm and
     * after Undo, the Undo toast and the rollback's danger toast (CR-301, WR-301, IN-304; walk D1, D2, D8, D9, D13(d)).
     * The decision Server Action is held once, so the pending state can be read before Strapi answers, and failed once.
     */
    await test.step('the analyst confirms one field, undoes it, and recovers a failed confirmation', async () => {
      const editorPathname = new URL(page.url()).pathname;
      const isEditorPage = (url: URL) => url.pathname === editorPathname;
      const form = riskCard(page, internetStatement).locator('form');
      const confirmNames = await form.locator('[data-ai-confirm]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
      expect(confirmNames.length, 'the internet Risk keeps at least three AI-proposed fields to decide').toBeGreaterThanOrEqual(3);
      const [, decidedName, nextName] = confirmNames;
      const decided = form.getByRole('button', { name: decidedName, exact: true });
      const fieldLabel = decidedName.replace(/^Confirm /, '');
      const pendingMarkers = form.locator('[data-pending="true"]:has(> [id$="-ai-marker"])');
      // The pointer rests away from the toasts, so none of them pauses (a hovered toast keeps its timer).
      await page.mouse.move(0, 0);

      let answer: () => void = () => undefined;
      const answered = new Promise<void>((resolve) => { answer = resolve; });
      const holdDecision = async (route: Route) => {
        if (isDecision(route.request())) await answered;
        await route.fallback();
      };
      await page.route(isEditorPage, holdDecision);
      try {
        await decided.press('Enter');
        await expect(form.getByText('Confirmed', { exact: true }), 'the field reads Confirmed at once').toHaveCount(1);
        await softly(pendingMarkers, 'IN-304: only the marker being decided takes the pending opacity').toHaveCount(1);
        const pending = pendingMarkers.filter({ hasText: 'Confirmed' });
        softly(await pending.evaluate((marker) => getComputedStyle(marker).transitionProperty), 'D13(d): the pending opacity applies without a transition').toBe('none');
        softly(await pending.evaluate((marker) => getComputedStyle(marker).opacity), 'the decided marker is at the pending opacity').toBe('0.6');
        await softly.poll(() => focusedLabel(page), { message: `WR-301 (D2): Confirm moves focus to the next Confirm in field order, ${nextName}`, timeout: 5_000 }).toBe(nextName);
      } finally {
        answer();
        await page.unroute(isEditorPage, holdDecision);
      }

      const confirmedToast = page.locator('[data-sonner-toast]').filter({ hasText: `${fieldLabel} confirmed on ` });
      await expect(confirmedToast).toBeVisible();
      const undo = confirmedToast.getByRole('button', { name: 'Undo' });
      await expectLegibleToastAction(page, undo, 'CR-301 (D1): the Undo toast’s Undo');
      await expectToastRegionReleasesTab(page, 'Undo');

      // The keyboard path to Undo (§13: Alt+T, then Tab), and focus back on the restored field's Confirm.
      const trail = await trackFocus(page);
      await page.keyboard.press('Alt+KeyT');
      for (let press = 0; press < 6 && (await focusedLabel(page)) !== 'Undo'; press += 1) await page.keyboard.press('Tab');
      await expect(undo, 'Alt+T, then Tab, reaches Undo').toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Confirmation undone.' })).toBeVisible();
      await expect(decided, 'Undo restores the field’s Confirm').toBeVisible();
      await expectFocusStays(page, decidedName, `WR-301 (D2): Undo returns focus to the restored field’s Confirm, ${decidedName}`, trail);

      // A confirmation that fails rolls back with a danger toast (§6.1), and Try again sends it again.
      const failDecision = async (route: Route) => {
        if (isDecision(route.request())) await route.abort('failed');
        else await route.fallback();
      };
      const danger = page.locator('[data-sonner-toast][data-type="error"]').filter({ hasText: 'Proposal not confirmed' });
      await page.route(isEditorPage, failDecision);
      try {
        await decided.press('Enter');
        await expect(danger).toBeVisible();
      } finally {
        await page.unroute(isEditorPage, failDecision);
      }
      await expect(decided, 'the rollback brings the field’s Confirm back').toBeVisible();
      const destructive = await tokenValue(page, 'color', '--destructive');
      const frame = await danger.evaluate((toast) => {
        const style = getComputedStyle(toast);
        const icon = toast.querySelector('[data-icon] svg');
        return { edge: style.borderLeftWidth, edgeColour: style.borderLeftColor, radius: style.borderTopLeftRadius, icon: icon ? getComputedStyle(icon).color : 'none' };
      });
      softly(frame, 'D9: a danger toast has a 4px left edge and an icon in the danger status colour, and the --radius-lg corners')
        .toEqual({ edge: '4px', edgeColour: destructive, radius: await tokenValue(page, 'border-top-left-radius', '--radius-lg'), icon: destructive });
      const tryAgain = danger.getByRole('button', { name: 'Try again' });
      await expectLegibleToastAction(page, tryAgain, 'the danger toast’s Try again');
      const retried = await trackFocus(page);
      await tryAgain.press('Enter');
      await expect(confirmedToast).toBeVisible();
      await expectFocusStays(page, nextName, `WR-301: Try again confirms the field and moves focus to the next Confirm, ${nextName}`, retried);

      /*
       * Stage B S1 (X-14, WCAG 2.2.1): focus that reaches an Undo toast by Tab, without Alt+T, pauses it. Held past its
       * 5,000 ms, the toast is still up and its Undo still works.
       */
      const undone = page.locator('[data-sonner-toast]').filter({ hasText: 'Confirmation undone.' });
      await expect(undone, 'the first Undo’s toast has closed').toHaveCount(0, { timeout: 15_000 });
      const heldUndo = confirmedToast.getByRole('button', { name: 'Undo' });
      await tabInto(page, heldUndo, 'S1: Tab from the page’s last control reaches the Undo toast’s Undo');
      await page.waitForTimeout(6_000);
      softly(await confirmedToast.isVisible(), 'S1: an Undo toast holding focus is still up 6,000 ms later, past its 5,000 ms').toBe(true);
      await expect(heldUndo, 'S1: its Undo still holds focus').toBeFocused();
      await heldUndo.press('Enter');
      await expect(undone, 'S1: Undo still works after the pause').toBeVisible();
      await expect(decided, 'S1: Undo restores the field’s Confirm').toBeVisible();
      await expect(page.locator('[data-sonner-toast]'), 'the decision toasts have closed').toHaveCount(0, { timeout: 15_000 });
    });

    /*
     * WR-401: each Confirm remaining waits for its own outcome, the success toast naming its count and record, with no
     * danger toast, never for an HTTP status (a refused Server Action still answers 200).
     */
    const confirmRemaining = page.getByRole('button', { name: /^Confirm remaining \(\d+\)/ });
    for (let pass = 0; pass < 12 && await confirmRemaining.count() > 0; pass += 1) {
      const confirm = confirmRemaining.first();
      const name = String(await confirm.getAttribute('aria-label'));
      await confirm.click();
      if (pass === 0) {
        await softly(page.locator(':focus'), `WR-301: ${name} moves focus to its review status line`).toHaveAttribute('data-ai-review-status');
        await softly(page.locator(':focus'), 'the review status line reads All AI proposals reviewed').toHaveText('All AI proposals reviewed');
      }
      await expectDecisionRecorded(page, confirmRemainingToastText(name), name);
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(confirmRemaining).toHaveCount(0);
    // WR-402 (criterion 4): a confirmed proposal reads Confirmed, named in its field's description, with no Confirm left.
    const recoveryIssue = riskCard(page, recoveryStatement).getByRole('textbox', { name: 'Issue statement' });
    await softly(recoveryIssue, 'WR-402: Confirm remaining leaves the Issue statement Confirmed').toHaveAccessibleDescription('Confirmed');
    await softly(riskCard(page, recoveryStatement).getByRole('button', { name: 'Confirm Issue statement', exact: true }), 'WR-402: a confirmed field offers no Confirm').toHaveCount(0);

    /*
     * A suggested control becomes a planned control in one action, and Undo removes it (UI-D12). Focus follows §6.2:
     * after Add or Dismiss to the next suggestion's first action, after an Undo or a Restore to the restored row's Add
     * (WR-301; walk D3, read a second later as the walk did). WR-401: each decision waits for its own success toast, with
     * no danger toast, and what it stored is read again after a reload.
     */
    const internet = riskCard(page, internetStatement);
    const internetNumber = await riskNumberOf(internet);
    const internetAdds = await suggestedAdds(internet);
    const add = internet.getByRole('button', { name: internetAdds[0], exact: true });
    const label = internetAdds[0].replace('Add as planned control: ', '');
    await expect(internet.getByRole('combobox', { name: 'Treatment action' }), 'WR-403: the internet Risk stays Treat before a suggested control is planned on it').toHaveValue('Treat');
    await add.press('Enter');
    const toast = await expectDecisionRecorded(page, `${label} added as a planned control on ${internetNumber}.`, `Adding ${label}`);
    const controls = internet.getByRole('region', { name: /^Mitigation controls for / });
    await expect(controls.getByText(`Selected control: ${label}`), 'PH12_C3_ADD_PLANNED_CONTROL').toBeVisible();
    await expect(internet.getByText('Added as a planned control')).toBeVisible();
    // Hovering the toast keeps it up while focus is read (X-14: an Undo toast pauses while hovered).
    await toast.hover();
    if (internetAdds.length > 1) {
      await softly.poll(() => focusedLabel(page), { message: '§6.2: Add moves focus to the next suggestion’s Add', timeout: 5_000 }).toBe(internetAdds[1]);
    }
    const undoneAdd = await trackFocus(page);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await page.mouse.move(0, 0);
    await expectDecisionRecorded(page, 'Planned control removed. The suggestion is back.', `The Undo of adding ${label}`);
    await expect(controls.getByText(`Selected control: ${label}`), 'PH12_C3_ADD_PLANNED_CONTROL Undo removes it').toHaveCount(0);
    await expectFocusStays(page, internetAdds[0], '§6.2: Undo of an Add returns focus to the restored suggestion’s Add', undoneAdd);
    await add.click();
    await expectDecisionRecorded(page, `${label} added as a planned control on ${internetNumber}.`, `Adding ${label} again`);
    await expect(controls.getByText(`Selected control: ${label}`)).toBeVisible();

    const personal = riskCard(page, personalStatement);
    const personalAdds = await suggestedAdds(personal);
    expect(personalAdds.length, 'the personal information Risk suggests a control to dismiss and restore, and one to plan').toBeGreaterThanOrEqual(2);
    const dismissedLabel = personalAdds[0].replace('Add as planned control: ', '');
    const dismiss = personal.getByRole('button', { name: `Dismiss suggestion: ${dismissedLabel}`, exact: true });
    const restoredAdd = personal.getByRole('button', { name: personalAdds[0], exact: true });
    await dismiss.press('Enter');
    await expect(restoredAdd).toHaveCount(0);
    const dismissedToast = await expectDecisionRecorded(page, `Suggestion dismissed: ${dismissedLabel}.`, `Dismissing ${dismissedLabel}`);
    await dismissedToast.hover();
    await softly.poll(() => focusedLabel(page), { message: '§6.2: Dismiss moves focus to the next suggestion’s Add', timeout: 5_000 }).toBe(personalAdds[1]);
    await page.mouse.move(0, 0);
    // The keyboard path the walk took: focus moves into the toast, then Enter on Undo.
    const undoneDismiss = await trackFocus(page);
    await dismissedToast.getByRole('button', { name: 'Undo' }).press('Enter');
    await expectDecisionRecorded(page, 'Suggestion restored.', `The Undo of dismissing ${dismissedLabel}`);
    await expect(restoredAdd).toBeVisible();
    await expectFocusStays(page, personalAdds[0], 'D3: Undo of a Dismiss returns focus to the restored suggestion’s Add', undoneDismiss);

    await dismiss.press('Enter');
    await expect(restoredAdd).toHaveCount(0);
    await expectDecisionRecorded(page, `Suggestion dismissed: ${dismissedLabel}.`, `Dismissing ${dismissedLabel} again`);
    // WR-401: the dismissal is stored: after a reload the suggestion waits in the dismissed list, not in the proposed one.
    await page.reload();
    const showDismissed = personal.getByRole('button', { name: /^Show dismissed suggestions/ });
    await expect(showDismissed, 'WR-401: after a reload, the stored dismissal is the one dismissed suggestion').toHaveText('Show dismissed suggestions (1)');
    await softly(restoredAdd, 'WR-401: after a reload, the dismissed suggestion is not proposed').toHaveCount(0);
    await showDismissed.click();
    await personal.getByRole('button', { name: `Restore suggestion: ${dismissedLabel}` }).click();
    await expectDecisionRecorded(page, `Suggestion restored: ${dismissedLabel}.`, `Restoring ${dismissedLabel}`);
    await expect(restoredAdd).toBeVisible();
    await softly.poll(() => focusedLabel(page), { message: '§6.2: Restore moves focus to the restored suggestion’s Add', timeout: 5_000 }).toBe(personalAdds[0]);

    /*
     * Every Treat Risk needs a mitigation control before release (Phase 10 §14), so each plans one of its suggested
     * controls. The personal information Risk plans the suggestion it never dismissed, so the restored one stays proposed.
     */
    const personalControl = await addSuggestedControl(page, personal, 'the personal information Risk', personalAdds[1]);
    const regulatory = riskCard(page, regulatoryStatement);
    const regulatoryControl = await addSuggestedControl(page, regulatory, 'the privacy obligations Risk');
    const recovery = riskCard(page, recoveryStatement);
    const recoveryControl = await addSuggestedControl(page, recovery, 'the recovery Risk');

    await page.reload();
    /*
     * IN-403 (D-13), from the journey's own steps rather than a branch on what the page shows: the last change to a
     * Risk's content was the recovery Risk's planned control, made while that Treat Risk still had none, so the
     * assessment was not release-ready before it and stays in review (D-13 returns only a release-ready assessment in
     * review to draft; field decisions, dismissals and restores change no content).
     */
    await expect(page.locator('.page-header [data-slot="badge"]'), 'IN-403: the assessment is still in review').toHaveText('In review');
    await expect(page.getByText('All release requirements are met'), 'IN-403: every release requirement is met, with no further save').toBeVisible();
    // WR-401 and WR-402: after the reload, every decision reads as Strapi stored it.
    const plannedOn = (card: Locator, control: string) => card.getByRole('region', { name: /^Mitigation controls for / }).getByText(`Selected control: ${control}`);
    await softly(plannedOn(internet, label), 'WR-401: the control added again is still a planned control').toBeVisible();
    await softly(internet.getByText('Added as a planned control'), 'WR-401: its suggestion still reads Added as a planned control').toBeVisible();
    await softly(restoredAdd, 'WR-401: the restored suggestion is back in the proposed list').toBeVisible();
    await softly(personal.getByRole('button', { name: /^Show dismissed suggestions/ }), 'WR-401: no suggestion is left dismissed').toHaveCount(0);
    await softly(plannedOn(personal, personalControl), 'WR-401: the personal information Risk keeps its planned control').toBeVisible();
    await softly(plannedOn(regulatory, regulatoryControl), 'WR-401: the privacy obligations Risk keeps its planned control').toBeVisible();
    await softly(plannedOn(recovery, recoveryControl), 'WR-401: the recovery Risk keeps its planned control').toBeVisible();
    await softly(recovery.getByRole('textbox', { name: 'Issue statement' }), 'WR-402: the Confirmed note is stored').toHaveAccessibleDescription('Confirmed');
    await page.getByRole('button', { name: 'Release assessment' }).click();
    const confirmRelease = page.getByRole('alertdialog', { name: 'Release this risk assessment?' });
    await confirmRelease.getByRole('button', { name: 'Confirm release' }).click();
    await expect(page.getByText('Assessment released', { exact: true })).toBeVisible();
  });

  await test.step('the Requestor reads that AI assisted, and nothing of its internals', async () => {
    await switchTo(page, 'Requestor');
    const assessmentId = editorPath.split('/').at(-1)!;
    await page.goto(`/app/assessments/${assessmentId}`);
    const overview = page.getByRole('heading', { level: 2, name: 'Assessment overview' }).locator('..');
    await expect(overview.getByText('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.'), 'PH12_C4_REQUESTOR_NOTICE').toBeVisible();
    await expect(overview.locator('dt:text-is("Generated by")')).toHaveCount(0);
    const text = await page.getByRole('main').innerText();
    expect(text, 'PH12_C4_REQUESTOR_NOTICE no AI internals').not.toMatch(/AI proposed|deterministic-assessment-draft|Provider:|Model:/);
    await expectAccessible(page, 'the released view');
  });
});
